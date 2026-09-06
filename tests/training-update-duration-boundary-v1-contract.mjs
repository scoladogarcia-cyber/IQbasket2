import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(
  new URL("../services/player360/TrainingService.js", import.meta.url),
  "utf8"
);
const apply = readFileSync(
  new URL("../supabase/ready/20260906_apply_v15_training_update_boundary.sql", import.meta.url),
  "utf8"
);
const backfill = readFileSync(
  new URL("../supabase/ready/20260906_backfill_training_duration_v1.sql", import.meta.url),
  "utf8"
);

const updateStart = service.indexOf("async updateSession(");
const updateEnd = service.indexOf("async saveBlock(");
assert.ok(updateStart >= 0 && updateEnd > updateStart, "updateSession boundary must exist");
const updateMethod = service.slice(updateStart, updateEnd);

assert.match(updateMethod, /\.rpc\(\s*["']iq_v15_update_training_session["']/);
assert.doesNotMatch(updateMethod, /\.from\(["']training_sessions["']\)\s*\.update\(/s);
assert.match(updateMethod, /serverDuration = startTime && endTime \? null : durationMinutes/);
assert.match(updateMethod, /p_team_season_id:\s*teamSeasonId/);

assert.match(apply, /iq_training_duration_canonical_guard/);
assert.match(apply, /before insert or update of start_time, end_time, duration_minutes/i);
assert.match(apply, /new\.duration_minutes\s*:=\s*v_duration/i);
assert.match(apply, /TRAINING_TIME_PAIR_REQUIRED/);
assert.match(apply, /TRAINING_TIME_RANGE_INVALID/);
assert.match(apply, /iq_training_full_attendance_duration_sync/);
assert.match(apply, /upper\(coalesce\(tp\.attendance_status, ''\)\) = 'PRESENT'/i);
assert.match(apply, /tp\.participated_minutes = old\.duration_minutes/i);
assert.match(apply, /public\.iq_v4_update_training_session\(/i);
assert.match(apply, /TRAINING_SESSION_SCOPE_MISMATCH/);
assert.match(apply, /grant execute on function public\.iq_v15_update_training_session[\s\S]*to authenticated/i);
assert.match(apply, /revoke all on function public\.iq_v15_update_training_session[\s\S]*from public, anon/i);

assert.match(backfill, /duration_minutes is distinct from round\(extract\(epoch from \(end_time - start_time\)\) \/ 60\.0\)::integer/i);
assert.doesNotMatch(backfill, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

console.log("TRAINING_UPDATE_DURATION_BOUNDARY_V1_OK");
