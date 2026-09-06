import assert from "node:assert/strict";
import fs from "node:fs";
import { FamilyProfileControls } from "../components/admin/FamilyProfileControls.js";
import {
  buildFamilyIdentityPolicy,
  applyFamilyIdentityPolicy,
  applyFamilyIdentityPolicyList
} from "../services/family/FamilyIdentityPolicy.js";

const migration = fs.readFileSync("supabase/migrations/20260906202000_family_profile_controls_v1.sql", "utf8");
const service = fs.readFileSync("services/family/FamilyProfileAdminService.js", "utf8");
const component = fs.readFileSync("components/admin/FamilyProfileControls.js", "utf8");
const settings = fs.readFileSync("views/TranslationsView.js", "utf8");
const datastore = fs.readFileSync("services/DataStore.js", "utf8");
const identityPolicy = fs.readFileSync("services/family/FamilyIdentityPolicy.js", "utf8");
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
assert.match(datastore, /FamilyIdentityPolicy\.js/);
assert.match(datastore, /buildFamilyIdentityPolicy/);
assert.match(datastore, /applyFamilyIdentityPolicyList/);
assert.match(identityPolicy, /no browser, Supabase or global-state dependency/i);

// Pure presentation contract: linked children always keep identity; non-linked
// players follow the two independently configurable Family preferences.
const familyUser = {
  id: "family-user",
  role: "FAMILIA_TUTOR",
  linkedPlayerIds: ["linked"],
  familyAuthorizationScope: {
    show_other_player_names: false,
    show_other_player_jerseys: false
  }
};
const policy = buildFamilyIdentityPolicy(familyUser);
assert.ok(policy);
assert.equal(policy.showOtherPlayerNames, false);
assert.equal(policy.showOtherPlayerJerseys, false);
assert.equal(policy.linkedPlayerIds.has("linked"), true);

const linkedPlayer = {
  id: "linked",
  first_name: "Lukas",
  last_name: "Danzic",
  jersey: 7,
  number: 7
};
const otherPlayer = {
  id: "other",
  first_name: "Mario",
  last_name: "Test",
  jersey: 8,
  number: 8
};
const linkedMasked = applyFamilyIdentityPolicy(linkedPlayer, policy);
const otherMasked = applyFamilyIdentityPolicy(otherPlayer, policy);
assert.equal(linkedMasked.first_name, "Lukas");
assert.equal(linkedMasked.jersey, 7);
assert.equal(otherMasked.first_name, "Jugador");
assert.equal(otherMasked.last_name, "");
assert.equal(otherMasked.jersey, null);
assert.equal(otherMasked.number, null);

const maskedList = applyFamilyIdentityPolicyList([linkedPlayer, otherPlayer], policy);
assert.equal(maskedList.length, 2);
assert.equal(maskedList[0].first_name, "Lukas");
assert.equal(maskedList[1].first_name, "Jugador");

// Backward-compatible defaults: absence of V26 preferences does not hide data.
const defaultPolicy = buildFamilyIdentityPolicy({
  role: "FAMILIA_TUTOR",
  linkedPlayerIds: ["linked"],
  familyAuthorizationScope: {}
});
assert.equal(defaultPolicy.showOtherPlayerNames, true);
assert.equal(defaultPolicy.showOtherPlayerJerseys, true);
assert.equal(applyFamilyIdentityPolicy(otherPlayer, defaultPolicy), otherPlayer);
assert.equal(buildFamilyIdentityPolicy({ role: "ENTRENADOR" }), null);

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
