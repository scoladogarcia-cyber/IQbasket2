-- IQBasket AI usage ledger V1 - targeted rollback
-- Removes Gate B metering only; Player 360 snapshots/insights remain intact.

begin;

drop function if exists public.iq_ai_fail_usage(uuid,uuid,text);
drop function if exists public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer);
drop function if exists public.iq_ai_mark_provider_started(uuid,uuid,text,text);
drop function if exists public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text);
drop function if exists public.iq_ai_monthly_units(uuid,text,date);

drop table if exists public.ai_usage_ledger;
drop function if exists public.iq_ai_touch_updated_at();

commit;

select
  'AI_USAGE_LEDGER_V1_ROLLBACK' as section,
  to_regclass('public.ai_usage_ledger') is null as ledger_removed,
  to_regclass('public.player_ai_insights') is not null as insights_preserved,
  to_regclass('public.player_longitudinal_snapshots') is not null as snapshots_preserved,
  to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is not null as phase4d_preserved;