-- Read-only prerequisite check for the SUPERADMIN wellness hotfix.
select
  'SUPERADMIN_WELLNESS_HOTFIX_PREFLIGHT' as section,
  to_regprocedure(
    'public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)'
  ) is not null as access_helper_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_helper_ok,
  to_regprocedure(
    'public.iq_v4e_has_processing_authorization(uuid,uuid,text,text,text)'
  ) is not null as processing_helper_ok,
  to_regprocedure(
    'public.iq_v4e_has_sensitive_grant(uuid,uuid,uuid,text,text,text)'
  ) is not null as grant_helper_ok,
  to_regclass('public.roster_memberships') is not null as roster_scope_ok,
  (
    to_regprocedure(
      'public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)'
    ) is not null
    and to_regprocedure('public.iq_v3_is_global_superadmin()') is not null
    and to_regprocedure(
      'public.iq_v4e_has_processing_authorization(uuid,uuid,text,text,text)'
    ) is not null
    and to_regprocedure(
      'public.iq_v4e_has_sensitive_grant(uuid,uuid,uuid,text,text,text)'
    ) is not null
    and to_regclass('public.roster_memberships') is not null
  ) as preflight_ok;
