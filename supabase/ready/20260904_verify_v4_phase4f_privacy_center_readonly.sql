-- Read-only verification for installed Privacy Center V1.
with f as (
  select
    to_regprocedure('public.iq_v4f_privacy_center_snapshot(uuid,uuid)') is not null as snapshot_ok,
    to_regprocedure('public.iq_v4f_list_privacy_authorizations(uuid,uuid)') is not null as authorizations_ok,
    to_regprocedure('public.iq_v4f_list_sensitive_access(uuid,uuid)') is not null as sensitive_access_ok,
    to_regprocedure('public.iq_v4f_list_privacy_audit(uuid,uuid,integer)') is not null as audit_ok
), acl as (
  select
    has_function_privilege('authenticated', 'public.iq_v4f_privacy_center_snapshot(uuid,uuid)', 'EXECUTE') as authenticated_snapshot_execute,
    not has_function_privilege('anon', 'public.iq_v4f_privacy_center_snapshot(uuid,uuid)', 'EXECUTE') as anon_snapshot_blocked,
    has_function_privilege('authenticated', 'public.iq_v4f_list_privacy_authorizations(uuid,uuid)', 'EXECUTE') as authenticated_authorizations_execute,
    not has_function_privilege('anon', 'public.iq_v4f_list_privacy_authorizations(uuid,uuid)', 'EXECUTE') as anon_authorizations_blocked,
    has_function_privilege('authenticated', 'public.iq_v4f_list_sensitive_access(uuid,uuid)', 'EXECUTE') as authenticated_sensitive_execute,
    not has_function_privilege('anon', 'public.iq_v4f_list_sensitive_access(uuid,uuid)', 'EXECUTE') as anon_sensitive_blocked,
    has_function_privilege('authenticated', 'public.iq_v4f_list_privacy_audit(uuid,uuid,integer)', 'EXECUTE') as authenticated_audit_execute,
    not has_function_privilege('anon', 'public.iq_v4f_list_privacy_audit(uuid,uuid,integer)', 'EXECUTE') as anon_audit_blocked
)
select
  'PRIVACY_CENTER_V1_VERIFY' as section,
  f.*,
  acl.*,
  (
    snapshot_ok and authorizations_ok and sensitive_access_ok and audit_ok
    and authenticated_snapshot_execute and anon_snapshot_blocked
    and authenticated_authorizations_execute and anon_authorizations_blocked
    and authenticated_sensitive_execute and anon_sensitive_blocked
    and authenticated_audit_execute and anon_audit_blocked
  ) as verify_ok
from f cross join acl;
