-- =============================================================================
-- IQBasket Player 360 Phase 4G - FREE_ONLY AI Gateway rollback
-- Removes only Phase 4G objects and restores the Phase 4D authenticated save RPC.
-- =============================================================================

begin;

grant execute on function public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb) to authenticated;

drop function if exists public.iq_v4g_fail_ai_gateway_request(uuid,text);
drop function if exists public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint);
drop function if exists public.iq_v4g_prepare_ai_gateway_request(uuid,text,text,text,text,text,text,text,text);
drop function if exists public.iq_v4g_monthly_request_limit(uuid);
drop function if exists public.iq_v4g_detect_sensitive_modules(jsonb);

alter table if exists public.player_ai_insights
  drop constraint if exists player_ai_insights_gateway_request_fk,
  drop constraint if exists player_ai_insights_gateway_request_unique;

alter table if exists public.player_ai_gateway_requests
  drop constraint if exists player_ai_gateway_insight_fk;

drop table if exists public.player_ai_gateway_requests;
drop table if exists public.ai_gateway_role_limits;

alter table if exists public.player_ai_insights
  drop column if exists ai_gateway_request_id;

commit;
