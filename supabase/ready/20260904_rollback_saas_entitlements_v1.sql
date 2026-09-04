-- IQBasket SaaS Entitlements V1 rollback.
-- Refuses destructive rollback once any commercial account has been created.
begin;

do $block$
begin
  if to_regclass('public.saas_billing_accounts') is not null
     and exists(select 1 from public.saas_billing_accounts) then
    raise exception 'SAAS_V1_ROLLBACK_REFUSED_BILLING_DATA_EXISTS';
  end if;
end
$block$;

drop function if exists public.iq_saas_entitlement_snapshot(text,uuid,uuid);
drop function if exists public.iq_saas_entitlement_check(text,uuid,uuid,text,integer);
drop function if exists iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text);
drop function if exists iq_private.saas_subject_covers(uuid,text,uuid,uuid);
drop function if exists iq_private.saas_user_is_staff(uuid,text,uuid,uuid);
drop function if exists iq_private.saas_user_can_access_subject(uuid,text,uuid,uuid);
drop function if exists iq_private.saas_account_member(uuid,uuid);
drop function if exists iq_private.saas_subscription_effective(uuid);
drop function if exists iq_private.saas_validate_subscription_plan();
drop function if exists iq_private.saas_validate_billing_subject();
drop function if exists iq_private.saas_sync_billing_owner();

drop table if exists public.saas_subscription_history cascade;
drop table if exists public.saas_entitlement_overrides cascade;
drop table if exists public.saas_subscriptions cascade;
drop table if exists public.saas_billing_subjects cascade;
drop table if exists public.saas_billing_account_members cascade;
drop table if exists public.saas_billing_accounts cascade;
drop table if exists public.saas_plan_entitlements cascade;
drop table if exists public.saas_plans cascade;
drop table if exists public.saas_entitlement_catalog cascade;

drop function if exists iq_private.saas_audit_subscription();
drop function if exists iq_private.saas_touch_updated_at();
drop function if exists iq_private.saas_validate_entitlement_value();

commit;
