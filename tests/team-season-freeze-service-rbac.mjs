import assert from "node:assert/strict";
import fs from "node:fs";
import { PermissionService, Permission, UserRole } from "../security/PermissionService.js";
import { SeasonFreezeService } from "../services/seasons/SeasonFreezeService.js";
import { ApprovalCenterService, RequestType } from "../services/ApprovalCenterService.js";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEASON_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const context = { teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID, seasonId: SEASON_ID };

function authFor(role, email) {
  return new PermissionService({
    id: "user-" + role,
    email: email || String(role).toLowerCase() + "@example.test",
    role,
    club_id: "club-a",
    assigned_team_ids: [TEAM_ID],
    allowed_team_season_ids: [TEAM_SEASON_ID],
    allowed_global_season_ids: [SEASON_ID],
    contextualMemberships: [{
      teamSeasonId: TEAM_SEASON_ID,
      teamId: TEAM_ID,
      globalSeasonId: SEASON_ID,
      role,
      status: "ACTIVE"
    }]
  });
}

const superadmin = authFor(UserRole.SUPERADMIN, "scolado@nechigroup.com");
const admin = authFor(UserRole.ADMIN);
const coach = authFor(UserRole.ENTRENADOR);
const analyst = authFor(UserRole.ANALISTA);
const guest = authFor(UserRole.INVITADO);

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

const dataStore = {
  getActiveTeamId: () => TEAM_ID,
  getActiveTeamSeasonId: () => TEAM_SEASON_ID,
  getActiveSeasonContext: () => ({
    ...openScope,
    team_season_id: TEAM_SEASON_ID,
    teamId: TEAM_ID,
    global_season_id: SEASON_ID,
    name: "2025/2026"
  }),
  getGamesForActiveSeason: () => [],
  getGames: () => [],
  getTeamById: () => ({ id: TEAM_ID, name: "Equipo Demo" }),
  getTeams: () => [{ id: TEAM_ID, name: "Equipo Demo" }]
};

const center = new ApprovalCenterService(null, admin, dataStore);
center.teamAccessService.listRequests = async () => [];
center.gameLockService.listRequests = async () => [];
center.transferRequestService.listRequests = async () => [];
center.seasonFreezeService = {
  listRequests: async () => [{
    id: "freeze-1",
    team_season_id: TEAM_SEASON_ID,
    requested_by_role: "ENTRENADOR",
    request_reason: "Temporada finalizada",
    status: "PENDING",
    created_at: "2026-06-30T20:00:00Z"
  }],
  canReviewRequests: () => true,
  resolveRequest: async (...args) => {
    rpcCalls.push({ name: "approval-center-freeze", args });
    return { ok: true };
  }
};

const inbox = await center.load();
const freezeItem = inbox.items.find(item => item.type === RequestType.TEAM_SEASON_FREEZE);
assert.ok(freezeItem);
assert.equal(freezeItem.canApprove, true);
assert.equal(freezeItem.teamSeasonId, TEAM_SEASON_ID);
assert.match(freezeItem.detail, /Temporada finalizada/i);

await center.approve(freezeItem, "Aprobada");
assert.ok(rpcCalls.some(call => call.name === "approval-center-freeze"));

const permissionsSource = fs.readFileSync(
  new URL("../security/permissions.js", import.meta.url),
  "utf8"
);
assert.match(permissionsSource, /FREEZE_TEAM_SEASON/);
assert.match(permissionsSource, /REQUEST_TEAM_SEASON_FREEZE/);

console.log("TEAM_SEASON_FREEZE_SERVICE_RBAC_OK");
