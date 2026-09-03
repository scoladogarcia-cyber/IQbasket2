-- =============================================================================
-- IQBasket v4 · Phase 4D Longitudinal + AI · PRE-FLIGHT READ ONLY
-- Date: 2026-09-03
-- =============================================================================

with prerequisites as (
  select
    to_regclass('public.team_seasons') is not null as team_seasons_ok,
    to_regclass('public.teams') is not null as teams_ok,
    to_regclass('public.players') is not null as players_ok,
    to_regclass('public.user_profiles') is not null as user_profiles_ok,
    to_regclass('public.team_season_memberships') is not null as team_memberships_ok,
    to_regclass('public.club_season_memberships') is not null as club_memberships_ok,
    to_regclass('public.roster_memberships') is not null as roster_ok,
    to_regclass('public.roster_membership_stints') is not null as roster_stints_ok,
    to_regclass('public.analytics_runs') is not null as analytics_runs_ok,
    to_regclass('public.training_sessions') is not null as training_ok,
    to_regclass('public.player_evaluations') is not null as evaluations_ok,
    to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_helper_ok,
    to_regprocedure('public.iq_v4_touch_updated_at()') is not null as touch_trigger_ok
),
future_objects as (
  select
    to_regclass('public.player_longitudinal_snapshots') is not null as snapshots_exists,
    to_regclass('public.player_ai_insights') is not null as insights_exists,
    to_regprocedure('public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])') is not null as action_role_helper_exists,
    to_regprocedure('public.iq_v4_can_view_longitudinal_analytics(uuid)') is not null as view_longitudinal_exists,
    to_regprocedure('public.iq_v4_can_generate_longitudinal_analytics(uuid)') is not null as generate_longitudinal_exists,
    to_regprocedure('public.iq_v4_can_view_ai_insights(uuid)') is not null as view_ai_exists,
    to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is not null as generate_ai_exists,
    to_regprocedure('public.iq_v4_can_review_ai_insights(uuid)') is not null as review_ai_exists,
    to_regprocedure('public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)') is not null as save_snapshot_exists,
    to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is not null as save_insight_exists,
    to_regprocedure('public.iq_v4_review_ai_insight(uuid,text,text)') is not null as review_insight_exists,
    to_regprocedure('public.iq_v4_longitudinal_capabilities()') is not null as capabilities_exists
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
  not f.action_role_helper_exists as action_role_helper_absent,
  not f.view_longitudinal_exists as view_longitudinal_absent,
  not f.generate_longitudinal_exists as generate_longitudinal_absent,
  not f.view_ai_exists as view_ai_absent,
  not f.generate_ai_exists as generate_ai_absent,
  not f.review_ai_exists as review_ai_absent,
  not f.save_snapshot_exists as save_snapshot_absent,
  not f.save_insight_exists as save_insight_absent,
  not f.review_insight_exists as review_insight_absent,
  not f.capabilities_exists as capabilities_absent,
  i.*,
  (
    p.team_seasons_ok
    and p.teams_ok
    and p.players_ok
    and p.user_profiles_ok
    and p.team_memberships_ok
    and p.club_memberships_ok
    and p.roster_ok
    and p.roster_stints_ok
    and p.analytics_runs_ok
    and p.training_ok
    and p.evaluations_ok
    and p.superadmin_helper_ok
    and p.touch_trigger_ok
    and not f.snapshots_exists
    and not f.insights_exists
    and not f.action_role_helper_exists
    and not f.view_longitudinal_exists
    and not f.generate_longitudinal_exists
    and not f.view_ai_exists
    and not f.generate_ai_exists
    and not f.review_ai_exists
    and not f.save_snapshot_exists
    and not f.save_insight_exists
    and not f.review_insight_exists
    and not f.capabilities_exists
    and i.team_seasons > 0
    and i.roster_memberships > 0
    and i.invalid_game_stats = 0
  ) as safe_to_rehearse_phase4d
from prerequisites p
cross join future_objects f
cross join integrity i;
