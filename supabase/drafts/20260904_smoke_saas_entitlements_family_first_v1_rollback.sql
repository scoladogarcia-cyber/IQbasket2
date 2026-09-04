-- IQBasket family-first entitlements V1 functional smoke.
-- Creates synthetic commercial rows only inside this transaction and always rolls back.
begin;

-- Activate draft hypotheses only inside the smoke transaction.
update public.saas_plans
set status='ACTIVE'
where code in ('FAMILY','TEAM_PRO');

create temporary table iq_saas_smoke_context(
  family_user_id uuid,
  staff_user_id uuid,
  player_id uuid,
  team_id uuid,
  team_season_id uuid,
  family_account_id uuid,
  team_account_id uuid
) on commit drop;

insert into iq_saas_smoke_context(family_user_id,staff_user_id,player_id,team_id,team_season_id)
select
  (select id from public.user_profiles where lower(email)='test@test.com' limit 1),
  (select id from public.user_profiles where upper(coalesce(global_role,''))='SUPERADMIN' limit 1),
  p.id,ts.team_id,ts.id
from public.team_seasons ts
join public.players p on p.team_id=ts.team_id
where ts.id='d0000000-0000-4000-8000-000000000005'::uuid
limit 1;
do $block$
declare c iq_saas_smoke_context%rowtype;
begin
  select * into c from iq_saas_smoke_context;
  if c.family_user_id is null or c.staff_user_id is null or c.player_id is null
     or c.team_id is null or c.team_season_id is null then
    raise exception 'SAAS_SMOKE_BASE_CONTEXT_MISSING';
  end if;
end
$block$;

-- The commercial subject never replaces the sports/family relationship.
insert into public.user_player_links(user_id,player_id,relation_type,status,valid_from)
select family_user_id,player_id,'TUTOR','ACTIVE',now()
from iq_saas_smoke_context
on conflict (user_id,player_id,relation_type) do update
set status='ACTIVE',valid_from=excluded.valid_from,valid_until=null;

with created as (
  insert into public.saas_billing_accounts(account_type,display_name,owner_user_id,source)
  select 'FAMILY','Smoke Family',family_user_id,'INTERNAL'
  from iq_saas_smoke_context
  returning id
)
update iq_saas_smoke_context set family_account_id=(select id from created);

insert into public.saas_billing_subjects(billing_account_id,subject_type,player_id,source)
select family_account_id,'PLAYER',player_id,'INTERNAL'
from iq_saas_smoke_context;
insert into public.saas_subscriptions(billing_account_id,plan_id,status,source)
select c.family_account_id,p.id,'ACTIVE','INTERNAL'
from iq_saas_smoke_context c
join public.saas_plans p on p.code='FAMILY';

with created as (
  insert into public.saas_billing_accounts(account_type,display_name,owner_user_id,source)
  select 'TEAM','Smoke Team',staff_user_id,'INTERNAL'
  from iq_saas_smoke_context
  returning id
)
update iq_saas_smoke_context set team_account_id=(select id from created);

insert into public.saas_billing_subjects(billing_account_id,subject_type,team_id,source)
select team_account_id,'TEAM',team_id,'INTERNAL'
from iq_saas_smoke_context;

insert into public.saas_subscriptions(billing_account_id,plan_id,status,source)
select c.team_account_id,p.id,'ACTIVE','INTERNAL'
from iq_saas_smoke_context c
join public.saas_plans p on p.code='TEAM_PRO';

-- Family owner must have been materialized as the OWNER billing member.
do $block$
declare c iq_saas_smoke_context%rowtype;
begin
  select * into c from iq_saas_smoke_context;
  if not exists (
    select 1 from public.saas_billing_account_members m
    where m.billing_account_id=c.family_account_id
      and m.user_id=c.family_user_id and m.member_role='OWNER' and m.status='ACTIVE'
  ) then raise exception 'SAAS_SMOKE_FAMILY_OWNER_MEMBERSHIP_MISSING'; end if;
