-- =============================================================================
-- IQBasket V5 · Game locking preflight (READ ONLY)
-- Purpose: verify the installed database can support immutable closed games
-- without changing schema or data.
-- =============================================================================

with checks as (
  select
    to_regclass('public.games') is not null as games_table_ok,
    to_regclass('public.player_game_stats') is not null as player_stats_table_ok,
    to_regclass('public.team_game_stats') is not null as team_stats_table_ok,
    to_regclass('public.game_events') is not null as game_events_table_ok,
    to_regclass('public.game_period_scores') is not null as period_scores_table_ok,
    to_regclass('public.lineup_game_stats') is not null as lineup_stats_table_ok,
    to_regclass('public.play_by_play_events') is not null as play_by_play_table_ok,
    to_regprocedure('public.iq_v3_is_superadmin()') is not null as superadmin_helper_ok,
    to_regprocedure('public.iq_v3_has_team_season_role(uuid,text[])') is not null as team_role_helper_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='games' and column_name='team_season_id'
    ) as game_team_season_ok
)
select
  'GAME_LOCK_PREFLIGHT' as section,
  games_table_ok,
  player_stats_table_ok,
  team_stats_table_ok,
  game_events_table_ok,
  period_scores_table_ok,
  lineup_stats_table_ok,
  play_by_play_table_ok,
  superadmin_helper_ok,
  team_role_helper_ok,
  game_team_season_ok,
  (
    games_table_ok
    and player_stats_table_ok
    and team_stats_table_ok
    and game_events_table_ok
    and period_scores_table_ok
    and lineup_stats_table_ok
    and play_by_play_table_ok
    and superadmin_helper_ok
    and team_role_helper_ok
    and game_team_season_ok
  ) as ok
from checks;

select
  'GAME_LOCK_BASELINE' as section,
  (select count(*) from public.games) as games,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.team_game_stats) as team_game_stats,
  (select count(*) from public.game_events) as game_events,
  (select count(*) from public.game_period_scores) as game_period_scores,
  (select count(*) from public.lineup_game_stats) as lineup_game_stats,
  (select count(*) from public.play_by_play_events) as play_by_play_events;
