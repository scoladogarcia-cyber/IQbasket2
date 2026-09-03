-- =============================================================================
-- IQBasket v4 · Phase 4C · Rollback Evaluation + Objective Profile
-- Date: 2026-09-03
-- Removes only Phase 4C objects. Existing v3 / 4A / 4B objects are preserved.
-- =============================================================================

begin;

drop function if exists public.iq_v4_evaluation_capabilities();
drop function if exists public.iq_v4_get_player_objective_gap(uuid);
drop function if exists public.iq_v4_archive_objective_profile(uuid);
drop function if exists public.iq_v4_save_objective_profile(
  uuid,uuid,date,date,text,text,jsonb,jsonb,jsonb,uuid
);
drop function if exists public.iq_v4_archive_player_evaluation(uuid);
drop function if exists public.iq_v4_save_player_evaluation(
  uuid,uuid,date,text,text,text,text,text,text,text,boolean,boolean,jsonb,jsonb,jsonb,uuid
);
drop function if exists public.iq_v4_upsert_evaluation_metric(
  uuid,text,text,text,text,numeric,numeric,numeric,boolean,text,boolean,integer
);
drop function if exists public.iq_v4_list_evaluation_metrics(uuid);

drop table if exists public.player_objective_targets cascade;
drop table if exists public.player_objective_profiles cascade;
drop table if exists public.player_evaluation_scores cascade;
drop table if exists public.player_evaluations cascade;
drop table if exists public.player360_evaluation_metrics cascade;

drop function if exists public.iq_v4_can_manage_objective_profile(uuid);
drop function if exists public.iq_v4_can_view_private_evaluation(uuid);
drop function if exists public.iq_v4_can_manage_evaluation(uuid);

commit;

select
  'PLAYER360_PHASE4C_ROLLBACK' as section,
  to_regclass('public.player360_evaluation_metrics') is null as metrics_removed,
  to_regclass('public.player_evaluations') is null as evaluations_removed,
  to_regclass('public.player_evaluation_scores') is null as scores_removed,
  to_regclass('public.player_objective_profiles') is null as profiles_removed,
  to_regclass('public.player_objective_targets') is null as targets_removed,
  to_regclass('public.training_sessions') is not null as phase4b_preserved,
  to_regclass('public.roster_membership_stints') is not null as v3_preserved;
