import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  "supabase/ready/20260904_apply_v3_context_identity_rls_v2.sql",
  "utf8"
);
const verify = fs.readFileSync(
  "supabase/ready/20260904_verify_v3_context_identity_rls_v2_readonly.sql",
  "utf8"
);
const smoke = fs.readFileSync(
  "supabase/drafts/20260904_smoke_context_identity_rls_v2.sql",
  "utf8"
);

for (const table of [
  "team_season_memberships",
  "club_season_memberships",
  "user_player_links"
]) {
  assert.match(apply, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  assert.match(apply, new RegExp(`grant select on table public\\.${table} to authenticated`));
}

assert.match(apply, /v3 club memberships own read/);
assert.match(apply, /v3 user player links own read/);
assert.match(apply, /using \(user_id = auth\.uid\(\)\)/);
assert.doesNotMatch(apply, /create policy[\s\S]*for\s+(insert|update|delete)/i);
assert.match(verify, /no_write_policies/);
assert.match(verify, /anon_no_select/);
assert.match(verify, /own_only/);
assert.match(smoke, /club_own_only/);
assert.match(smoke, /player_link_own_only/);
assert.match(smoke, /CTX_RLS_V2_WRITE_BLOCK/);
assert.match(smoke, /rollback;/i);

console.log("CONTEXT_IDENTITY_RLS_V2_OK");
