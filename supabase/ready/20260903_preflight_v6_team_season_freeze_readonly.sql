-- IQBasket V6 · TEAM-SEASON FREEZE PREFLIGHT · READ ONLY
with checks as (
  select
    to_regclass('public.team_seasons') is not null as team_seasons_ok,
    to_regclass('public.games') is not null as games_ok,
    to_regclass('public.roster_memberships') is not null as roster_memberships_ok,
    to_regclass('public.roster_membership_stints') is not null as roster_stints_ok,
    to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null as roster_helper_ok,
    to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null as season_manage_helper_ok,
    to_regprocedure('public.iq_v5_set_game_edit_state(uuid,text,text)') is not null as game_lock_rpc_ok,
    to_regprocedure('public.iq_v5_role_for_game(uuid)') is not null as game_role_helper_ok,
    to_regprocedure('public.iq_v5_current_role()') is not null as current_role_helper_ok,
    not exists (
      select 1
      from public.team_seasons
      where upper(coalesce(data_status,'ACTIVE')) not in ('ACTIVE','FROZEN')
    ) as data_status_domain_ok,
    not exists (
      select 1
      from public.games
      where team_season_id is null
    ) as games_scoped_ok
)
select
  'TEAM_SEASON_FREEZE_PREFLIGHT' as section,
  *,
  team_seasons_ok
    and games_ok
    and roster_memberships_ok
    and roster_stints_ok
    and roster_helper_ok
    and season_manage_helper_ok
    and game_lock_rpc_ok
    and game_role_helper_ok
    and current_role_helper_ok
    and data_status_domain_ok
    and games_scoped_ok as all_ok
from checks;

select
  'TEAM_SEASON_FREEZE_BASELINE' as section,
  (select count(*) from public.team_seasons) as team_seasons,
  (select count(*) from public.team_seasons where upper(coalesce(data_status,'ACTIVE'))='FROZEN') as frozen_team_seasons,
  (select count(*) from public.games) as games,
  (select count(*) from public.games where upper(coalesce(edit_state,'OPEN'))='OPEN') as open_games,
  (select count(*) from public.games where upper(coalesce(edit_state,'OPEN'))='LOCKED') as locked_games,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events;
