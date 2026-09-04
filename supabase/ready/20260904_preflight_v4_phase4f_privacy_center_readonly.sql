-- Read-only preflight for Privacy Center V1.
select
  'PRIVACY_CENTER_V1_PREFLIGHT' as section,
  to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is not null as admin_helper_ok,
  to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
  to_regclass('public.player360_processing_authorizations') is not null as authorizations_ok,
  to_regclass('public.player360_sensitive_access_requests') is not null as requests_ok,
  to_regclass('public.player360_sensitive_access_grants') is not null as grants_ok,
  to_regclass('public.player360_privacy_audit_log') is not null as audit_ok,
  to_regclass('public.roster_memberships') is not null as roster_ok,
  (
    to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is not null
    and to_regclass('public.player360_subject_relationships') is not null
    and to_regclass('public.player360_processing_authorizations') is not null
    and to_regclass('public.player360_sensitive_access_requests') is not null
    and to_regclass('public.player360_sensitive_access_grants') is not null
    and to_regclass('public.player360_privacy_audit_log') is not null
    and to_regclass('public.roster_memberships') is not null
  ) as preflight_ok;
