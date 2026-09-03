import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  new URL("../supabase/ready/20260903_apply_core_ux_boxscore_correction.sql", import.meta.url),
  "utf8"
);
const verify = fs.readFileSync(
  new URL("../supabase/ready/20260903_verify_core_ux_boxscore_readonly.sql", import.meta.url),
  "utf8"
);

assert.match(apply,/game_boxscore_corrections/i);
assert.match(apply,/iq_core_ux_can_edit_boxscore/i);
assert.match(apply,/iq_core_ux_save_boxscore_correction/i);
assert.match(apply,/upper\(coalesce\(g\.edit_state,'OPEN'\)\)='OPEN'/i);
assert.match(apply,/upper\(coalesce\(ts\.data_status,'ACTIVE'\)\)='ACTIVE'/i);
assert.match(apply,/BOXSCORE_EVENTS_REQUIRE_OVERRIDE_MODE/i);
assert.match(apply,/BOXSCORE_OVERRIDE_REASON_REQUIRED/i);
assert.match(apply,/BOXSCORE_TEAM_SCORE_MISMATCH/i);
assert.match(apply,/BOXSCORE_MADE_EXCEEDS_ATTEMPTED/i);
assert.match(apply,/PLAYER_NOT_ELIGIBLE_ON_GAME_DATE/i);
assert.match(apply,/set starter_ids=coalesce\(p_starter_ids,'\[\]'::jsonb\)/i);
assert.doesNotMatch(apply,/array_agg\(value::uuid\)/i);
assert.match(apply,/revoke all on table public\.game_boxscore_corrections from anon/i);
assert.match(verify,/CORE_UX_BOXSCORE_VERIFY/i);
assert.match(verify,/all_ok/i);

console.log("CORE_UX_BOXSCORE_SQL_OK");
