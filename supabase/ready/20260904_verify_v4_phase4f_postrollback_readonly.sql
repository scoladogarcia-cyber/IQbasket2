-- Read-only verification after an emergency rollback of Privacy Center V1.
-- Phase 4F objects must be absent while the Phase 4E privacy foundation remains intact.
with phase4f as (
  select
    to_regprocedure('public.iq_v4f_privacy_center_snapshot(uuid,uuid)') is null as snapshot_removed,
    to_regprocedure('public.iq_v4f_list_privacy_authorizations(uuid,uuid)') is null as authorizations_removed,
    to_regprocedure('public.iq_v4f_list_sensitive_access(uuid,uuid)') is null as sensitive_access_removed,
    to_regprocedure('public.iq_v4f_list_privacy_audit(uuid,uuid,integer)') is null as audit_removed,
    to_regprocedure('public.iq_v4f_reject_sensitive_access_request(uuid,text)') is null as reject_request_removed
), phase4e as (
  select
    to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is not null as admin_helper_preserved,
    to_regprocedure('public.iq_v4e_privacy_capabilities(uuid)') is not null as capabilities_preserved,
    to_regclass('public.player360_subject_relationships') is not null as relationships_preserved,
    to_regclass('public.player360_processing_authorizations') is not null as authorizations_table_preserved,
    to_regclass('public.player360_sensitive_access_requests') is not null as requests_table_preserved,
    to_regclass('public.player360_sensitive_access_grants') is not null as grants_table_preserved,
    to_regclass('public.player360_privacy_audit_log') is not null as audit_table_preserved
)
select
  'PRIVACY_CENTER_V1_POST_ROLLBACK' as section,
  phase4f.*,
  phase4e.*,
  (
    snapshot_removed
    and authorizations_removed
    and sensitive_access_removed
    and audit_removed
    and reject_request_removed
    and admin_helper_preserved
    and capabilities_preserved
    and relationships_preserved
    and authorizations_table_preserved
    and requests_table_preserved
    and grants_table_preserved
    and audit_table_preserved
  ) as postrollback_ok
from phase4f cross join phase4e;
