-- =============================================================================
-- IQBasket v4 · Phase 4C Evaluation + Objective Profile · PRE-FLIGHT READ ONLY
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
),
phase4b as (
  select
    to_regclass('public.training_sessions') is not null as training_sessions_ok,
    to_regclass('public.training_participants') is not null as training_participants_ok,
    to_regclass('public.external_development_sessions') is not null as external_development_ok,
    to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is not null as view_scope_ok,
    to_regprocedure('public.iq_v4_training_capabilities()') is not null as training_capabilities_ok
),
future_objects as (
  select
    to_regclass('public.player360_evaluation_metrics') is not null as metrics_exists,
    to_regclass('public.player_evaluations') is not null as evaluations_exists,
    to_regclass('public.player_evaluation_scores') is not null as scores_exists,
    to_regclass('public.player_objective_profiles') is not null as profiles_exists,
    to_regclass('public.player_objective_targets') is not null as targets_exists
),
scope as (
  select
    (select count(*) from public.team_seasons) as team_seasons,
    (
      select count(*)
      from public.roster_membership_stints rms
      where rms.valid_until is null
    ) as open_roster_stints,
    (select count(*) from public.roster_memberships) as roster_memberships,
    (select count(*) from public.roster_membership_stints) as roster_stints,
    (select count(*) from public.training_sessions) as training_sessions,
    (select count(*) from public.external_development_sessions) as external_development_sessions
)
select
  'PLAYER360_PHASE4C_PREFLIGHT' as section,
  p.training_sessions_ok,
  p.training_participants_ok,
  p.external_development_ok,
  p.view_scope_ok,
  p.training_capabilities_ok,
  not f.metrics_exists as metrics_absent,
  not f.evaluations_exists as evaluations_absent,
  not f.scores_exists as scores_absent,
  not f.profiles_exists as profiles_absent,
  not f.targets_exists as targets_absent,
  s.team_seasons,
  s.open_roster_stints,
  s.roster_memberships,
  s.roster_stints,
  s.training_sessions,
  s.external_development_sessions,
  i.invalid_stats,
  i.invalid_events,
  (
    p.training_sessions_ok
    and p.training_participants_ok
    and p.external_development_ok
    and p.view_scope_ok
    and p.training_capabilities_ok
    and not f.metrics_exists
    and not f.evaluations_exists
    and not f.scores_exists
    and not f.profiles_exists
    and not f.targets_exists
    and s.team_seasons > 0
    and s.roster_memberships > 0
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as safe_to_design_phase4c
from integrity i
cross join phase4b p
cross join future_objects f
cross join scope s;
