import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const read = path => fs.readFileSync(path, "utf8");

const authContext = read("services/security/AuthorizationContextService.js");
const gameAccess = read("views/games/GameAccessView.js");
const lazyViews = read("services/LazyViewRegistry.js");
const staffService = read("services/family/FamilyStaffService.js");
const staffView = read("views/family/FamilyStaffView.js");
const advisorAccess = read("views/family/FamilyAdvisorAccessView.js");
const migration = read("supabase/migrations/20260907054500_family_delegation_onboarding_v1.sql");
const preflight = read("supabase/ready/20260907_preflight_family_delegation_onboarding_v1_readonly.sql");
const verify = read("supabase/ready/20260907_verify_family_delegation_onboarding_v1_readonly.sql");
const rollback = read("supabase/ready/20260907_rollback_family_delegation_onboarding_v1.sql");

assert.ok(
  ROLE_PERMISSIONS[UserRole.FAMILIA_TUTOR].includes(Permission.VIEW_FAMILY_WORKSPACE),
  "FAMILIA_TUTOR must be able to enter its own Family workspace"
);
assert.ok(
  ROLE_PERMISSIONS[UserRole.ENTRENADOR].includes(Permission.INVITE_FAMILY_LINK),
  "ENTRENADOR must have the narrow Family invitation permission"
);
// V30 intentionally adds team-scoped revocation for inherited guardian links.
// Direct relationship creation/Privacy Center administration remains forbidden.
assert.ok(
  ROLE_PERMISSIONS[UserRole.ENTRENADOR].includes(Permission.REVOKE_FAMILY_LINK),
  "ENTRENADOR must be able to revoke an inherited Family link in current roster scope"
);
assert.ok(
  !ROLE_PERMISSIONS[UserRole.ENTRENADOR].includes(Permission.CREATE_PRIVACY_AUTHORIZATION),
  "ENTRENADOR must not gain arbitrary direct Family relationship creation"
);
assert.ok(
  !ROLE_PERMISSIONS[UserRole.ENTRENADOR].includes(Permission.VIEW_PRIVACY_AUTHORIZATIONS),
  "Trainer invitation/revocation permissions must not expose the Privacy Center"
);

assert.match(authContext, /authoritativeLegacyTeamIds/);
assert.match(authContext, /familyProfile\s*&&\s*familyScope/);
assert.match(authContext, /legacyLinkedPlayerIds\.length\s*>\s*0/);
assert.match(authContext, /allowedTeamIds:\s*uniqueStrings\(\[\.\.\.authoritativeLegacyTeamIds/);

assert.match(gameAccess, /_isUnlinkedFamily\(\)/);
assert.match(gameAccess, /this\._isUnlinkedFamily\(\)\s*\|\|\s*!this\._hasNormalTeamScope/);
assert.match(gameAccess, /delegationService\.getMyDelegations\(\)/);
assert.match(gameAccess, /delegatedView\.render/);

assert.match(lazyViews, /FamilyAdvisorAccessView/);
assert.match(advisorAccess, /Permission\.INVITE_FAMILY_LINK/);
assert.match(advisorAccess, /FamilyStaff(?:V30)?View/);
assert.match(advisorAccess, /FamilyAdvisorView/);
assert.match(staffService, /iq_v29_create_family_link_invitation/);
assert.match(staffService, /iq_v29_find_family_profile/);
assert.match(staffView, /Generar código de invitación/);
assert.match(staffView, /FamilyProfileControls/);
assert.match(staffView, /Permission\.REVOKE_FAMILY_LINK/);

assert.match(migration, /iq_v29_private\.can_invite_family/);
assert.match(migration, /'SUPERADMIN','ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR'/);
assert.match(migration, /iq_private\.v26_can_manage_family_profile/);
assert.match(migration, /security invoker/i);
assert.match(migration, /trg_iq_v29_normalize_new_game_shell/);
assert.match(migration, /new\.play_state:='SCHEDULED'/);
assert.match(migration, /alter column status set default 'Programado'/i);
assert.match(migration, /family_player_link_invitations/);
assert.match(preflight, /v29_invite_absent/);
assert.match(verify, /trainer_invite_guard_ok/);
assert.match(verify, /direct_assignment_still_admin_guarded/);
assert.match(verify, /scheduled_default_ok/);
assert.match(rollback, /drop schema if exists iq_v29_private cascade/i);

for (const file of [
  "security/permissions.js",
  "services/security/AuthorizationContextService.js",
  "views/games/GameAccessView.js",
  "services/LazyViewRegistry.js",
  "services/family/FamilyStaffService.js",
  "views/family/FamilyStaffView.js",
  "views/family/FamilyAdvisorAccessView.js"
]) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

console.log("Family delegation/onboarding V29 contract OK");