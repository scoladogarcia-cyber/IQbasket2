-- IQBasket Player Passport V1 - premium plan entitlement mapping.
begin;

insert into public.saas_plan_entitlements(plan_id,entitlement_code,beneficiary_scope,boolean_value)
select p.id,'PLAYER_PASSPORT',
  case when p.account_type='FAMILY' then 'ACCOUNT_MEMBERS' else 'AUTHORIZED_STAFF' end,
  true
from public.saas_plans p
where p.code in ('FAMILY','FAMILY_PRO','TEAM_PRO','CLUB','ACADEMY')
on conflict (plan_id,entitlement_code) do update
set beneficiary_scope=excluded.beneficiary_scope,boolean_value=true,updated_at=now();

commit;
