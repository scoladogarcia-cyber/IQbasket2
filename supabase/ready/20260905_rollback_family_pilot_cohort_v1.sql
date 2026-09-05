-- =============================================================================
-- IQBasket V11 - Family Pilot Cohort V1 rollback
-- WARNING: removes V11 pilot enrollment history and only the entitlement
-- overrides created by this pilot. It does not alter FAMILY_FREE or paid plans.
-- =============================================================================

begin;

revoke execute on function public.iq_v11_family_pilot_revoke(uuid,text) from authenticated;
revoke execute on function public.iq_v11_family_pilot_enroll(uuid,uuid,integer) from authenticated;
revoke execute on function public.iq_v11_family_pilot_snapshot() from authenticated;

drop function if exists public.iq_v11_family_pilot_revoke(uuid,text);
drop function if exists public.iq_v11_family_pilot_enroll(uuid,uuid,integer);
drop function if exists public.iq_v11_family_pilot_snapshot();

-- Delete only overrides owned by this feature. Manual, billing and unrelated
-- promotion overrides remain untouched.
delete from public.saas_entitlement_overrides
where source='PROMOTION'
  and coalesce(reason,'') like 'FAMILY_PILOT_V1:%';

drop function if exists iq_private.saas_family_pilot_guardian_relation(uuid,uuid);
drop function if exists iq_private.saas_can_manage_family_pilot(text);

drop table if exists public.saas_family_pilot_enrollments;

commit;
