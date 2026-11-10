/**
 * @fileoverview Regression against a SECURITY INVOKER -> private schema failure.
 * No database connection, reads/writes, or fixture mutations.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../supabase/migrations/20261110203000_v58_training_focus_public_rpcs.sql", import.meta.url), "utf8");
for (const name of ["iq_v58_set_training_focus_codes", "iq_v58_set_training_focus_allocation"]) {
  assert.match(sql, new RegExp("create or replace function public\\." + name));
  assert.match(sql, new RegExp("revoke all on function public\\." + name));
  assert.match(sql, new RegExp("grant execute on function public\\." + name));
}
assert.equal((sql.match(/security definer/g) || []).length, 2);
assert.equal((sql.match(/set search_path = ''/g) || []).length, 2);
assert.equal((sql.match(/public\.iq_v4_can_manage_training\(p_team_season_id\)/g) || []).length, 2);
assert.equal((sql.match(/auth\.uid\(\) is null/g) || []).length, 2);
assert.equal((sql.match(/for update;/g) || []).length, 2);
assert.doesNotMatch(sql, /grant\s+usage\s+on\s+schema\s+iq_v58_private/i);
assert.doesNotMatch(sql, /drop\s+table|delete\s+from|truncate\s+table|update\s+public\.training_sessions/i);
const panel = readFileSync(new URL("../views/training/TrainingIntelligencePanelV58.js", import.meta.url), "utf8");
const editor = readFileSync(new URL("../views/training/TrainingCompleteEditV54View.js", import.meta.url), "utf8");
assert.match(editor, /canEditSession:session=>this\._canEditTrainingSession\(session\)/);
assert.match(panel, /this\.canEditSession\(s\)/);
assert.match(panel, /data-team-season-id/);
assert.match(panel, /teamSeasonId:row\.dataset\.teamSeasonId,focusCodes:codes/);
assert.match(panel, /teamSeasonId:row\.dataset\.teamSeasonId,allocations/);
assert.doesNotMatch(panel, /teamSeasonId:this\.getTeamSeasonId\(\)/);
console.log("PASS V84: private focus RPC bridge and season-scoped historical focus edits.");
