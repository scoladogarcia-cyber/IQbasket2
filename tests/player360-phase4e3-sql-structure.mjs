import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path => readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

const preflight=read("supabase/ready/20260904_preflight_v4_phase4e3_wellness_v2_readonly.sql");
const apply=read("supabase/ready/20260904_apply_v4_phase4e3_wellness_v2.sql");
const verify=read("supabase/ready/20260904_verify_v4_phase4e3_wellness_v2_readonly.sql");
const rollback=read("supabase/ready/20260904_rollback_v4_phase4e3_wellness_v2.sql");
const postRollback=read("supabase/ready/20260904_verify_v4_phase4e3_postrollback_readonly.sql");
const rehearsal=read("supabase/drafts/20260904_rehearse_v4_phase4e3_wellness_v2_rollback.sql");

for(const source of [preflight,apply,verify,rollback,postRollback,rehearsal]){
  assert.match(source,/DAILY_ENERGY/);
  assert.doesNotMatch(source,/\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(source,/\bTRUNCATE\b/i);
  assert.doesNotMatch(source,/\bALTER\s+TABLE\s+public\.player360_wellness_(entries|observations)\b/i);
}

assert.match(preflight,/PLAYER360_PHASE4E3_PREREQUISITES_MISSING/);
assert.match(preflight,/PLAYER360_PHASE4E3_ALREADY_INSTALLED/);

assert.match(apply,/insert into public\.player360_wellness_metric_catalog/i);
assert.match(apply,/where not exists/i);
assert.match(apply,/'WELLNESS_RESTRICTED'/);
assert.match(apply,/'SCALE_1_5'/);
assert.match(apply,/\bbegin;/i);
assert.match(apply,/\bcommit;/i);

for(const prohibited of [
  "WEIGHT_KG","BMI","BODY_FAT_PCT","CALORIE_INTAKE","ENERGY_DEFICIT",
  "MENSTRUATION","MEDICATION","DIAGNOSIS","CLINICAL_SYMPTOMS"
]){
  assert.doesNotMatch(apply,new RegExp(`'${prohibited}'`));
}

assert.match(verify,/PLAYER360_PHASE4E3_VERIFY_DAILY_ENERGY_INVALID/);
assert.match(verify,/PLAYER360_PHASE4E3_PROHIBITED_SYSTEM_METRIC_PRESENT/);

assert.match(rollback,/player360_wellness_observations/);
assert.match(rollback,/set enabled=false/i);
assert.match(rollback,/delete from public\.player360_wellness_metric_catalog/i);
assert.match(postRollback,/PLAYER360_PHASE4E3_ROLLBACK_DAMAGED_PHASE4E2/);

assert.match(rehearsal,/\bbegin;/i);
assert.equal((rehearsal.match(/^\s*rollback;\s*$/gmi) || []).length,1);
assert.match(rehearsal,/PLAYER360_PHASE4E3_REHEARSAL_DATA_CHANGED/);

console.log("✅ Phase 4E.3 SQL structure guard passed");
