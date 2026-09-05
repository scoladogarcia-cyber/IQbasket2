-- Functional Family Workspace V1 smoke. ALWAYS rolls back.
begin;

create temp table family_workspace_smoke_state (
  superadmin_id uuid,
  family_user_id uuid,
  family_email text,
  team_season_id uuid,
  player_id uuid,
  invitation jsonb,
  claim_code text,
  claim_result jsonb,
  product_free jsonb,
  passport jsonb,
  player360_free jsonb,
  player360_family jsonb,
  relationship_id uuid
) on commit drop;

insert into family_workspace_smoke_state(
  superadmin_id,family_user_id,family_email,team_season_id,player_id
)
select sa.id,fu.id,lower(fu.email),rm.team_season_id,rm.player_id
from public.user_profiles sa
cross join public.user_profiles fu
cross join lateral (
  select rm0.team_season_id,rm0.player_id
  from public.roster_memberships rm0
  where not exists (
    select 1 from public.player360_subject_relationships r
    where r.user_id=fu.id and r.player_id=rm0.player_id and r.status='ACTIVE'
  )
  order by rm0.updated_at desc nulls last
  limit 1
) rm
where lower(sa.email)='scolado@nechigroup.com'
  and lower(fu.email)='test@test.com';

do $smoke$
begin
  if (select count(*) from family_workspace_smoke_state)<>1 then
    raise exception 'FAMILY_WORKSPACE_SMOKE_CONTEXT_MISSING';
  end if;
end
$smoke$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',s.superadmin_id::text,
    'email','scolado@nechigroup.com',
    'role','authenticated'
  )::text,true
)
from family_workspace_smoke_state s;

update family_workspace_smoke_state s
set invitation=public.iq_v8_family_create_link_invitation(
      s.team_season_id,s.player_id,s.family_email,24
    );

update family_workspace_smoke_state
set claim_code=invitation->>'claim_code';

do $smoke$
begin
  if coalesce((select length(claim_code) from family_workspace_smoke_state),0)<20 then
    raise exception 'FAMILY_WORKSPACE_SMOKE_INVITATION_FAILED';
  end if;
end
$smoke$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',s.family_user_id::text,
    'email',s.family_email,
    'role','authenticated'
  )::text,true
)
from family_workspace_smoke_state s;

update family_workspace_smoke_state s
set claim_result=public.iq_v8_family_claim_link(s.claim_code);

update family_workspace_smoke_state
set relationship_id=nullif(claim_result->>'relationship_id','')::uuid;

do $smoke$
declare v_claim jsonb;
begin
  select claim_result into v_claim from family_workspace_smoke_state;
  if not coalesce((v_claim->>'claimed')::boolean,false)
     or v_claim->>'reason_code'<>'FAMILY_LINK_ACTIVE'
     or v_claim#>>'{product,plan_code}'<>'FAMILY_FREE'
     or not coalesce((v_claim#>>'{product,subject_covered}')::boolean,false) then
    raise exception 'FAMILY_WORKSPACE_SMOKE_CLAIM_OR_FREE_BOOTSTRAP_FAILED';
  end if;
end
$smoke$;

update family_workspace_smoke_state s
set product_free=public.iq_v8_family_product_snapshot(s.player_id),
    passport=public.iq_v8_family_player_passport(s.player_id),
    player360_free=public.iq_v8_family_player360_snapshot(s.player_id,s.team_season_id);

do $smoke$
declare
  v_state family_workspace_smoke_state%rowtype;
  v_list jsonb;
begin
  select * into v_state from family_workspace_smoke_state;
  v_list:=public.iq_v8_family_list_players();

  if not exists (
    select 1 from jsonb_array_elements(v_list) x
    where x#>>'{player,id}'=v_state.player_id::text
  ) then raise exception 'FAMILY_WORKSPACE_SMOKE_LIST_PLAYERS_FAILED'; end if;

  if v_state.product_free->>'plan_code'<>'FAMILY_FREE'
     or not coalesce((v_state.product_free#>>'{entitlements,PLAYER_PROFILE,allowed}')::boolean,false)
     or not coalesce((v_state.product_free#>>'{entitlements,GAME_HISTORY,allowed}')::boolean,false)
     or not coalesce((v_state.product_free#>>'{entitlements,BASIC_STATS,allowed}')::boolean,false)
     or coalesce((v_state.product_free#>>'{entitlements,PLAYER360,allowed}')::boolean,false) then
    raise exception 'FAMILY_WORKSPACE_SMOKE_FREE_PRODUCT_BOUNDARY_FAILED';
  end if;

  if coalesce((v_state.player360_free->>'allowed')::boolean,false) then
    raise exception 'FAMILY_WORKSPACE_SMOKE_FREE_PLAYER360_OPEN';
  end if;

  if v_state.passport::text ~* '"(nutrition|recovery|neuro|rpe|internal_load|notes)"' then
    raise exception 'FAMILY_WORKSPACE_SMOKE_PASSPORT_SENSITIVE_LEAK';
  end if;
end
$smoke$;

update public.saas_subscriptions s
set plan_id=(select p.id from public.saas_plans p where p.code='FAMILY'),
    updated_at=now()
where s.billing_account_id=(
  select (product_free->>'billing_account_id')::uuid
  from family_workspace_smoke_state
)
and s.status='ACTIVE';

update family_workspace_smoke_state s
set player360_family=public.iq_v8_family_player360_snapshot(
      s.player_id,s.team_season_id
    );

do $smoke$
declare v_state family_workspace_smoke_state%rowtype;
begin
  select * into v_state from family_workspace_smoke_state;
  if not coalesce((v_state.player360_family->>'allowed')::boolean,false)
     or not coalesce((v_state.player360_family#>>'{access,player360}')::boolean,false) then
    raise exception 'FAMILY_WORKSPACE_SMOKE_FAMILY_PLAYER360_FAILED';
  end if;
  if v_state.player360_family::text ~* '"(nutrition|recovery|neuro|rpe|internal_load|notes)"' then
    raise exception 'FAMILY_WORKSPACE_SMOKE_PLAYER360_SENSITIVE_LEAK';
  end if;
end
$smoke$;

select public.iq_v8_family_revoke_own_link(
  relationship_id,'SMOKE_ROLLBACK_TEST'
)
from family_workspace_smoke_state;

do $smoke$
declare
  v_state family_workspace_smoke_state%rowtype;
  v_list jsonb;
begin
  select * into v_state from family_workspace_smoke_state;
  if iq_private.family_has_active_relation(v_state.family_user_id,v_state.player_id) then
    raise exception 'FAMILY_WORKSPACE_SMOKE_SELF_REVOKE_FAILED';
  end if;
  v_list:=public.iq_v8_family_list_players();
  if exists (
    select 1 from jsonb_array_elements(v_list) x
    where x#>>'{player,id}'=v_state.player_id::text
  ) then raise exception 'FAMILY_WORKSPACE_SMOKE_REVOKED_PLAYER_STILL_VISIBLE'; end if;
end
$smoke$;

select
  'FAMILY_WORKSPACE_SMOKE' as section,
  claim_result->>'claimed' as claimed,
  product_free->>'plan_code' as free_plan,
  player360_free->>'allowed' as free_player360,
  player360_family->>'allowed' as family_player360
from family_workspace_smoke_state;

rollback;

select 'FAMILY_WORKSPACE_SMOKE_ROLLBACK_OK' as section;
