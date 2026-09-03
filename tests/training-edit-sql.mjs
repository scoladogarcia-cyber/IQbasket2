import assert from "node:assert/strict";
import fs from "node:fs";

const apply=fs.readFileSync(new URL("../supabase/ready/20260903_apply_v4_phase4b_edit_training_external.sql",import.meta.url),"utf8");
const verify=fs.readFileSync(new URL("../supabase/ready/20260903_verify_v4_phase4b_edit_training_external_readonly.sql",import.meta.url),"utf8");
const rollback=fs.readFileSync(new URL("../supabase/ready/20260903_rollback_v4_phase4b_edit_training_external.sql",import.meta.url),"utf8");

assert.match(apply,/iq_v4_update_training_session/i);
assert.match(apply,/iq_v4_update_external_development/i);
assert.match(apply,/TRAINING_CONFIRMED_PARTICIPANT_CANNOT_BE_REMOVED/i);
assert.match(apply,/PLAYER_NOT_ELIGIBLE_ON_TRAINING_DATE/i);
assert.match(apply,/on conflict \(training_session_id,player_id\) do nothing/i);
assert.match(apply,/training_edit',true/i);
assert.match(apply,/external_development_edit',true/i);
assert.match(apply,/from public,anon/i);
assert.match(verify,/confirmed_attendance_guard_ok/i);
assert.match(verify,/temporal_roster_guard_ok/i);
assert.doesNotMatch(rollback,/drop table/i);

console.log("TRAINING_EDIT_SQL_OK");
