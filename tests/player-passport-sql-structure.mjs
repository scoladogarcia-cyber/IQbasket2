import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/ready/20261004_apply_player_passport_v1.sql", import.meta.url), "utf8");
const verify = fs.readFileSync(new URL("../supabase/ready/20261004_verify_player_passport_v1_readonly.sql", import.meta.url), "utf8");

for (const table of ["player360_evaluation_rubrics","player360_evaluation_rubric_anchors","player_evaluation_evidence","player360_measurements"]) {
  assert.match(sql,new RegExp("create table if not exists public\\."+table,"i"));
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security","i"));
}
assert.match(sql,/PLAYER_PASSPORT/);
assert.match(sql,/iq_v4_can_access_player_passport/);
assert.match(sql,/iq_saas_entitlement_check\('PLAYER',p_player_id,p_team_season_id,'PLAYER_PASSPORT',1\)/);
assert.match(sql,/public\.iq_v3_is_global_superadmin\(\) or v_role='ADMIN'/);
assert.match(sql,/if v_is_test then return true/);
assert.match(sql,/scale_min,scale_max,scale_step[\s\S]*1,5,1/);
assert.match(sql,/evaluation_context in \('T','JR','P5','VIDEO'\)/);
assert.match(sql,/as restrictive[\s\S]*for select/i);
assert.doesNotMatch(sql,/update[\s\S]{0,100}score[\s\S]{0,100}\*\s*0\.5/i);
assert.match(verify,/rubric_count/);
assert.match(verify,/anchor_count/);
console.log("player-passport-sql-structure OK");
