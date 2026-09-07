import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260907170000_family_multiplayer_player_privacy_v34.sql");
const verifier = read("supabase/ready/20260907_verify_family_multiplayer_player_privacy_v34_readonly.sql");
const familyService = read("services/family/FamilyWorkspaceService.js");
const familyAdmin = read("services/family/FamilyProfileAdminService.js");
const playerService = read("services/player/PlayerIdentityPreferenceService.js");
const playerEnhancer = read("features/player-dashboard/PlayerDashboardPrivacyEnhancer.js");
const adminEnhancer = read("features/admin/PlayerProfilePrivacyAdminEnhancer.js");
const index = read("index.html");
const release = JSON.parse(read("release.json"));

// Family multi-player baseline: verified Guardian relation remains the authority.
assert.match(migration, /relationship_type='GUARDIAN'/i);
assert.match(migration, /plan_code='FAMILY_FREE'/i);
assert.match(migration, /ensure_family_free_player/i);
assert.match(migration, /saas_billing_subjects/i);
assert.match(migration, /FAMILY_RELATION_REQUIRED/i);
assert.match(familyService, /iq_v34_family_bootstrap_free/);
assert.match(familyService, /iq_v8_family_bootstrap_free/);
assert.match(familyService, /iq_v34_family_claim_link/);
assert.match(familyAdmin, /iq_v34_save_family_profile_config/);
assert.match(familyAdmin, /iq_v26_save_family_profile_config/);

// Player privacy is separately persisted and scoped in backend.
assert.match(migration, /player_show_other_player_names boolean not null default true/i);
assert.match(migration, /player_show_other_player_jerseys boolean not null default true/i);
assert.match(migration, /player_profile_config_audit/i);
assert.match(migration, /v34_private\.can_manage_player_identity/i);
assert.match(migration, /SUPERADMIN','ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO/i);
assert.doesNotMatch(migration, /SUPERADMIN','ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR/i);
assert.match(migration, /iq_v34_my_player_identity_preferences/i);
assert.match(migration, /security invoker/i);
assert.match(migration, /revoke all on function public\.iq_v34_my_player_identity_preferences\(uuid\) from public,anon,authenticated/i);
assert.match(migration, /grant execute on function public\.iq_v34_my_player_identity_preferences\(uuid\) to authenticated/i);

// PostgreSQL may omit explicit SECURITY INVOKER in pg_get_functiondef() because
// INVOKER is the default. The production verifier must inspect pg_proc.prosecdef.
assert.match(verifier, /pg_proc/i);
assert.match(verifier, /prosecdef/i);
assert.doesNotMatch(verifier, /pg_get_functiondef[\s\S]*security invoker/i);

assert.match(playerService, /iq_v34_get_player_profile_config/);
assert.match(playerService, /iq_v34_save_player_profile_config/);
assert.match(playerService, /iq_v34_my_player_identity_preferences/);
assert.doesNotMatch(playerService, /\.from\(/);

// Admin UI is progressive and does not modify the giant TranslationsView.
assert.match(adminEnhancer, /VISIBILIDAD DE COMPAÑEROS · JUGADOR/);
assert.match(adminEnhancer, /Mostrar nombres de otros jugadores/);
assert.match(adminEnhancer, /Mostrar dorsales de otros jugadores/);
assert.match(index, /PlayerProfilePrivacyAdminEnhancer\.js/);

// Player's local preference can only make the central ceiling stricter.
assert.match(playerEnhancer, /policyState\.showNames === false/);
assert.match(playerEnhancer, /policyState\.showJerseys === false/);
assert.match(playerEnhancer, /getMode\(\) === MODE_POSITIONS/);
assert.match(playerEnhancer, /team-player-mobile-card/);
assert.match(playerEnhancer, /roster-table-body/);
assert.match(playerEnhancer, /playerId === ownPlayerId\(\)/);

assert.equal(release.release, "2026.09.07.17");
assert.equal(release.label, "family-multiplayer-player-privacy-v34");

for (const file of [
  "services/family/FamilyWorkspaceService.js",
  "services/family/FamilyProfileAdminService.js",
  "services/player/PlayerIdentityPreferenceService.js",
  "features/player-dashboard/PlayerDashboardPrivacyEnhancer.js",
  "features/admin/PlayerProfilePrivacyAdminEnhancer.js"
]) {
  execFileSync(process.execPath, ["--check", new URL(`../${file}`, import.meta.url).pathname], { stdio: "inherit" });
}

console.log("FAMILY_MULTIPLAYER_PLAYER_PRIVACY_V34_CONTRACT_OK");
