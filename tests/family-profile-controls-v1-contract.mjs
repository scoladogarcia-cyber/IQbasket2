import assert from "node:assert/strict";
import fs from "node:fs";
import { DataStore } from "../services/DataStore.js";
import { PermissionService } from "../security/PermissionService.js";
import { UserRole } from "../security/roles.js";
import { FamilyProfileControls } from "../components/admin/FamilyProfileControls.js";

const migration = fs.readFileSync("supabase/migrations/20260906202000_family_profile_controls_v1.sql", "utf8");
const service = fs.readFileSync("services/family/FamilyProfileAdminService.js", "utf8");
const component = fs.readFileSync("components/admin/FamilyProfileControls.js", "utf8");
const settings = fs.readFileSync("views/TranslationsView.js", "utf8");
const datastore = fs.readFileSync("services/DataStore.js", "utf8");
const release = JSON.parse(fs.readFileSync("release.json", "utf8"));

assert.match(migration, /family_show_other_player_names boolean not null default true/i);
assert.match(migration, /family_show_other_player_jerseys boolean not null default true/i);
assert.match(migration, /create table if not exists public\.family_profile_config_audit/i);
assert.match(migration, /family_profile_config_audit_direct_deny[\s\S]*using \(false\)[\s\S]*with check \(false\)/i);
assert.match(migration, /iq_v26_get_family_profile_config/i);
assert.match(migration, /iq_v26_save_family_profile_config/i);
assert.match(migration, /FAMILY_PROFILE_PLAYER_OUT_OF_SCOPE/i);
assert.match(migration, /relationship_type='GUARDIAN'/i);
assert.match(migration, /FAMILY_PROFILE_ADMIN_V26/i);
assert.match(migration, /show_other_player_names/i);
assert.match(migration, /show_other_player_jerseys/i);
assert.match(migration, /revoke all on function iq_private\.v26_can_manage_family_profile\(uuid\)/i);

const managerHelper = migration.slice(
  migration.indexOf("create or replace function iq_private.v26_can_manage_family_profile"),
  migration.indexOf("revoke all on function iq_private.v26_can_manage_family_profile")
);
assert.match(managerHelper, /'SUPERADMIN','ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'/);
assert.doesNotMatch(managerHelper, /'ENTRENADOR'|'ANALISTA'|'FAMILIA_TUTOR'/);

assert.doesNotMatch(service, /\.from\(/);
assert.match(service, /iq_v26_get_family_profile_config/);
assert.match(service, /iq_v26_save_family_profile_config/);
assert.match(component, /family-profile-player/);
assert.match(component, /family-show-other-names/);
assert.match(component, /family-show-other-jerseys/);
assert.match(settings, /FamilyProfileControls/);
assert.match(settings, /userProf\.role === UserRole\.FAMILIA_TUTOR/);
assert.match(settings, /players: teamPlayers/);
assert.match(datastore, /_familyIdentityPolicy\(\)/);
assert.match(datastore, /familyAuthorizationScope/);
assert.match(datastore, /linkedPlayerIds/);

// Presentation contract: linked children always keep identity; non-linked players
// follow the two independently configurable Family preferences.
const previousPlayers = DataStore.players;
const previousPermissionService = DataStore.permissionService;
try {
  DataStore.players = [
    { id: "linked", team_id: "team", first_name: "Lukas", last_name: "Danzic", jersey: 7 },
    { id: "other", team_id: "team", first_name: "Mario", last_name: "Test", jersey: 8 }
  ];
  const permissionService = new PermissionService({
    id: "family-user",
    email: "family@example.com",
    role: UserRole.FAMILIA_TUTOR,
    accountStatus: "ACTIVE",
    linkedPlayerIds: ["linked"],
    allowedTeamIds: ["team"],
    familyAuthorizationScope: {
      show_other_player_names: false,
      show_other_player_jerseys: false
    }
  });
  DataStore.setPermissionService(permissionService);
  const rows = DataStore.getTeamPlayers("team");
  const linked = rows.find(row => row.id === "linked");
  const other = rows.find(row => row.id === "other");
  assert.equal(linked.first_name, "Lukas");
  assert.equal(linked.jersey, 7);
  assert.equal(other.first_name, "Jugador");
  assert.equal(other.last_name, "");
  assert.equal(other.jersey, null);
  assert.equal(other.number, null);
} finally {
  DataStore.players = previousPlayers;
  DataStore.setPermissionService(previousPermissionService);
}

const controls = new FamilyProfileControls(null);
controls.userId = "family-user";
controls.teamSeasonId = "team-season";
controls.players = [
  { id: "p1", first_name: "Uno", last_name: "Player", jersey: 4 },
  { id: "p2", first_name: "Dos", last_name: "Player", jersey: 8 }
];
controls.config = {
  playerIds: ["p1", "p2"],
  showOtherPlayerNames: false,
  showOtherPlayerJerseys: true
};
const html = controls.render();
assert.match(html, /value="p1" checked/);
assert.match(html, /value="p2" checked/);
assert.doesNotMatch(html, /id="family-show-other-names" checked/);
assert.match(html, /id="family-show-other-jerseys" checked/);

const version = release.release.split(".").map(Number);
const baseline = "2026.09.06.12".split(".").map(Number);
const compare = (a, b) => {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};
assert.ok(compare(version, baseline) >= 0, "La release V26 no puede retroceder.");
if (release.release === "2026.09.06.12") {
  assert.equal(release.label, "family-profile-controls-v1-v26");
}

console.log("FAMILY_PROFILE_CONTROLS_V1_V26_OK");
