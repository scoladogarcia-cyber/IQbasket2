-- =============================================================================
-- IQBasket v3 · PHASE 3D POST-SMOKE VERIFICATION (READ ONLY)
-- Date: 2026-09-02
--
-- Run immediately after:
--   20260902_smoke_v3_phase3d_transfer_workflow_rollback.sql
--
-- Expected:
-- - Phase 3D remains installed.
-- - No ZZ_SMOKE_3D synthetic player/request persists.
-- - Phase 3C integrity remains clean.
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
synthetic as (
  select
    (select count(*)
       from public.players p
      where p.first_name = 'ZZ_SMOKE_3D'
        and p.last_name = 'TEMP_PLAYER') as synthetic_players,
    (select count(*)
       from public.roster_transfer_requests r
       join public.players p on p.id = r.player_id
      where p.first_name = 'ZZ_SMOKE_3D'
        and p.last_name = 'TEMP_PLAYER') as synthetic_requests
)
select
  'PHASE3D_POST_SMOKE' as section,
  to_regclass('public.roster_transfer_requests') is not null
    as transfer_requests_table_present,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    as request_function_present,
  to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    as approve_function_present,
  to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    as reject_function_present,
  s.synthetic_players,
  s.synthetic_requests,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.roster_transfer_requests) as transfer_requests,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regclass('public.roster_transfer_requests') is not null
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    and to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    and to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    and s.synthetic_players = 0
    and s.synthetic_requests = 0
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase3d_smoke_clean
from integrity i
cross join synthetic s;
