-- =============================================================================
-- IQBasket Player 360 Phase 4G - post-rollback verification (READ ONLY)
-- Confirms that rollback removes only Phase 4G and restores the Phase 4D save
-- boundary without altering longitudinal evidence or existing AI insights.
-- =============================================================================

\set ON_ERROR_STOP on

select
  to_regclass('public.ai_gateway_role_limits') is null as role_limits_absent,
  to_regclass('public.player_ai_gateway_requests') is null as request_audit_absent,
  to_regprocedure('public.iq_v4g_prepare_ai_gateway_request(uuid,text,text,text,text,text,text,text,text)') is null as prepare_rpc_absent,
  to_regprocedure('public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint)') is null as complete_rpc_absent,
  not exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='player_ai_insights'
      and column_name='ai_gateway_request_id'
  ) as gateway_trace_absent,
  to_regclass('public.player_longitudinal_snapshots') is not null as snapshots_preserved,
  to_regclass('public.player_ai_insights') is not null as insights_preserved,
  to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is not null as phase4d_ai_rbac_preserved,
  to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as phase4e_abac_preserved,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)',
    'EXECUTE'
  ) as legacy_save_restored;
