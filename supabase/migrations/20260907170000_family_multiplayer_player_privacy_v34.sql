-- =============================================================================
-- IQBasket V34 · Family multi-player baseline + Player identity preferences
--
-- Goals
--   1) A verified Guardian relation must always unlock the BASIC Family Free
--      workspace for that linked player. Commercial MAX_PLAYERS must not turn a
--      valid parent/child relation into an authorization error.
--   2) JUGADOR profiles get centrally managed teammate identity preferences
--      (names / jerseys), separate from Family preferences.
--
-- Security invariants
--   * Guardian relation remains the authorization source for Family players.
--   * V34 only bypasses MAX_PLAYERS for the BASIC FAMILY_FREE promotion scope.
--   * Paid/premium entitlements keep using the existing SaaS entitlement model.
--   * Player identity preferences are presentation policy, not a new data grant.
--   * Admin writes are team-season scoped and audited.
-- =============================================================================
begin;

create schema if not exists iq_v34_private;
revoke all on schema iq_v34_private from public,anon,authenticated;
grant usage on schema iq_v34_private to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Player profile display preferences
-- -----------------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists player_show_other_player_names boolean not null default true,
  add column if not exists player_show_other_player_jerseys boolean not null default true;

create table if not exists public.player_profile_config_audit (
  id uuid primary key default gen_random_uuid(),
  player_user_id uuid not null references public.user_profiles(id) on delete cascade,
  team_season_id uuid not null references public.team_seasons(id) on delete cascade,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  previous_config jsonb not null default '{}'::jsonb,
  new_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_profile_config_audit_target
  on public.player_profile_config_audit(player_user_id,created_at desc);
create index if not exists idx_player_profile_config_audit_actor
  on public.player_profile_config_audit(actor_user_id,created_at desc);

alter table public.player_profile_config_audit enable row level security;
revoke all on table public.player_profile_config_audit from public,anon,authenticated;
drop policy if exists player_profile_config_audit_direct_deny on public.player_profile_config_audit;
create policy player_profile_config_audit_direct_deny
  on public.player_profile_config_audit
  for all to authenticated
  using (false) with check (false);

create or replace function iq_v34_private.can_manage_player_identity(p_team_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1
      from public.team_seasons ts
      where ts.id=p_team_season_id
        and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
        and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
        and (
          public.iq_v3_is_global_superadmin()
          or upper(coalesce(public.iq_v6_role_for_team_season(ts.id),'')) in (
            'SUPERADMIN','ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'
          )
        )
    );
$function$;

create or replace function iq_v34_private.resolve_player_user(
  p_email text,
  p_team_season_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
begin
  select up.id into v_user_id
  from public.user_profiles up
  where lower(trim(coalesce(up.email,'')))=lower(trim(coalesce(p_email,'')))
    and upper(coalesce(up.global_role,up.role,''))='JUGADOR'
    and up.linked_player_id is not null
    and exists (
      select 1
      from public.roster_memberships rm
      where rm.team_season_id=p_team_season_id
        and rm.player_id=up.linked_player_id
        and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
        and (rm.joined_at is null or rm.joined_at<=current_date)
        and (rm.left_at is null or rm.left_at>current_date)
    )
  limit 1;
  return v_user_id;
end
$function$;

create or replace function iq_v34_private.player_identity_payload(
  p_user_id uuid,
  p_team_season_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'user_id',up.id,
    'email',up.email,
    'team_season_id',p_team_season_id,
    'linked_player_id',up.linked_player_id,
    'show_other_player_names',coalesce(up.player_show_other_player_names,true),
    'show_other_player_jerseys',coalesce(up.player_show_other_player_jerseys,true)
  )
  from public.user_profiles up
  where up.id=p_user_id;
$function$;

create or replace function iq_v34_private.get_player_profile_config(
  p_email text,
  p_team_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
begin
  if not iq_v34_private.can_manage_player_identity(p_team_season_id) then
    raise exception 'PLAYER_PROFILE_SCOPE_DENIED' using errcode='42501';
  end if;
  v_user_id:=iq_v34_private.resolve_player_user(p_email,p_team_season_id);
  if v_user_id is null then
    raise exception 'PLAYER_PROFILE_TARGET_REQUIRED' using errcode='42501';
  end if;
  return iq_v34_private.player_identity_payload(v_user_id,p_team_season_id);
end
$function$;

create or replace function iq_v34_private.save_player_profile_config(
  p_email text,
  p_team_season_id uuid,
  p_show_other_player_names boolean,
  p_show_other_player_jerseys boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_user_id uuid;
  v_previous jsonb;
  v_new jsonb;
begin
  if not iq_v34_private.can_manage_player_identity(p_team_season_id) then
    raise exception 'PLAYER_PROFILE_SCOPE_DENIED' using errcode='42501';
  end if;
  v_user_id:=iq_v34_private.resolve_player_user(p_email,p_team_season_id);
  if v_user_id is null then
    raise exception 'PLAYER_PROFILE_TARGET_REQUIRED' using errcode='42501';
  end if;

  v_previous:=iq_v34_private.player_identity_payload(v_user_id,p_team_season_id);

  update public.user_profiles
     set player_show_other_player_names=coalesce(p_show_other_player_names,true),
         player_show_other_player_jerseys=coalesce(p_show_other_player_jerseys,true)
   where id=v_user_id;

  v_new:=iq_v34_private.player_identity_payload(v_user_id,p_team_season_id);
  if v_new is distinct from v_previous then
    insert into public.player_profile_config_audit(
      player_user_id,team_season_id,actor_user_id,previous_config,new_config
    ) values (v_user_id,p_team_season_id,auth.uid(),v_previous,v_new);
  end if;
  return v_new;
end
$function$;

create or replace function iq_v34_private.my_player_identity_preferences(
  p_team_season_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_ts uuid:=p_team_season_id;
  v_player_id uuid;
  v_role text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  select upper(coalesce(up.global_role,up.role,'')),up.linked_player_id
    into v_role,v_player_id
  from public.user_profiles up
  where up.id=auth.uid();

  if v_role<>'JUGADOR' or v_player_id is null then
    raise exception 'PLAYER_PROFILE_SELF_REQUIRED' using errcode='42501';
  end if;

  if v_ts is null then
    select rm.team_season_id into v_ts
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where rm.player_id=v_player_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.joined_at is null or rm.joined_at<=current_date)
      and (rm.left_at is null or rm.left_at>current_date)
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    order by coalesce(rm.joined_at,rm.created_at) desc,ts.updated_at desc
    limit 1;
  end if;

  if v_ts is null or not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id=v_ts and rm.player_id=v_player_id
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.left_at is null or rm.left_at>current_date)
  ) then
    raise exception 'PLAYER_PROFILE_TEAM_SCOPE_DENIED' using errcode='42501';
  end if;

  return iq_v34_private.player_identity_payload(auth.uid(),v_ts);
end
$function$;

create or replace function public.iq_v34_get_player_profile_config(
  p_email text,
  p_team_season_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v34_private.get_player_profile_config(p_email,p_team_season_id);
$function$;

create or replace function public.iq_v34_save_player_profile_config(
  p_email text,
  p_team_season_id uuid,
  p_show_other_player_names boolean,
  p_show_other_player_jerseys boolean
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v34_private.save_player_profile_config(
    p_email,p_team_season_id,p_show_other_player_names,p_show_other_player_jerseys
  );
$function$;

create or replace function public.iq_v34_my_player_identity_preferences(
  p_team_season_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v34_private.my_player_identity_preferences(p_team_season_id);
$function$;

-- -----------------------------------------------------------------------------
-- 2. FAMILY_FREE baseline follows every verified Guardian relation.
--    MAX_PLAYERS remains relevant for paid/premium coverage, but it must not make
--    the basic Family workspace inaccessible for a legitimately linked child.
-- -----------------------------------------------------------------------------
create or replace function iq_v34_private.ensure_family_free_player(
  p_family_user_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
  v_account_id uuid;
  v_plan_code text;
  v_role text;
begin
  if p_family_user_id is null or p_player_id is null then
    raise exception 'FAMILY_V34_SCOPE_REQUIRED';
  end if;

  select upper(coalesce(up.global_role,up.role,'')) into v_role
  from public.user_profiles up where up.id=p_family_user_id;
  if v_role not in ('FAMILIA_TUTOR','FAMILY','FAMILIA','TUTOR') then
    raise exception 'FAMILY_V34_USER_REQUIRED' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.player360_subject_relationships r
    where r.user_id=p_family_user_id and r.player_id=p_player_id
      and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  ) then
    raise exception 'FAMILY_RELATION_REQUIRED' using errcode='42501';
  end if;

  v_result:=iq_private.family_bootstrap_free_account(p_family_user_id,p_player_id);
  v_account_id:=nullif(v_result->>'billing_account_id','')::uuid;
  v_plan_code:=upper(coalesce(v_result->>'plan_code',''));

  if not coalesce((v_result->>'subject_covered')::boolean,false)
     and v_plan_code='FAMILY_FREE'
     and v_account_id is not null then
    insert into public.saas_billing_subjects(
      billing_account_id,subject_type,player_id,status,source
    ) values (
      v_account_id,'PLAYER',p_player_id,'ACTIVE','PROMOTION'
    ) on conflict do nothing;

    v_result:=iq_private.family_bootstrap_free_account(p_family_user_id,p_player_id);
  end if;

  return v_result || jsonb_build_object(
    'baseline_access_source','VERIFIED_GUARDIAN_RELATION_V34'
  );
end
$function$;

create or replace function iq_v34_private.bootstrap_my_family_free_player(p_player_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  return iq_v34_private.ensure_family_free_player(auth.uid(),p_player_id);
end
$function$;

create or replace function public.iq_v34_family_bootstrap_free(p_player_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v34_private.bootstrap_my_family_free_player(p_player_id);
$function$;

create or replace function iq_v34_private.claim_family_link(p_claim_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
  v_player_id uuid;
  v_product jsonb;
begin
  -- V8/V30 remains the authoritative invitation + Guardian relationship flow.
  v_result:=public.iq_v8_family_claim_link(p_claim_code);
  if coalesce((v_result->>'claimed')::boolean,false) then
    v_player_id:=nullif(v_result->>'player_id','')::uuid;
    if v_player_id is not null then
      v_product:=iq_v34_private.ensure_family_free_player(auth.uid(),v_player_id);
      v_result:=jsonb_set(v_result,'{product}',coalesce(v_product,'{}'::jsonb),true);
    end if;
  end if;
  return v_result;
end
$function$;

create or replace function public.iq_v34_family_claim_link(p_claim_code text)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v34_private.claim_family_link(p_claim_code);
$function$;

-- Admin/Superadmin direct assignment gets the same baseline materialization
-- immediately, rather than waiting for the Family user to open the player.
create or replace function iq_v34_private.save_family_profile_config(
  p_user_id uuid,
  p_team_season_id uuid,
  p_player_ids uuid[],
  p_show_other_player_names boolean,
  p_show_other_player_jerseys boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
  v_player_id uuid;
begin
  -- V26 remains authoritative for scope checks, relationship mutation and audit.
  v_result:=public.iq_v26_save_family_profile_config(
    p_user_id,p_team_season_id,p_player_ids,
    p_show_other_player_names,p_show_other_player_jerseys
  );

  foreach v_player_id in array coalesce(p_player_ids,'{}'::uuid[]) loop
    perform iq_v34_private.ensure_family_free_player(p_user_id,v_player_id);
  end loop;
  return v_result;
end
$function$;

create or replace function public.iq_v34_save_family_profile_config(
  p_user_id uuid,
  p_team_season_id uuid,
  p_player_ids uuid[],
  p_show_other_player_names boolean,
  p_show_other_player_jerseys boolean
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v34_private.save_family_profile_config(
    p_user_id,p_team_season_id,p_player_ids,
    p_show_other_player_names,p_show_other_player_jerseys
  );
$function$;

-- Backfill only verified active Guardian links belonging to active FAMILY_FREE
-- accounts. No generated IDs or environment-specific subjects are hardcoded.
do $family_free_backfill$
declare
  rec record;
begin
  for rec in
    select distinct a.owner_user_id as family_user_id,r.player_id
    from public.saas_billing_accounts a
    join public.saas_subscriptions sub on sub.billing_account_id=a.id
      and sub.status in ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED')
    join public.saas_plans plan on plan.id=sub.plan_id
      and plan.code='FAMILY_FREE' and plan.account_type='FAMILY'
    join public.player360_subject_relationships r on r.user_id=a.owner_user_id
      and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    where a.account_type='FAMILY' and a.status='ACTIVE'
  loop
    perform iq_v34_private.ensure_family_free_player(rec.family_user_id,rec.player_id);
  end loop;
end
$family_free_backfill$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
revoke all on function iq_v34_private.can_manage_player_identity(uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.resolve_player_user(text,uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.player_identity_payload(uuid,uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.get_player_profile_config(text,uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.save_player_profile_config(text,uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function iq_v34_private.my_player_identity_preferences(uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.ensure_family_free_player(uuid,uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.bootstrap_my_family_free_player(uuid) from public,anon,authenticated;
revoke all on function iq_v34_private.claim_family_link(text) from public,anon,authenticated;
revoke all on function iq_v34_private.save_family_profile_config(uuid,uuid,uuid[],boolean,boolean) from public,anon,authenticated;

grant execute on function iq_v34_private.get_player_profile_config(text,uuid) to authenticated;
grant execute on function iq_v34_private.save_player_profile_config(text,uuid,boolean,boolean) to authenticated;
grant execute on function iq_v34_private.my_player_identity_preferences(uuid) to authenticated;
grant execute on function iq_v34_private.bootstrap_my_family_free_player(uuid) to authenticated;
grant execute on function iq_v34_private.claim_family_link(text) to authenticated;
grant execute on function iq_v34_private.save_family_profile_config(uuid,uuid,uuid[],boolean,boolean) to authenticated;

revoke all on function public.iq_v34_get_player_profile_config(text,uuid) from public,anon,authenticated;
revoke all on function public.iq_v34_save_player_profile_config(text,uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function public.iq_v34_my_player_identity_preferences(uuid) from public,anon,authenticated;
revoke all on function public.iq_v34_family_bootstrap_free(uuid) from public,anon,authenticated;
revoke all on function public.iq_v34_family_claim_link(text) from public,anon,authenticated;
revoke all on function public.iq_v34_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean) from public,anon,authenticated;

grant execute on function public.iq_v34_get_player_profile_config(text,uuid) to authenticated;
grant execute on function public.iq_v34_save_player_profile_config(text,uuid,boolean,boolean) to authenticated;
grant execute on function public.iq_v34_my_player_identity_preferences(uuid) to authenticated;
grant execute on function public.iq_v34_family_bootstrap_free(uuid) to authenticated;
grant execute on function public.iq_v34_family_claim_link(text) to authenticated;
grant execute on function public.iq_v34_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean) to authenticated;

commit;
