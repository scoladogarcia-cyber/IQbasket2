-- =============================================================================
-- IQBasket v4 · Phase 4B Preflight · READ ONLY
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
eligible_scopes as (
  select count(distinct rm.team_season_id) as scopes_with_eligible_players
  from public.roster_memberships rm
  join public.roster_membership_stints rs
    on rs.roster_membership_id = rm.id
  where rs.valid_from is not null
)
select
  'PLAYER360_PHASE4B_PREFLIGHT' as section,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regclass('public.roster_memberships') is not null as roster_memberships_ok,
  to_regclass('public.roster_membership_stints') is not null as roster_stints_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null as eligibility_helper_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_helper_ok,
  i.invalid_stats,
  i.invalid_events,
  e.scopes_with_eligible_players,
  to_regclass('public.training_sessions') is null as training_sessions_absent,
  to_regclass('public.training_blocks') is null as training_blocks_absent,
  to_regclass('public.training_participants') is null as training_participants_absent,
  to_regclass('public.external_development_sessions') is null as external_development_absent,
  to_regclass('public.player360_activity_types') is null as activity_catalog_absent,
  (
    to_regclass('public.team_seasons') is not null
    and to_regclass('public.roster_memberships') is not null
    and to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    and to_regprocedure('public.iq_v3_is_global_superadmin()') is not null
    and i.invalid_stats = 0
    and i.invalid_events = 0
    and e.scopes_with_eligible_players > 0
    and to_regclass('public.training_sessions') is null
    and to_regclass('public.training_blocks') is null
    and to_regclass('public.training_participants') is null
    and to_regclass('public.external_development_sessions') is null
    and to_regclass('public.player360_activity_types') is null
  ) as safe_to_rehearse_phase4b
from integrity i
cross join eligible_scopes e;
