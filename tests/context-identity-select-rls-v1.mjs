import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  "supabase/ready/20260904_apply_v3_context_identity_select_rls_v1.sql",
  "utf8"
);
const verify = fs.readFileSync(
  "supabase/ready/20260904_verify_v3_context_identity_select_rls_v1_readonly.sql",
  "utf8"
);
const smoke = fs.readFileSync(
  "supabase/drafts/20260904_smoke_invited_context_identity_rls_readonly.sql",
  "utf8"
);

assert.match(apply, /v3 team memberships scoped read/);
assert.match(apply, /user_id\s*=\s*auth\.uid\(\)/);
assert.match(apply, /iq_v3_can_manage_team_season\(team_season_id\)/);
assert.doesNotMatch(apply, /club_season_memberships/);
assert.doesNotMatch(apply, /user_player_links/);
assert.doesNotMatch(apply, /for\s+(insert|update|delete)/i);

assert.match(verify, /no_write_policies/);
assert.match(verify, /own_scope_present/);
assert.match(verify, /manager_scope_present/);
assert.match(smoke, /own_demo_membership_visible/);
assert.match(smoke, /no_foreign_membership_visible/);
assert.match(smoke, /role_remains_invited/);

console.log("TEAM_MEMBERSHIP_SELECT_RLS_V1_OK");
