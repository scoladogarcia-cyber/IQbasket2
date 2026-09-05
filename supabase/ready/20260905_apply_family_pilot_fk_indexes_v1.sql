-- =============================================================================
-- IQBasket Family Pilot - FK index coverage V1
-- Date: 2026-09-05
-- Purpose:
--   * cover audit/resource foreign keys introduced by the scoped-grant and
--     Family pilot tables;
--   * avoid adding new unindexed-foreign-key linter findings in production.
--
-- Apply after:
--   1) 20260905_apply_saas_scoped_entitlement_grants_v1.sql
--   2) 20260905_apply_family_pilot_cohort_v1.sql
-- =============================================================================

begin;

do $prereq$
begin
  if to_regclass('public.saas_entitlement_grants') is null
     or to_regclass('public.saas_family_pilot_enrollments') is null then
    raise exception 'FAMILY_PILOT_FK_INDEX_PREREQUISITES_MISSING';
  end if;
end
$prereq$;

-- saas_entitlement_grants already has a full billing_account_id-leading index.
-- Partial resource indexes are useful for runtime queries but the FK linter does
-- not treat them as universal FK coverage, so add compact full-column indexes.
create index if not exists saas_entitlement_grants_entitlement_code_fk_idx
  on public.saas_entitlement_grants(entitlement_code);
create index if not exists saas_entitlement_grants_player_id_fk_idx
  on public.saas_entitlement_grants(player_id);
create index if not exists saas_entitlement_grants_team_id_fk_idx
  on public.saas_entitlement_grants(team_id);
create index if not exists saas_entitlement_grants_club_id_fk_idx
  on public.saas_entitlement_grants(club_id);
create index if not exists saas_entitlement_grants_created_by_fk_idx
  on public.saas_entitlement_grants(created_by);
create index if not exists saas_entitlement_grants_revoked_by_fk_idx
  on public.saas_entitlement_grants(revoked_by);

-- owner_user_id and player_id are already covered by full leading indexes.
-- billing_account_id only had a partial unique index for active rows.
create index if not exists saas_family_pilot_billing_account_fk_idx
  on public.saas_family_pilot_enrollments(billing_account_id);
create index if not exists saas_family_pilot_created_by_fk_idx
  on public.saas_family_pilot_enrollments(created_by);
create index if not exists saas_family_pilot_revoked_by_fk_idx
  on public.saas_family_pilot_enrollments(revoked_by);

commit;

select
  'FAMILY_PILOT_FK_INDEXES_V1' as section,
  to_regclass('public.saas_entitlement_grants') is not null as grants_table_ok,
  to_regclass('public.saas_family_pilot_enrollments') is not null as pilot_table_ok;
