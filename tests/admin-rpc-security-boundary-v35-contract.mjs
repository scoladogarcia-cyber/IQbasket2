import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const privateMigration = read("supabase/migrations/20260907173000_admin_rpc_security_boundary_v35_private.sql");
const publicMigration = read("supabase/migrations/20260907173100_admin_rpc_security_boundary_v35_public.sql");
const migration = `${privateMigration}\n${publicMigration}`;
const verifier = read("supabase/ready/20260907_verify_admin_rpc_security_boundary_v35_readonly.sql");
const settingsView = read("views/TranslationsView.js");
const release = JSON.parse(read("release.json"));

// Phase 1 is behavior-neutral: only the non-exposed implementation is created.
assert.match(privateMigration, /create schema if not exists iq_v35_private/i);
assert.doesNotMatch(privateMigration, /create or replace function public\.iq_admin_set_account_status/i);
assert.doesNotMatch(privateMigration, /create or replace function public\.iq_v7_assign_user_role_context/i);
assert.match(privateMigration, /revoke all on schema iq_v35_private from public, anon, authenticated/i);
assert.match(privateMigration, /grant usage on schema iq_v35_private to authenticated/i);
assert.match(privateMigration, /create or replace function iq_v35_private\.admin_set_account_status/i);
assert.match(privateMigration, /create or replace function iq_v35_private\.assign_user_role_context/i);

// Phase 2 changes only the stable public wrapper boundary.
assert.doesNotMatch(publicMigration, /update public\.user_profiles/i);
assert.doesNotMatch(publicMigration, /insert into public\.user_account_controls/i);
assert.match(publicMigration, /create or replace function public\.iq_admin_set_account_status/i);
assert.match(publicMigration, /create or replace function public\.iq_v7_assign_user_role_context/i);

// Privileged implementation remains SECURITY DEFINER, public API becomes INVOKER.
assert.match(privateMigration, /iq_v35_private\.admin_set_account_status\([\s\S]*?security definer/i);
assert.match(privateMigration, /iq_v35_private\.assign_user_role_context\([\s\S]*?security definer/i);
assert.match(publicMigration, /public\.iq_admin_set_account_status\([\s\S]*?security invoker/i);
assert.match(publicMigration, /public\.iq_v7_assign_user_role_context\([\s\S]*?security invoker/i);
assert.match(publicMigration, /public\.iq_v7_assign_user_role\([\s\S]*?security invoker/i);

// Existing authorization invariants must survive the refactor.
for (const guard of [
  "ACCOUNT_ACTIVE_AUTH_REQUIRED",
  "ACCOUNT_STATUS_ADMIN_REQUIRED",
  "ACCOUNT_STATUS_MASTER_PROTECTED",
  "ROLE_ASSIGNMENT_TARGET_INVALID",
  "MASTER_IDENTITY_PROTECTED",
  "ROLE_ASSIGNMENT_SUPERADMIN_DENIED",
  "ROLE_ASSIGNMENT_PRIVILEGED_DENIED",
  "ROLE_ASSIGNMENT_SCOPE_DENIED",
  "PLAYER_LINK_REQUIRED",
  "PLAYER_LINK_TEAM_SEASON_REQUIRED",
  "PLAYER_LINK_ROSTER_MEMBERSHIP_REQUIRED",
  "PLAYER_LINK_SCOPE_DENIED",
  "PLAYER_LINK_ONLY_FOR_PLAYER_ROLE"
]) {
  assert.match(migration, new RegExp(guard));
}

assert.match(privateMigration, /from public\.roster_memberships rm[\s\S]*join public\.team_seasons ts/i);
assert.match(privateMigration, /rm\.team_season_id=p_team_season_id/i);
assert.match(privateMigration, /v_target_teams && v_actor_teams/i);
assert.match(privateMigration, /v_target_role='SUPERADMIN'[\s\S]*MASTER_IDENTITY_PROTECTED/i);
assert.doesNotMatch(migration, /scolado@nechigroup\.com/i);

// Browser-visible signatures stay compatible; UI must not be rewritten around DB security.
assert.match(settingsView, /rpc\("iq_v7_assign_user_role_context"/);
assert.match(publicMigration, /public\.iq_v7_assign_user_role_context\(\s*p_user_id uuid,\s*p_role text,\s*p_linked_player_id uuid,\s*p_team_season_id uuid/i);
assert.match(publicMigration, /public\.iq_v7_assign_user_role_context\(\s*p_user_id uuid,\s*p_role text,\s*p_linked_player_id uuid default null/i);
assert.match(publicMigration, /public\.iq_v7_assign_user_role\(\s*p_user_id uuid,\s*p_role text/i);
assert.match(publicMigration, /public\.iq_admin_set_account_status\(\s*p_user_id uuid,\s*p_account_status text,\s*p_reason text default null/i);

// Browser roles only get the minimum execution grants; anonymous stays denied.
assert.match(publicMigration, /revoke all on function public\.iq_admin_set_account_status\(uuid,text,text\)[\s\S]*from public, anon, authenticated/i);
assert.match(publicMigration, /grant execute on function public\.iq_admin_set_account_status\(uuid,text,text\)[\s\S]*to authenticated/i);
assert.match(publicMigration, /revoke all on function public\.iq_v7_assign_user_role_context\(uuid,text,uuid,uuid\)[\s\S]*from public, anon, authenticated/i);
assert.match(publicMigration, /grant execute on function public\.iq_v7_assign_user_role_context\(uuid,text,uuid,uuid\)[\s\S]*to authenticated/i);

// Production verification must inspect pg_proc, not parse an optional SQL clause.
assert.match(verifier, /pg_proc/i);
assert.match(verifier, /prosecdef/i);
assert.match(verifier, /account_public_invoker_ok/i);
assert.match(verifier, /role_context_4_public_invoker_ok/i);
assert.match(verifier, /account_private_definer_ok/i);
assert.match(verifier, /role_private_definer_ok/i);
assert.match(verifier, /anon_account_execute_denied_ok/i);
assert.match(verifier, /anon_role_execute_denied_ok/i);

assert.equal(release.release, "2026.09.07.18");
assert.equal(release.label, "admin-rpc-security-boundary-v35");

console.log("ADMIN_RPC_SECURITY_BOUNDARY_V35_CONTRACT_OK");