end
$block$;
-- Validate structural invariants without aborting the smoke transaction.
do $block$
declare c iq_saas_smoke_context%rowtype; failed boolean:=false;
begin
  select * into c from iq_saas_smoke_context;
  begin
    insert into public.saas_billing_subjects(billing_account_id,subject_type,team_id,source)
    values(c.family_account_id,'TEAM',c.team_id,'INTERNAL');
  exception when others then
    failed:=position('SAAS_FAMILY_PLAYER_SUBJECT_REQUIRED' in sqlerrm)>0;
  end;
  if not failed then raise exception 'SAAS_SMOKE_FAMILY_SUBJECT_INVARIANT_FAILED'; end if;

  failed:=false;
  begin
    insert into public.saas_subscriptions(billing_account_id,plan_id,status,source)
    select c.family_account_id,p.id,'CANCELLED','INTERNAL'
    from public.saas_plans p where p.code='TEAM_PRO';
  exception when others then
    failed:=position('SAAS_SUBSCRIPTION_PLAN_ACCOUNT_TYPE_MISMATCH' in sqlerrm)>0;
  end;
  if not failed then raise exception 'SAAS_SMOKE_PLAN_TYPE_INVARIANT_FAILED'; end if;
end
$block$;

-- Family entitlement: relationship + account membership + PLAYER subject are all required.
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',family_user_id::text,'email','test@test.com','role','authenticated')::text,
  true
)
from iq_saas_smoke_context;
select set_config('iq.saas.player_id',player_id::text,true),
       set_config('iq.saas.team_id',team_id::text,true),
       set_config('iq.saas.team_season_id',team_season_id::text,true)
from iq_saas_smoke_context;
set local role authenticated;
with player360 as (
  select public.iq_saas_entitlement_check(
    'PLAYER',current_setting('iq.saas.player_id')::uuid,
    current_setting('iq.saas.team_season_id')::uuid,'PLAYER360',1
  ) result
), ai_limit as (
  select public.iq_saas_entitlement_check(
    'PLAYER',current_setting('iq.saas.player_id')::uuid,
    current_setting('iq.saas.team_season_id')::uuid,'AI_MONTHLY_UNITS',1
  ) result
), nutrition as (
  select public.iq_saas_entitlement_check(
    'PLAYER',current_setting('iq.saas.player_id')::uuid,
    current_setting('iq.saas.team_season_id')::uuid,'NUTRITION_RECOVERY',1
  ) result
)
select 'SAAS_FAMILY_RUNTIME' marker,
  coalesce((player360.result->>'allowed')::boolean,false) as player360_allowed,
  coalesce((ai_limit.result->>'allowed')::boolean,false) as ai_units_active,
  coalesce((nutrition.result->>'allowed')::boolean,false) as sensitive_module_commercially_unlocked,
  player360.result->>'account_type' as account_type
from player360,ai_limit,nutrition;

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',staff_user_id::text,'email','scolado@nechigroup.com','role','authenticated'
  )::text,
  true
),
set_config('iq.saas.team_id',team_id::text,true),
set_config('iq.saas.team_season_id',team_season_id::text,true)
from iq_saas_smoke_context;
set local role authenticated;

with player360 as (
  select public.iq_saas_entitlement_check(
    'TEAM',current_setting('iq.saas.team_id')::uuid,
    current_setting('iq.saas.team_season_id')::uuid,'PLAYER360',1
  ) result
)
select 'SAAS_STAFF_RUNTIME' marker,
  coalesce((result->>'allowed')::boolean,false) as player360_allowed,
  result->>'account_type' as account_type,
  result->>'beneficiary_scope' as beneficiary_scope
from player360;

reset role;
select 'SAAS_ENTITLEMENT_SMOKE_READY_TO_ROLLBACK' as marker,
  (select count(*) from public.saas_billing_accounts) as transient_accounts,
  (select count(*) from public.saas_subscriptions) as transient_subscriptions,
  (select count(*) from public.saas_billing_subjects) as transient_subjects;

rollback;
