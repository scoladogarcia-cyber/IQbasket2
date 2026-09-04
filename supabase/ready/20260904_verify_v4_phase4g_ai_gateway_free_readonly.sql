-- =============================================================================
-- IQBasket Player 360 Phase 4G - FREE_ONLY AI Gateway verification (READ ONLY)
-- =============================================================================

\set ON_ERROR_STOP on

select
  to_regclass('public.ai_gateway_role_limits') is not null as role_limits_ok,
  to_regclass('public.player_ai_gateway_requests') is not null as request_audit_ok,
  to_regprocedure('public.iq_v4g_prepare_ai_gateway_request(uuid,text,text,text,text,text,text,text,text)') is not null as prepare_rpc_ok,
  to_regprocedure('public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint)') is not null as complete_rpc_ok,
  to_regprocedure('public.iq_v4g_fail_ai_gateway_request(uuid,text)') is not null as fail_rpc_ok,
  to_regprocedure('public.iq_v4g_detect_sensitive_modules(jsonb)') is not null as sensitive_detection_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='player_ai_insights'
      and column_name='ai_gateway_request_id'
  ) as insight_trace_ok,
  not has_function_privilege(
    'authenticated',
    'public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)',
    'EXECUTE'
  ) as legacy_direct_ai_write_closed,
  has_function_privilege(
    'authenticated',
    'public.iq_v4g_prepare_ai_gateway_request(uuid,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) as authenticated_prepare_ok,
  not has_function_privilege(
    'authenticated',
    'public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint)',
    'EXECUTE'
  ) as client_complete_blocked,
  has_function_privilege(
    'service_role',
    'public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint)',
    'EXECUTE'
  ) as service_complete_ok,
  (
    select count(*) = 9
    from public.ai_gateway_role_limits
  ) as role_limit_seed_ok,
  (
    select bool_and(estimated_cost_eur_micros = 0)
    from public.player_ai_gateway_requests
  ) is not false as zero_cost_rows_ok;
