import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/ready/20260905_apply_game_play_state_v2.sql", "utf8");

for (const functionName of [
  "iq_private.game_play_state_actor_allowed",
  "public.iq_v13_set_game_play_state",
  "public.iq_v13_game_play_state_snapshot"
]) {
  const start = sql.indexOf(`function ${functionName}`);
  assert(start >= 0, `${functionName} missing`);
  const excerpt = sql.slice(start, start + 900);
  assert.match(excerpt, /security definer[\s\S]*set search_path=''/i, `${functionName} must pin search_path`);
}

const disable = sql.indexOf("$backfill_disable_guards$");
const backfill = sql.indexOf("update public.games", disable);
const enable = sql.indexOf("$backfill_enable_guards$");
const publicWriteRpc = sql.indexOf("function public.iq_v13_set_game_play_state");
assert(disable >= 0 && backfill > disable && enable > backfill && publicWriteRpc > enable);
assert.match(sql, /tgenabled='D'/);

// The production games table is a historical schema: it has created_at but no
// updated_at. The backfill must remain compatible with that real contract.
const backfillExcerpt = sql.slice(backfill, enable);
assert.match(backfillExcerpt, /play_state_changed_at=coalesce\(play_state_changed_at,created_at,now\(\)\)/);
assert.doesNotMatch(backfillExcerpt, /\bupdated_at\b/);

assert.doesNotMatch(sql, /grant\s+(?:all|select|insert|update|delete)[\s\S]{0,80}game_play_state_transitions[\s\S]{0,40}authenticated/i);
assert.match(sql, /revoke all on table public\.game_play_state_transitions from public,anon,authenticated/i);

console.log("GAME_PLAY_STATE_V2_SQL_GUARD_OK");
