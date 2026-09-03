import assert from "node:assert/strict";
import fs from "node:fs";
import { PermissionService, Permission, UserRole } from "../security/PermissionService.js";
import { SeasonFreezeService } from "../services/seasons/SeasonFreezeService.js";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEASON_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const context = { teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID, seasonId: SEASON_ID };

function authFor(role, email, contextRole = role) {
  return new PermissionService({
    id: "user-" + role + "-" + contextRole,
    email: email || String(contextRole).toLowerCase() + "@example.test",
    role,
    club_id: "club-a",
    assigned_team_ids: [TEAM_ID],
    allowed_team_season_ids: [TEAM_SEASON_ID],
    allowed_global_season_ids: [SEASON_ID],
    contextualMemberships: [{
      teamSeasonId: TEAM_SEASON_ID,
      teamId: TEAM_ID,
      globalSeasonId: SEASON_ID,
      role: contextRole,
      status: "ACTIVE"
    }]
  });
}

const superadmin = authFor(UserRole.SUPERADMIN, "scolado@nechigroup.com");
const admin = authFor(UserRole.ADMIN);
const coach = authFor(UserRole.ENTRENADOR);
const analyst = authFor(UserRole.ANALISTA);
const guest = authFor(UserRole.INVITADO);
const coordinator = authFor(UserRole.INVITADO, "coord@example.test", "COORDINADOR");
const director = authFor(UserRole.INVITADO, "director@example.test", "DIRECTOR_DEPORTIVO");

for (const auth of [superadmin, admin]) {
  assert.equal(auth.canPreview(Permission.FREEZE_TEAM_SEASON, context), true);
  assert.equal(auth.canPreview(Permission.REOPEN_TEAM_SEASON, context), true);
  assert.equal(auth.canPreview(Permission.REVIEW_TEAM_SEASON_FREEZE_REQUESTS, context), true);
}

for (const auth of [coach, analyst]) {
  assert.equal(auth.canPreview(Permission.REQUEST_TEAM_SEASON_FREEZE, context), true);
  assert.equal(auth.canPreview(Permission.FREEZE_TEAM_SEASON, context), false);
  assert.equal(auth.canPreview(Permission.REOPEN_TEAM_SEASON, context), false);
  assert.equal(auth.canPreview(Permission.REVIEW_TEAM_SEASON_FREEZE_REQUESTS, context), false);
}

for (const permission of [
  Permission.FREEZE_TEAM_SEASON,
  Permission.REOPEN_TEAM_SEASON,
  Permission.REQUEST_TEAM_SEASON_FREEZE,
  Permission.REVIEW_TEAM_SEASON_FREEZE_REQUESTS
]) {
  assert.equal(guest.canPreview(permission, context), false);
}

const openScope = { id: TEAM_SEASON_ID, team_id: TEAM_ID, season_id: SEASON_ID, data_status: "ACTIVE" };
const frozenScope = { ...openScope, data_status: "FROZEN" };

const superFreeze = new SeasonFreezeService(null, superadmin);
const adminFreeze = new SeasonFreezeService(null, admin);
const coachFreeze = new SeasonFreezeService(null, coach);
const analystFreeze = new SeasonFreezeService(null, analyst);
const guestFreeze = new SeasonFreezeService(null, guest);

assert.equal(superFreeze.canFreeze(openScope), true);
assert.equal(superFreeze.canRequestFreeze(openScope), false);
assert.equal(adminFreeze.canFreeze(openScope), true);
assert.equal(adminFreeze.canRequestFreeze(openScope), false);
assert.equal(coachFreeze.canRequestFreeze(openScope), true);
assert.equal(analystFreeze.canRequestFreeze(openScope), true);
assert.equal(guestFreeze.canRequestFreeze(openScope), false);

assert.equal(superFreeze.canReopen(frozenScope), true);
assert.equal(adminFreeze.canReopen(frozenScope), true);
assert.equal(coachFreeze.canReopen(frozenScope), false);
assert.equal(analystFreeze.canRequestFreeze(frozenScope), false);
assert.equal(guestFreeze.canReopen(frozenScope), false);

const coordinatorFreeze = new SeasonFreezeService(null, coordinator);
const directorFreeze = new SeasonFreezeService(null, director);

// PermissionService mapea estos roles contextuales a ADMIN funcional para otras
// capacidades, pero el lifecycle V6 exige ADMIN literal.
assert.equal(coordinator.canPreview(Permission.FREEZE_TEAM_SEASON, context), true);
assert.equal(director.canPreview(Permission.FREEZE_TEAM_SEASON, context), true);
assert.equal(coordinatorFreeze.canFreeze(openScope), false);
assert.equal(coordinatorFreeze.canReopen(frozenScope), false);
assert.equal(coordinatorFreeze.canReviewRequests(openScope), false);
assert.equal(directorFreeze.canFreeze(openScope), false);
assert.equal(directorFreeze.canReviewRequests(openScope), false);

const rpcCalls = [];
const fakeSupabase = {
  rpc: async (name, args = {}) => {
    rpcCalls.push({ name, args });
    if (name === "iq_v6_team_season_freeze_capabilities") {
      return { data: { ready: true, team_season_freeze: true }, error: null };
    }
    return { data: { ok: true }, error: null };
  }
};

const rpcService = new SeasonFreezeService(fakeSupabase, admin);
assert.equal((await rpcService.getCapabilities()).ready, true);
await rpcService.requestFreeze(TEAM_SEASON_ID, "Fin de temporada");
await rpcService.setFrozen(TEAM_SEASON_ID, true, "Validado");
await rpcService.setFrozen(TEAM_SEASON_ID, false, "Corrección");
await rpcService.resolveRequest("request-1", "APPROVED", "OK");

assert.deepEqual(
  rpcCalls.map(call => call.name),
  [
    "iq_v6_team_season_freeze_capabilities",
    "iq_v6_request_team_season_freeze",
    "iq_v6_set_team_season_data_state",
    "iq_v6_set_team_season_data_state",
    "iq_v6_resolve_team_season_freeze_request"
  ]
);

// ApprovalCenterService importa la configuración de navegador de Supabase.
// Su integración se valida de forma estática en team-season-freeze-ui-contract.mjs
// y end-to-end en el gate Playwright, evitando cargar URLs https con Node ESM.

const permissionsSource = fs.readFileSync(
  new URL("../security/permissions.js", import.meta.url),
  "utf8"
);
assert.match(permissionsSource, /FREEZE_TEAM_SEASON/);
assert.match(permissionsSource, /REQUEST_TEAM_SEASON_FREEZE/);

console.log("TEAM_SEASON_FREEZE_SERVICE_RBAC_OK");
