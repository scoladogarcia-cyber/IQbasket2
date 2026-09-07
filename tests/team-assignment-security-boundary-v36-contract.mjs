import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const privateMigration = read("supabase/migrations/20260907180000_team_assignment_security_boundary_v36_private.sql");
const publicMigration = read("supabase/migrations/20260907180100_team_assignment_security_boundary_v36_public.sql");
const verifier = read("supabase/ready/20260907_verify_team_assignment_security_boundary_v36_readonly.sql");
const settingsView = read("views/TranslationsView.js");

// Phase 1 must not replace the browser-visible API.
assert.match(privateMigration, /create or replace function iq_v35_private\.set_user_team_assignments/i);
assert.doesNotMatch(privateMigration, /create or replace function public\.iq_v7_set_user_team_assignments/i);
assert.match(privateMigration, /security definer/i);

// Public signature stays stable and becomes an INVOKER wrapper only.
assert.match(publicMigration, /create or replace function public\.iq_v7_set_user_team_assignments\(\s*p_user_id uuid,\s*p_team_ids uuid\[\]/i);
assert.match(publicMigration, /security invoker/i);
assert.match(publicMigration, /iq_v35_private\.set_user_team_assignments/i);
assert.doesNotMatch(publicMigration, /update public\.user_profiles/i);

// Authorization invariants and privileged-target protection.
for (const guard of [
  "ACCOUNT_ACTIVE_AUTH_REQUIRED",
  "TEAM_ASSIGNMENT_TARGET_REQUIRED",
  "TEAM_ASSIGNMENT_UNKNOWN_TEAM",
  "TEAM_ASSIGNMENT_USER_NOT_FOUND",
  "MASTER_IDENTITY_PROTECTED",
  "TEAM_ASSIGNMENT_PRIVILEGED_TARGET_DENIED",
  "TEAM_ASSIGNMENT_SCOPE_DENIED",
  "TEAM_ASSIGNMENT_ADMIN_REQUIRED"
]) {
  assert.match(privateMigration, new RegExp(guard));
}
assert.match(privateMigration, /v_target_role='SUPERADMIN'/i);
assert.match(privateMigration, /v_target_role='ADMIN'/i);
assert.match(privateMigration, /v_actor_role='ADMIN'/i);
assert.match(privateMigration, /not \(x=any\(v_actor_teams\)\)/i);
assert.match(privateMigration, /where not \(x=any\(v_actor_teams\)\)/i);
assert.doesNotMatch(privateMigration, /scolado@nechigroup\.com/i);

// Profile mutation still goes through the existing guarded server-side context.
assert.match(privateMigration, /set_config\('iqbasket\.profile_admin_rpc','1',true\)/i);
assert.match(privateMigration, /update public\.user_profiles[\s\S]*assigned_team_ids=v_final/i);
assert.match(privateMigration, /set_config\('iqbasket\.profile_admin_rpc','0',true\)/i);

// UI continues using the same RPC; no direct privileged profile mutation.
assert.match(settingsView, /rpc\("iq_v7_set_user_team_assignments"/);

// Least privilege at both boundaries.
assert.match(privateMigration, /revoke all on function iq_v35_private\.set_user_team_assignments\(uuid,uuid\[\]\)[\s\S]*from public, anon, authenticated/i);
assert.match(privateMigration, /grant execute on function iq_v35_private\.set_user_team_assignments\(uuid,uuid\[\]\)[\s\S]*to authenticated/i);
assert.match(publicMigration, /revoke all on function public\.iq_v7_set_user_team_assignments\(uuid,uuid\[\]\)[\s\S]*from public, anon, authenticated/i);
assert.match(publicMigration, /grant execute on function public\.iq_v7_set_user_team_assignments\(uuid,uuid\[\]\)[\s\S]*to authenticated/i);

// Post-apply verifier checks the actual security mode, grants and no hardcode.
assert.match(verifier, /prosecdef/i);
assert.match(verifier, /public_invoker_ok/i);
assert.match(verifier, /private_definer_ok/i);
assert.match(verifier, /authorization_guards_ok/i);
assert.match(verifier, /no_identity_hardcode_ok/i);

// Historical contracts validate their boundary, not the current product release.
console.log("TEAM_ASSIGNMENT_SECURITY_BOUNDARY_V36_CONTRACT_OK");
