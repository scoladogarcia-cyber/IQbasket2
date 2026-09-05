-- =============================================================================
-- IQBasket V1 - Hot-path FK index hardening
-- Date: 2026-09-05
-- Purpose:
--   * add only the missing FK-leading indexes used by V1 hot paths;
--   * improve delete/update checks and common player/game lookups;
--   * avoid broad historical-index cleanup in the release-critical path.
--
-- Scope is intentionally limited to:
--   games, play_by_play_events, lineup_game_stats, player_game_stats,
--   player_goals, player_notes, user_profiles, player360_wellness_entries,
--   and training_participants.
-- =============================================================================

begin;

create index if not exists games_team_id_fk_idx
  on public.games(team_id);
create index if not exists games_season_id_fk_idx
  on public.games(season_id);

create index if not exists play_by_play_events_game_id_fk_idx
  on public.play_by_play_events(game_id);
create index if not exists play_by_play_events_player_id_fk_idx
  on public.play_by_play_events(player_id);

create index if not exists lineup_game_stats_game_id_fk_idx
  on public.lineup_game_stats(game_id);
create index if not exists player_game_stats_player_id_fk_idx
  on public.player_game_stats(player_id);

create index if not exists player_goals_player_id_fk_idx
  on public.player_goals(player_id);
create index if not exists player_notes_player_id_fk_idx
  on public.player_notes(player_id);
create index if not exists user_profiles_linked_player_id_fk_idx
  on public.user_profiles(linked_player_id);

create index if not exists player360_wellness_entries_player_id_fk_idx
  on public.player360_wellness_entries(player_id);

create index if not exists training_participants_session_scope_fk_idx
  on public.training_participants(training_session_id,team_season_id);

-- Apply-time assertions. These are intentionally structural: no data mutation is
-- required for this hardening and all indexes are additive/idempotent.
do $verify$
begin
  if to_regclass('public.games_team_id_fk_idx') is null
     or to_regclass('public.games_season_id_fk_idx') is null
     or to_regclass('public.play_by_play_events_game_id_fk_idx') is null
     or to_regclass('public.play_by_play_events_player_id_fk_idx') is null
     or to_regclass('public.lineup_game_stats_game_id_fk_idx') is null
     or to_regclass('public.player_game_stats_player_id_fk_idx') is null
     or to_regclass('public.player_goals_player_id_fk_idx') is null
     or to_regclass('public.player_notes_player_id_fk_idx') is null
     or to_regclass('public.user_profiles_linked_player_id_fk_idx') is null
     or to_regclass('public.player360_wellness_entries_player_id_fk_idx') is null
     or to_regclass('public.training_participants_session_scope_fk_idx') is null then
    raise exception 'V1_HOTPATH_FK_INDEX_MISSING';
  end if;
end
$verify$;

commit;
