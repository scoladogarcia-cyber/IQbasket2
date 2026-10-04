-- IQBasket V58 · commercial entitlements for Training Intelligence and Benchmarking.
-- This migration does not activate plans and does not gate UI by itself.

insert into public.saas_entitlement_catalog(
  code,name,description,category,value_type,default_boolean,is_active
) values
  (
    'TRAINING_ANALYTICS',
    'Training Analytics',
    'Team and player training intelligence, focus exposure and longitudinal training-performance analysis.',
    'ANALYTICS','BOOLEAN',false,true
  ),
  (
    'BENCHMARKING',
    'Benchmarking',
    'Contextual self, team and eligible anonymized network performance benchmarks.',
    'ANALYTICS','BOOLEAN',false,true
  )
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  value_type=excluded.value_type,
  default_boolean=excluded.default_boolean,
  is_active=excluded.is_active,
  updated_at=now();

insert into public.saas_plan_entitlements(
  plan_id,entitlement_code,beneficiary_scope,boolean_value
)
select p.id,e.code,
  case when p.code='INTERNAL_FULL' then 'ALL_AUTHORIZED' else 'AUTHORIZED_STAFF' end,
  true
from public.saas_plans p
cross join (values ('TRAINING_ANALYTICS'),('BENCHMARKING')) e(code)
where p.code in ('INTERNAL_FULL','CLUB','ACADEMY')
on conflict (plan_id,entitlement_code) do update set
  beneficiary_scope=excluded.beneficiary_scope,
  boolean_value=excluded.boolean_value,
  integer_value=null,
  text_value=null,
  updated_at=now();

insert into public.saas_plan_entitlements(
  plan_id,entitlement_code,beneficiary_scope,boolean_value
)
select p.id,'BENCHMARKING','ACCOUNT_MEMBERS',true
from public.saas_plans p
where p.code='FAMILY_PRO'
on conflict (plan_id,entitlement_code) do update set
  beneficiary_scope=excluded.beneficiary_scope,
  boolean_value=excluded.boolean_value,
  integer_value=null,
  text_value=null,
  updated_at=now();
