-- =============================================================================
-- IQBasket V5 · Game locking preflight (READ ONLY)
-- Verifies only stable tables/columns used by the self-contained contextual RBAC.
-- =============================================================================

with checks as (
  select
    to_regclass('public.games') is not null as games_table_ok,
    to_regclass('public.teams') is not null as teams_table_ok,
    to_regclass('public.user_profiles') is not null as profiles_table_ok,
    to_regclass('public.team_seasons') is not null as team_seasons_table_ok,
    to_regclass('public.team_season_memberships') is not null as memberships_table_ok,
    to_regclass('public.player_game_stats') is not null as player_stats_table_ok,
    to_regclass('public.team_game_stats') is not null as team_stats_table_ok,
    to_regclass('public.game_events') is not null as game_events_table_ok,
    to_regclass('public.game_period_scores') is not null as period_scores_table_ok,
    to_regclass('public.lineup_game_stats') is not null as lineup_stats_table_ok,
    to_regclass('public.play_by_play_events') is not null as play_by_play_table_ok,
    not exists (
      select 1
      from (values ('id'),('email'),('role')) as required_columns(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name='user_profiles'
          and c.column_name=required_columns.column_name
      )
    ) as profile_identity_columns_ok,
    not exists (
      select 1
      from (values ('id'),('team_id')) as required_columns(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name='team_seasons'
          and c.column_name=required_columns.column_name
      )
    ) as team_season_columns_ok,
    not exists (
      select 1
      from (values ('user_id'),('team_season_id'),('function_role'),('status')) as required_columns(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name='team_season_memberships'
          and c.column_name=required_columns.column_name
      )
    ) as membership_columns_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='games' and column_name='team_id'
    ) as game_team_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='games' and column_name='team_season_id'
    ) as game_team_season_ok,
    not exists (
      select 1
      from (values
        ('player_game_stats'),
        ('team_game_stats'),
        ('game_events'),
        ('game_period_scores'),
        ('lineup_game_stats'),
        ('play_by_play_events')
      ) as required_tables(table_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name=required_tables.table_name
          and c.column_name='game_id'
      )
    ) as child_game_id_columns_ok
)
select
  'GAME_LOCK_PREFLIGHT' as section,
  games_table_ok,
  teams_table_ok,
  profiles_table_ok,
  team_seasons_table_ok,
  memberships_table_ok,
  player_stats_table_ok,
  team_stats_table_ok,
  game_events_table_ok,
  period_scores_table_ok,
  lineup_stats_table_ok,
  play_by_play_table_ok,
  profile_identity_columns_ok,
  team_season_columns_ok,
  membership_columns_ok,
  game_team_ok,
  game_team_season_ok,
  child_game_id_columns_ok,
  (
    games_table_ok
    and teams_table_ok
    and profiles_table_ok
    and team_seasons_table_ok
    and memberships_table_ok
    and player_stats_table_ok
    and team_stats_table_ok
    and game_events_table_ok
    and period_scores_table_ok
    and lineup_stats_table_ok
    and play_by_play_table_ok
    and profile_identity_columns_ok
    and team_season_columns_ok
    and membership_columns_ok
    and game_team_ok
    and game_team_season_ok
    and child_game_id_columns_ok
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
