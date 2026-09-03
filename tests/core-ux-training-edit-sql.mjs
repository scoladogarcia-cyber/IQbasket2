import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  new URL("../supabase/ready/20260903_apply_core_ux_training_edit.sql", import.meta.url),
  "utf8"
);
const verify = fs.readFileSync(
  new URL("../supabase/ready/20260903_verify_core_ux_training_edit_readonly.sql", import.meta.url),
  "utf8"
);

assert.match(apply, /iq_v4_update_training_session/i);
assert.match(apply, /iq_v4_update_external_development/i);
assert.match(apply, /upper\(coalesce\(ts\.data_status, 'ACTIVE'\)\) = 'ACTIVE'/i);
assert.match(apply, /on conflict \(training_session_id,player_id\) do nothing/i);
assert.match(apply, /delete from public\.training_participants[\s\S]*jsonb_array_elements_text/i);
assert.match(apply, /TRAINING_DURATION_MISMATCH/i);
assert.match(apply, /PLAYER_NOT_ELIGIBLE_ON_TRAINING_DATE/i);
assert.match(apply, /from public,anon/i);
assert.match(verify, /CORE_UX_TRAINING_EDIT_VERIFY/i);
assert.match(verify, /all_ok/i);

console.log("CORE_UX_TRAINING_EDIT_SQL_OK");
