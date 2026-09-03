-- Read-only verification of the installed SUPERADMIN wellness hotfix.
with function_def as (
  select pg_get_functiondef(
    'public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)'::regprocedure
  ) as body
)
select
  'SUPERADMIN_WELLNESS_HOTFIX_VERIFY' as section,
  position('SUPERADMIN_OPERATIONAL_WELLNESS_OVERRIDE_V1' in body) > 0 as marker_ok,
  position('iq_v3_is_global_superadmin()' in body) > 0 as superadmin_check_ok,
  position('v_module in (''nutrition'',''recovery'')' in body) > 0 as modules_limited_ok,
  position('v_action in (''READ'',''CREATE'',''UPDATE'')' in body) > 0 as actions_limited_ok,
  position('v_purpose in (''SPORT_PERFORMANCE'',''OPERATIONS'')' in body) > 0 as purposes_limited_ok,
  position('v_action in (''EXPORT'',''AI_PROCESS'')' in body) > 0 as export_ai_strict_path_ok,
  position('neuro_cognitive' in body) > 0 as neuro_still_supported_by_strict_path,
  (
    position('SUPERADMIN_OPERATIONAL_WELLNESS_OVERRIDE_V1' in body) > 0
    and position('iq_v3_is_global_superadmin()' in body) > 0
    and position('v_module in (''nutrition'',''recovery'')' in body) > 0
    and position('v_action in (''READ'',''CREATE'',''UPDATE'')' in body) > 0
    and position('v_purpose in (''SPORT_PERFORMANCE'',''OPERATIONS'')' in body) > 0
    and position('v_action in (''EXPORT'',''AI_PROCESS'')' in body) > 0
  ) as verify_ok
from function_def;
