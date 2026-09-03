-- =============================================================================
-- IQBasket v3 · PHASE 3E PREFLIGHT · SECURE TRANSFER MARKET (READ ONLY)
-- Date: 2026-09-02
-- =============================================================================

with candidate_targets as (
  select
    target.id as target_team_season_id,
    count(*) as candidate_rows
  from public.team_seasons target
  join public.team_seasons src
    on src.season_id = target.season_id
   and src.id <> target.id
  join public.roster_memberships rm
    on rm.team_season_id = src.id
  join public.roster_membership_stints rs
    on rs.roster_membership_id = rm.id
   and rs.valid_until is null
  group by target.id
),
integrity as (
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
  'PHASE3E_PREFLIGHT' as section,
  to_regclass('public.roster_transfer_requests') is not null
    as phase3d_table_ok,
  to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is not null
    as phase3d_request_auth_ok,
  to_regprocedure('public.iq_v3_transfer_request_capabilities()') is not null
    as phase3d_capabilities_ok,
  to_regclass('public.roster_membership_stints') is not null
    as phase3c_stints_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    as phase3c_eligibility_ok,
  i.invalid_stats,
  i.invalid_events,
  (select count(*) from candidate_targets where candidate_rows > 0)
    as targets_with_market_candidates,
  coalesce((select max(candidate_rows) from candidate_targets), 0)
    as max_market_candidates_for_one_target,
  to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    as market_directory_function_exists,
  (
    to_regclass('public.roster_transfer_requests') is not null
    and to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is not null
    and to_regprocedure('public.iq_v3_transfer_request_capabilities()') is not null
    and to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    and i.invalid_stats = 0
    and i.invalid_events = 0
    and to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is null
  ) as safe_to_apply_phase3e,
  (
    coalesce((select max(candidate_rows) from candidate_targets), 0) > 0
  ) as can_rehearse_market_directory
from integrity i;
