-- Functional Family Development Context V1 smoke. ALWAYS rolls back.
begin;

create temp table family_development_smoke_state(
  superadmin_id uuid,
  family_user_id uuid,
  family_email text,
  team_season_id uuid,
  player_id uuid,
  invitation jsonb,
  claim_code text,
  product_free jsonb,
  context_free jsonb,
  context_family jsonb
) on commit drop;

insert into family_development_smoke_state(
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
  order by rm0.updated_at desc nulls last limit 1
) rm
where lower(sa.email)='scolado@nechigroup.com'
  and lower(fu.email)='test@test.com';

do $smoke$
begin
  if (select count(*) from family_development_smoke_state)<>1 then
    raise exception 'FAMILY_DEVELOPMENT_SMOKE_CONTEXT_MISSING';
  end if;
end
$smoke$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',s.superadmin_id::text,'email','scolado@nechigroup.com','role','authenticated'
  )::text,true
) from family_development_smoke_state s;

update family_development_smoke_state s
set invitation=public.iq_v8_family_create_link_invitation(
  s.team_season_id,s.player_id,s.family_email,24
);

update family_development_smoke_state
set claim_code=invitation->>'claim_code';

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',s.family_user_id::text,'email',s.family_email,'role','authenticated'
  )::text,true
) from family_development_smoke_state s;

select public.iq_v8_family_claim_link(s.claim_code)
from family_development_smoke_state s;

update family_development_smoke_state s
set product_free=public.iq_v8_family_product_snapshot(s.player_id),
    context_free=public.iq_v10_family_development_context(s.player_id,s.team_season_id);

do $smoke$
declare v family_development_smoke_state%rowtype;
begin
  select * into v from family_development_smoke_state;
  if v.product_free->>'plan_code'<>'FAMILY_FREE' then
    raise exception 'FAMILY_DEVELOPMENT_SMOKE_FREE_PLAN_MISSING';
  end if;
  if coalesce((v.context_free->>'allowed')::boolean,false) then
    raise exception 'FAMILY_DEVELOPMENT_SMOKE_FREE_CONTEXT_OPEN';
  end if;
end
$smoke$;

-- FAMILY remains DRAFT in production. Activate it only inside this rollback smoke.
update public.saas_plans set status='ACTIVE' where code='FAMILY';

update public.saas_subscriptions s
set plan_id=(select p.id from public.saas_plans p where p.code='FAMILY'),
    updated_at=now()
where s.billing_account_id=(
  select (product_free->>'billing_account_id')::uuid
  from family_development_smoke_state
)
and s.status='ACTIVE';

update family_development_smoke_state s
set context_family=public.iq_v10_family_development_context(
  s.player_id,s.team_season_id
);

do $smoke$
declare v family_development_smoke_state%rowtype;
begin
  select * into v from family_development_smoke_state;
  if not coalesce((v.context_family->>'allowed')::boolean,false) then
    raise exception 'FAMILY_DEVELOPMENT_SMOKE_FAMILY_CONTEXT_CLOSED';
  end if;
  if v.context_family::text ~* '"(rpe|internal_load|notes|provenance|metadata)"[[:space:]]*:' then
    raise exception 'FAMILY_DEVELOPMENT_SMOKE_SENSITIVE_FIELD_LEAK';
  end if;
  if v.context_family::text ~* '"(nutrition|recovery|neuro_cognitive)"[[:space:]]*:' then
    raise exception 'FAMILY_DEVELOPMENT_SMOKE_SENSITIVE_MODULE_LEAK';
  end if;
end
$smoke$;

select
  'FAMILY_DEVELOPMENT_SMOKE' as section,
  coalesce((context_free->>'allowed')::boolean,false) as free_open,
  coalesce((context_family->>'allowed')::boolean,false) as family_open,
  context_family->>'reason_code' as reason_code
from family_development_smoke_state;

rollback;

select 'FAMILY_DEVELOPMENT_SMOKE_ROLLBACK_OK' as section;
