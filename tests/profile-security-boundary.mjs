import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [sql, settingsView, profileView] = await Promise.all([
  readFile(new URL("../supabase/ready/20260904_apply_v7_account_status_foundation.sql", import.meta.url), "utf8"),
  readFile(new URL("../views/TranslationsView.js", import.meta.url), "utf8"),
  readFile(new URL("../views/ProfileView.js", import.meta.url), "utf8")
]);

assert.match(sql, /create or replace function public\.handle_new_user_profiles\(\)/i);
assert.doesNotMatch(
  sql,
  /raw_user_meta_data->>['"]role['"]/i,
  "El signup backend no puede aceptar roles desde metadata del cliente."
);
assert.match(sql, /ROLE_ASSIGNMENT_SUPERADMIN_DENIED/);
assert.match(sql, /MASTER_IDENTITY_PROTECTED/);
assert.match(sql, /PROFILE_SECURITY_FIELDS_READ_ONLY/);
assert.match(sql, /TEAM_ASSIGNMENT_SCOPE_DENIED/);

assert.match(settingsView, /rpc\("iq_v7_assign_user_role_context"/);
assert.match(settingsView, /rpc\("iq_v7_set_user_team_assignments"/);
assert.doesNotMatch(
  settingsView,
  /\.from\("user_profiles"\)[\s\S]{0,180}\.update\(\{\s*role:/,
  "La asignación de rol no puede volver a escribirse directamente desde el navegador."
);
assert.doesNotMatch(
  settingsView,
  /\.from\("user_profiles"\)[\s\S]{0,180}\.update\(\{\s*assigned_team_ids:/,
  "El alcance de equipos no puede volver a escribirse directamente desde el navegador."
);

const ownProfileUpdate = profileView.match(
  /\.from\("user_profiles"\)\s*\.update\(\{([\s\S]*?)\}\)\s*\.eq\("email"/
);
assert.ok(ownProfileUpdate, "Debe mantenerse la edición del perfil propio.");
for (const forbidden of ["role", "global_role", "assigned_team_ids", "linked_player_id", "status"]) {
  assert.ok(
    !new RegExp(`\\b${forbidden}\\s*:`).test(ownProfileUpdate[1]),
    `El perfil propio no puede actualizar ${forbidden}.`
  );
}
console.log(JSON.stringify({
  signupRoleMetadataIgnored: true,
  privilegedProfileWritesUseRpc: true,
  selfProfileFieldsRestricted: true,
  masterIdentityProtected: true,
  result: "PASS"
}));
console.log("PROFILE_SECURITY_BOUNDARY_OK");

