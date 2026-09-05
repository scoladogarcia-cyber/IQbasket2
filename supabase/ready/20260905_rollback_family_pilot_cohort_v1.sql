-- =============================================================================
-- IQBasket V11 - Family Pilot Cohort V1 rollback
-- WARNING: removes V11 pilot enrollment history and only commercial grants /
-- legacy overrides created by this pilot. FAMILY_FREE, paid-plan hypotheses and
-- the reusable resource-scoped entitlement-grant infrastructure remain intact.
-- =============================================================================

begin;

revoke execute on function public.iq_v11_family_pilot_revoke(uuid,text) from authenticated;
revoke execute on function public.iq_v11_family_pilot_enroll(uuid,uuid,integer) from authenticated;
revoke execute on function public.iq_v11_family_pilot_snapshot() from authenticated;

drop function if exists public.iq_v11_family_pilot_revoke(uuid,text);
drop function if exists public.iq_v11_family_pilot_enroll(uuid,uuid,integer);
drop function if exists public.iq_v11_family_pilot_snapshot();

-- Delete only resource-scoped grants owned by this pilot. The grant table is a
-- reusable SaaS primitive and deliberately survives this feature rollback.
delete from public.saas_entitlement_grants
where source_type='FAMILY_PILOT';

-- Defensive cleanup for deployments that briefly ran V11 before V11.1 migrated
-- the account-wide pilot overrides into player-scoped grants.
delete from public.saas_entitlement_overrides
where source='PROMOTION'
  and coalesce(reason,'') like 'FAMILY_PILOT_V1:%';

drop function if exists iq_private.saas_family_pilot_guardian_relation(uuid,uuid);
drop function if exists iq_private.saas_can_manage_family_pilot(text);

drop table if exists public.saas_family_pilot_enrollments;

commit;
