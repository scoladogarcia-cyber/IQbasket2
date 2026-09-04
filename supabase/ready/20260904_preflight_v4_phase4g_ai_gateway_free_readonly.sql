-- =============================================================================
-- IQBasket Player 360 Phase 4G - FREE_ONLY AI Gateway preflight (READ ONLY)
-- Confirms the installed privacy/longitudinal foundations before Phase 4G.
-- =============================================================================

\set ON_ERROR_STOP on

select
  to_regclass('public.player_longitudinal_snapshots') is not null as snapshots_ok,
  to_regclass('public.player_ai_insights') is not null as insights_ok,
  to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is not null as ai_rbac_ok,
  to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as restricted_abac_ok,
  to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is not null as legacy_ai_save_exists,
  to_regclass('public.ai_gateway_role_limits') is null as role_limits_absent,
  to_regclass('public.player_ai_gateway_requests') is null as request_audit_absent,
  not exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='player_ai_insights'
      and column_name='ai_gateway_request_id'
  ) as gateway_trace_absent;
