-- =============================================================================
-- IQBasket v4 · Phase 4D Longitudinal + AI · PRE-FLIGHT READ ONLY
-- Date: 2026-09-03
-- =============================================================================

with prerequisites as (
  select
    to_regclass('public.team_seasons') is not null as team_seasons_ok,
    to_regclass('public.roster_memberships') is not null as roster_ok,
    to_regclass('public.roster_membership_stints') is not null as roster_stints_ok,
    to_regclass('public.analytics_runs') is not null as analytics_runs_ok,
    to_regclass('public.training_sessions') is not null as training_ok,
    to_regclass('public.player_evaluations') is not null as evaluations_ok,
    to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is not null as view_scope_ok,
    to_regprocedure('public.iq_v4_can_manage_evaluation(uuid)') is not null as review_scope_ok,
    to_regprocedure('public.iq_v4_touch_updated_at()') is not null as touch_trigger_ok
),
future_objects as (
  select
    to_regclass('public.player_longitudinal_snapshots') is not null as snapshots_exists,
    to_regclass('public.player_ai_insights') is not null as insights_exists,
    to_regprocedure('public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)') is not null as save_snapshot_exists,
    to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is not null as save_insight_exists
),
integrity as (
  select
    (select count(*) from public.team_seasons) as team_seasons,
    (select count(*) from public.roster_memberships) as roster_memberships,
    (select count(*) from public.roster_membership_stints) as roster_stints,
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
    ) as invalid_game_stats
)
select
  'PLAYER360_PHASE4D_PREFLIGHT' as section,
  p.*,
  not f.snapshots_exists as snapshots_absent,
  not f.insights_exists as insights_absent,
  not f.save_snapshot_exists as save_snapshot_absent,
  not f.save_insight_exists as save_insight_absent,
  i.*,
  (
    p.team_seasons_ok
    and p.roster_ok
    and p.roster_stints_ok
    and p.analytics_runs_ok
    and p.training_ok
    and p.evaluations_ok
    and p.view_scope_ok
    and p.review_scope_ok
    and p.touch_trigger_ok
    and not f.snapshots_exists
    and not f.insights_exists
    and not f.save_snapshot_exists
    and not f.save_insight_exists
    and i.team_seasons > 0
    and i.roster_memberships > 0
    and i.invalid_game_stats = 0
  ) as safe_to_rehearse_phase4d
from prerequisites p
cross join future_objects f
cross join integrity i;
