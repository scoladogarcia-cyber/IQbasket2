-- =============================================================================
-- IQBasket v4 · Phase 4D · Rollback Longitudinal Analytics + AI Evidence
-- Date: 2026-09-03
-- Removes only Phase 4D objects. Existing v3 / 4A / 4B / 4C objects are preserved.
-- =============================================================================

begin;

drop function if exists public.iq_v4_longitudinal_capabilities();
drop function if exists public.iq_v4_review_ai_insight(uuid,text,text);
drop function if exists public.iq_v4_save_ai_insight(
  uuid,text,text,text,text,text,jsonb
);
drop function if exists public.iq_v4_save_longitudinal_snapshot(
  uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer
);

drop table if exists public.player_ai_insights cascade;
drop table if exists public.player_longitudinal_snapshots cascade;

drop function if exists public.iq_v4_can_review_ai_insights(uuid);
drop function if exists public.iq_v4_can_generate_ai_insights(uuid);
drop function if exists public.iq_v4_can_view_ai_insights(uuid);
drop function if exists public.iq_v4_can_generate_longitudinal_analytics(uuid);
drop function if exists public.iq_v4_can_view_longitudinal_analytics(uuid);
drop function if exists public.iq_v4_has_player360_action_role(uuid,text[],text[],text[]);

commit;

select
  'PLAYER360_PHASE4D_ROLLBACK' as section,
  to_regclass('public.player_longitudinal_snapshots') is null as snapshots_removed,
  to_regclass('public.player_ai_insights') is null as insights_removed,
  to_regprocedure('public.iq_v4_can_generate_longitudinal_analytics(uuid)') is null as analytics_guard_removed,
  to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is null as generate_ai_guard_removed,
  to_regprocedure('public.iq_v4_can_review_ai_insights(uuid)') is null as review_ai_guard_removed,
  to_regclass('public.player_evaluations') is not null as phase4c_preserved,
  to_regclass('public.training_sessions') is not null as phase4b_preserved,
  to_regclass('public.roster_membership_stints') is not null as v3_preserved;
