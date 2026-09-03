-- =============================================================================
-- IQBasket v4 · Phase 4C Post-Rehearsal Verification · READ ONLY
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
  'PLAYER360_PHASE4C_POST_ROLLBACK' as section,
  to_regclass('public.player360_evaluation_metrics') is null as metrics_absent,
  to_regclass('public.player_evaluations') is null as evaluations_absent,
  to_regclass('public.player_evaluation_scores') is null as scores_absent,
  to_regclass('public.player_objective_profiles') is null as profiles_absent,
  to_regclass('public.player_objective_targets') is null as targets_absent,
  to_regclass('public.training_sessions') is not null as phase4b_training_preserved,
  to_regclass('public.external_development_sessions') is not null as phase4b_external_preserved,
  to_regclass('public.roster_membership_stints') is not null as v3_roster_preserved,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regclass('public.player360_evaluation_metrics') is null
    and to_regclass('public.player_evaluations') is null
    and to_regclass('public.player_evaluation_scores') is null
    and to_regclass('public.player_objective_profiles') is null
    and to_regclass('public.player_objective_targets') is null
    and to_regclass('public.training_sessions') is not null
    and to_regclass('public.external_development_sessions') is not null
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase4c_rollback_clean
from integrity i;
