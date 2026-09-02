-- =============================================================================
-- IQBasket v3 · PHASE 3D POST-ROLLBACK VERIFICATION (READ ONLY)
-- Date: 2026-09-02
--
-- Run immediately after:
--   20260902_rehearse_v3_phase3d_transfer_requests_rollback.sql
--
-- Expected:
-- - every Phase-3D-only object is absent again
-- - Phase 3C remains installed and valid
-- =============================================================================

with phase3c_integrity as (
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
  'PHASE3D_POST_ROLLBACK' as section,

  -- Phase 3D should be absent again
  to_regclass('public.roster_transfer_requests') is null
    as transfer_requests_table_absent,
  to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is null
    as can_request_function_absent,
  to_regprocedure('public.iq_v3_can_approve_transfer_request()') is null
    as can_approve_function_absent,
  to_regprocedure('public.iq_v3_transfer_request_capabilities()') is null
    as capabilities_function_absent,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is null
    as request_function_absent,
  to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is null
    as approve_function_absent,
  to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is null
    as reject_function_absent,

  -- Phase 3C must remain present
  to_regclass('public.roster_membership_stints') is not null
    as phase3c_stints_present,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    as phase3c_eligibility_present,
  to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    as phase3c_transfer_present,

  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  p3.invalid_stats as invalid_stats_after_rollback,
  p3.invalid_events as invalid_events_after_rollback,

  (
    to_regclass('public.roster_transfer_requests') is null
    and to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is null
    and to_regprocedure('public.iq_v3_can_approve_transfer_request()') is null
    and to_regprocedure('public.iq_v3_transfer_request_capabilities()') is null
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is null
    and to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is null
    and to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is null
    and to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    and to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    and p3.invalid_stats = 0
    and p3.invalid_events = 0
  ) as phase3d_rollback_clean
from phase3c_integrity p3;
