import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../supabase/ready/20260905_apply_v1_hotpath_fk_indexes.sql', import.meta.url),
  'utf8',
);

const required = [
  ['games_team_id_fk_idx', 'public.games(team_id)'],
  ['games_season_id_fk_idx', 'public.games(season_id)'],
  ['play_by_play_events_game_id_fk_idx', 'public.play_by_play_events(game_id)'],
  ['play_by_play_events_player_id_fk_idx', 'public.play_by_play_events(player_id)'],
  ['lineup_game_stats_game_id_fk_idx', 'public.lineup_game_stats(game_id)'],
  ['player_game_stats_player_id_fk_idx', 'public.player_game_stats(player_id)'],
  ['player_goals_player_id_fk_idx', 'public.player_goals(player_id)'],
  ['player_notes_player_id_fk_idx', 'public.player_notes(player_id)'],
  ['user_profiles_linked_player_id_fk_idx', 'public.user_profiles(linked_player_id)'],
  ['player360_wellness_entries_player_id_fk_idx', 'public.player360_wellness_entries(player_id)'],
  ['training_participants_session_scope_fk_idx', 'public.training_participants(training_session_id,team_season_id)'],
];

for (const [indexName, expression] of required) {
  assert.match(sql, new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${indexName}`, 'i'));
  assert.ok(
    sql.replace(/\s+/g, '').toLowerCase().includes(expression.replace(/\s+/g, '').toLowerCase()),
    `${indexName} must lead with the expected FK column(s)`,
  );
}

assert.match(sql, /begin\s*;/i);
assert.match(sql, /commit\s*;/i);
assert.match(sql, /V1_HOTPATH_FK_INDEX_MISSING/);
assert.doesNotMatch(sql, /drop\s+(table|index|column)|delete\s+from|update\s+public\.|insert\s+into/i);

console.log('V1 hot-path FK index contract OK');
