-- =============================================================================
-- IQBasket v3 · PHASE 3F POST-APPLY VERIFICATION · READ ONLY
-- Date: 2026-09-03
-- =============================================================================

with defs as (
  select
    pg_get_functiondef(to_regprocedure('public.iq_v3_can_manage_team_season(uuid)')) as general_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)')) as seed_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)')) as set_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)')) as remove_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)')) as create_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_can_request_transfer(uuid)')) as request_def
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
  'PHASE3F_POST_APPLY' as section,
  to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null as roster_helper_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_v3_can_manage_roster(uuid)',
    'EXECUTE'
  ) as authenticated_execute_ok,
  position('ENTRENADOR' in general_def) = 0
    and position('AYUDANTE' in general_def) = 0
    as general_admin_helper_not_broadened,
  position('iq_v3_can_manage_roster(p_team_season_id)' in seed_def) > 0 as seed_uses_roster_helper,
  position('iq_v3_can_manage_roster(p_team_season_id)' in set_def) > 0 as set_uses_roster_helper,
  position('iq_v3_can_manage_roster(p_team_season_id)' in remove_def) > 0 as remove_uses_roster_helper,
  position('iq_v3_can_manage_roster(p_team_season_id)' in create_def) > 0 as create_uses_roster_helper,
  position('iq_v3_can_manage_roster(p_to_team_season_id)' in request_def) > 0 as request_uses_roster_helper,
  to_regprocedure('public.iq_v3_can_approve_transfer_request()') is not null as approval_helper_ok,
  to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null as market_directory_ok,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.roster_transfer_requests) as transfer_requests,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null
    and has_function_privilege(
      'authenticated',
      'public.iq_v3_can_manage_roster(uuid)',
      'EXECUTE'
    )
    and position('ENTRENADOR' in general_def) = 0
    and position('AYUDANTE' in general_def) = 0
    and position('iq_v3_can_manage_roster(p_team_season_id)' in seed_def) > 0
    and position('iq_v3_can_manage_roster(p_team_season_id)' in set_def) > 0
    and position('iq_v3_can_manage_roster(p_team_season_id)' in remove_def) > 0
    and position('iq_v3_can_manage_roster(p_team_season_id)' in create_def) > 0
    and position('iq_v3_can_manage_roster(p_to_team_season_id)' in request_def) > 0
    and to_regprocedure('public.iq_v3_can_approve_transfer_request()') is not null
    and to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase3f_ok
from defs
cross join integrity i;
