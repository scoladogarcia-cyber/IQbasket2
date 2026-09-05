import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/ready/20260905_apply_family_pilot_fk_indexes_v1.sql", "utf8");

for (const fragment of [
  "saas_entitlement_grants_entitlement_code_fk_idx",
  "saas_entitlement_grants_player_id_fk_idx",
  "saas_entitlement_grants_team_id_fk_idx",
  "saas_entitlement_grants_club_id_fk_idx",
  "saas_entitlement_grants_created_by_fk_idx",
  "saas_entitlement_grants_revoked_by_fk_idx",
  "saas_family_pilot_billing_account_fk_idx",
  "saas_family_pilot_created_by_fk_idx",
  "saas_family_pilot_revoked_by_fk_idx"
]) {
  assert(sql.includes(fragment), `Missing FK coverage index: ${fragment}`);
}

assert.match(sql, /FAMILY_PILOT_FK_INDEX_PREREQUISITES_MISSING/);
assert.match(sql, /create index if not exists/i);
assert.doesNotMatch(sql, /drop\s+(table|index)/i);
assert.doesNotMatch(sql, /insert\s+into/i);
assert.doesNotMatch(sql, /update\s+public\./i);
assert.doesNotMatch(sql, /delete\s+from/i);

console.log("FAMILY_PILOT_FK_INDEX_CONTRACT_OK");
