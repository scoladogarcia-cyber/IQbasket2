-- Player Passport V1 preflight (read-only)
select
  to_regclass('public.player360_evaluation_metrics') is not null as phase4c_metrics_ok,
  to_regclass('public.player_evaluations') is not null as phase4c_evaluations_ok,
  to_regclass('public.player_evaluation_scores') is not null as phase4c_scores_ok,
  to_regclass('public.saas_entitlement_catalog') is not null as saas_entitlements_ok,
  to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is not null as entitlement_rpc_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_guard_ok;
