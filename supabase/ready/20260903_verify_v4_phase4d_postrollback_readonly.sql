-- =============================================================================
-- IQBasket v4 · Phase 4D Post-Rollback Verification · READ ONLY
-- Date: 2026-09-03
-- =============================================================================

with integrity as (
  select
    (
      select count(*)
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          pgs.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_stats,
    (
      select count(*)
      from public.game_events ge
      join public.games g on g.id = ge.game_id
      where ge.player_id is not null
        and g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          ge.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_events
)
select
  'PLAYER360_PHASE4D_POST_ROLLBACK' as section,
  to_regclass('public.player_longitudinal_snapshots') is null as snapshots_absent,
  to_regclass('public.player_ai_insights') is null as insights_absent,
  to_regprocedure('public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])') is null as action_role_helper_absent,
  to_regprocedure('public.iq_v4_can_view_longitudinal_analytics(uuid)') is null as view_longitudinal_absent,
  to_regprocedure('public.iq_v4_can_generate_longitudinal_analytics(uuid)') is null as generate_longitudinal_absent,
  to_regprocedure('public.iq_v4_can_view_ai_insights(uuid)') is null as view_ai_absent,
  to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is null as generate_ai_absent,
  to_regprocedure('public.iq_v4_can_review_ai_insights(uuid)') is null as review_ai_absent,
  to_regprocedure('public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)') is null as save_snapshot_absent,
  to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is null as save_ai_absent,
  to_regprocedure('public.iq_v4_review_ai_insight(uuid,text,text)') is null as review_ai_rpc_absent,
  to_regclass('public.player_evaluations') is not null as phase4c_evaluations_preserved,
  to_regclass('public.player_objective_profiles') is not null as phase4c_objectives_preserved,
  to_regclass('public.training_sessions') is not null as phase4b_training_preserved,
  to_regclass('public.external_development_sessions') is not null as phase4b_external_preserved,
  to_regclass('public.roster_membership_stints') is not null as v3_roster_preserved,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regclass('public.player_longitudinal_snapshots') is null
    and to_regclass('public.player_ai_insights') is null
    and to_regprocedure('public.iq_v4_can_generate_longitudinal_analytics(uuid)') is null
    and to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is null
    and to_regprocedure('public.iq_v4_can_review_ai_insights(uuid)') is null
    and to_regclass('public.player_evaluations') is not null
    and to_regclass('public.player_objective_profiles') is not null
    and to_regclass('public.training_sessions') is not null
    and to_regclass('public.external_development_sessions') is not null
    and to_regclass('public.roster_membership_stints') is not null
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase4d_rollback_clean
from integrity i;
