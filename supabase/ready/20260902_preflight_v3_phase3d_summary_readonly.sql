-- =============================================================================
-- IQBasket v3 · PHASE 3D PRE-FLIGHT SUMMARY (READ ONLY)
-- Date: 2026-09-02
--
-- PURPOSE
-- Decide whether the persistent transfer-request workflow can be rehearsed and
-- later applied safely on the current database.
--
-- READ ONLY: no CREATE / INSERT / UPDATE / DELETE.
-- =============================================================================

with
phase3c_integrity as (
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
season_pairs as (
  select
    ts.season_id,
    count(*) as team_seasons
  from public.team_seasons ts
  group by ts.season_id
  having count(*) >= 2
),
transferable_candidates as (
  select count(*) as candidate_count
  from public.roster_memberships rm
  join public.team_seasons src on src.id = rm.team_season_id
  where exists (
    select 1
    from public.team_seasons dst
    where dst.season_id = src.season_id
      and dst.id <> src.id
  )
),
superadmins as (
  select count(*) as superadmin_count
  from public.user_profiles up
  where upper(coalesce(up.global_role, '')) = 'SUPERADMIN'
)
select
  'PHASE3D_PREFLIGHT_SUMMARY' as section,

  -- Required schema / Phase 3C
  to_regclass('public.players') is not null as players_ok,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regclass('public.roster_memberships') is not null as roster_memberships_ok,
  to_regclass('public.roster_membership_stints') is not null as roster_stints_ok,
  to_regclass('public.user_profiles') is not null as user_profiles_ok,

  to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    as transfer_rpc_ok,
  to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null
    as manage_scope_helper_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null
    as superadmin_helper_ok,
  to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is not null
    as participation_helper_ok,

  -- Existing Phase-3C integrity
  p3.invalid_stats as invalid_stats,
  p3.invalid_events as invalid_events,

  -- Data needed to rehearse a real transfer
  (select count(*) from season_pairs) as seasons_with_two_or_more_teams,
  tc.candidate_count as transferable_memberships,
  sa.superadmin_count,

  -- Phase 3D must be absent before first application
  to_regclass('public.roster_transfer_requests') is not null
    as transfer_requests_table_exists,
  to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is not null
    as can_request_function_exists,
  to_regprocedure('public.iq_v3_can_approve_transfer_request()') is not null
    as can_approve_function_exists,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    as request_function_exists,
  to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    as approve_function_exists,
  to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    as reject_function_exists,

  (
    to_regclass('public.players') is not null
    and to_regclass('public.team_seasons') is not null
    and to_regclass('public.roster_memberships') is not null
    and to_regclass('public.roster_membership_stints') is not null
    and to_regclass('public.user_profiles') is not null
    and to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    and to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null
    and to_regprocedure('public.iq_v3_is_global_superadmin()') is not null
    and to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is not null
    and p3.invalid_stats = 0
    and p3.invalid_events = 0
    and sa.superadmin_count >= 1
    and to_regclass('public.roster_transfer_requests') is null
    and to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is null
    and to_regprocedure('public.iq_v3_can_approve_transfer_request()') is null
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is null
    and to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is null
    and to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is null
  ) as safe_to_apply_phase3d,

  (
    (select count(*) from season_pairs) >= 1
    and tc.candidate_count >= 1
    and sa.superadmin_count >= 1
  ) as can_run_transfer_rehearsal
from phase3c_integrity p3
cross join transferable_candidates tc
cross join superadmins sa;
