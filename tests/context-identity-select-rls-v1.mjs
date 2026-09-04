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
assert.match(apply, /iq_v3_has_team_season_role/);
assert.match(apply, /v3 club memberships own or superadmin read/);
assert.match(apply, /iq_v3_is_superadmin/);
assert.match(apply, /v3 user player links own or manager read/);
assert.match(apply, /iq_v3_can_manage_player/);

// This hotfix restores read context only. It must not create write policies.
assert.doesNotMatch(apply, /for\s+(insert|update|delete)/i);
assert.match(verify, /no_new_write_policies/);
assert.match(smoke, /own_demo_membership_visible/);
assert.match(smoke, /no_foreign_membership_visible/);
assert.match(smoke, /role_remains_invited/);

console.log("CONTEXT_IDENTITY_SELECT_RLS_V1_OK");
