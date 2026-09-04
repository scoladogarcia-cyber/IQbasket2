-- Read-only verification for IQBasket SaaS Entitlements V1.
select
  (select count(*) from public.saas_entitlement_catalog) as entitlement_count,
  (select count(*) from public.saas_plans) as plan_count,
  (select count(*) from public.saas_billing_accounts) as billing_account_count,
  (select count(*) from public.saas_subscriptions) as subscription_count,
  exists(select 1 from public.saas_plans where code='FAMILY_FREE' and status='ACTIVE') as family_free_ok,
  exists(select 1 from public.saas_plans where code='FAMILY_PRO' and account_type='FAMILY' and status='DRAFT') as family_pro_safe,
  exists(select 1 from public.saas_plans where code='CLUB' and account_type='CLUB' and status='DRAFT') as club_safe,
  exists(select 1 from public.saas_plan_entitlements pe join public.saas_plans p on p.id=pe.plan_id
    where p.code='FAMILY_PRO' and pe.entitlement_code='PLAYER360' and pe.beneficiary_scope='ACCOUNT_MEMBERS') as family_player360_ok,
  exists(select 1 from public.saas_plan_entitlements pe join public.saas_plans p on p.id=pe.plan_id
    where p.code='CLUB' and pe.entitlement_code='PLAYER360' and pe.beneficiary_scope='AUTHORIZED_STAFF') as club_staff_scope_ok;
select
  count(*) filter (where not c.relrowsecurity) as tables_without_rls,
  count(*) as saas_table_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname like 'saas\_%' escape '\';

select count(*) as direct_client_grants
from information_schema.role_table_grants
where table_schema='public' and table_name like 'saas\_%' escape '\'
  and grantee in ('anon','authenticated');

select p.proname,p.prosecdef,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('iq_saas_entitlement_check','iq_saas_entitlement_snapshot')
order by p.proname;
