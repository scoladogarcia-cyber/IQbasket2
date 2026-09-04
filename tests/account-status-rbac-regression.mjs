import assert from "node:assert/strict";
import { PermissionService, Permission, UserRole } from "../security/PermissionService.js";
import { AccountStatus, normalizeAccountStatus, AccountAccessError, assertAccountActive } from "../security/accountStatus.js";
import { AccountStatusService } from "../services/security/AccountStatusService.js";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function master(statusField = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "scolado@nechigroup.com",
    role: "SUPERADMIN",
    global_role: "SUPERADMIN",
    assigned_team_ids: [TEAM_ID],
    allowed_team_season_ids: [TEAM_SEASON_ID],
    ...statusField
  };
}

// Legacy signup workflow status must not accidentally deactivate accounts.
const legacyPending = new PermissionService(master({ status: "pending" }));
assert.equal(legacyPending.isAccountActive(), true);
assert.equal(legacyPending.isAuthenticated(), true);
assert.equal(legacyPending.getCurrentUser().registrationStatus, "pending");
assert.equal(legacyPending.getCurrentUser().accountStatus, AccountStatus.ACTIVE);
assert.equal(legacyPending.can(Permission.MANAGE_TEAMS, { teamId: TEAM_ID }), true);

for (const accountStatus of [
  AccountStatus.SUSPENDED,
  AccountStatus.DISABLED,
  AccountStatus.PENDING_ACTIVATION
]) {
  const auth = new PermissionService(master({ account_status: accountStatus }));
  assert.equal(auth.isAccountActive(), false, `${accountStatus} no debe considerarse activa`);
  assert.equal(auth.isAuthenticated(), false, `${accountStatus} no debe habilitar sesión de aplicación`);
  assert.equal(auth.isAdmin(), false, `${accountStatus} no debe conservar privilegios admin`);
  assert.equal(auth.isScout(), false, `${accountStatus} no debe conservar privilegios scout`);
  assert.equal(auth.hasRole(UserRole.SUPERADMIN), false, `${accountStatus} no debe pasar checks de rol`);
  assert.equal(auth.can(Permission.VIEW_DASHBOARD), false, `${accountStatus} no debe poder leer dashboard`);
  assert.equal(auth.canPreview(Permission.MANAGE_TEAMS, { teamId: TEAM_ID }), false, `${accountStatus} no debe saltarse el bloqueo por preview`);
  assert.equal(auth.canAccessTeam(TEAM_ID), false, `${accountStatus} no debe acceder a equipo`);
  assert.equal(auth.canAccessTeamSeason(TEAM_SEASON_ID), false, `${accountStatus} no debe acceder a team-season`);
  assert.equal(auth.getContextRoles(TEAM_SEASON_ID).length, 0, `${accountStatus} no debe exponer roles contextuales`);
  assert.equal(auth.getAiMonthlyLimit(), 0, `${accountStatus} no debe tener cuota IA`);
  assert.equal(auth.setPreviewRole(UserRole.ADMIN), false, `${accountStatus} no debe poder simular rol`);
}

// Explicit unknown values fail closed; only an absent value keeps staged-deploy compatibility.
assert.equal(normalizeAccountStatus(undefined), AccountStatus.ACTIVE);
assert.equal(normalizeAccountStatus("unexpected_state"), AccountStatus.DISABLED);
const unknown = new PermissionService(master({ account_status: "unexpected_state" }));
assert.equal(unknown.can(Permission.VIEW_DASHBOARD), false);

assert.throws(
  () => assertAccountActive(AccountStatus.SUSPENDED),
  error => error instanceof AccountAccessError
    && error.code === "ACCOUNT_NOT_ACTIVE"
    && error.accountStatus === AccountStatus.SUSPENDED
);

const activeService = new AccountStatusService({
  rpc: async name => {
    assert.equal(name, "iq_current_account_state");
    return { data: { active: true, account_status: "ACTIVE", changed_at: "2026-09-04T00:00:00Z" }, error: null };
  }
});
assert.deepEqual(await activeService.getCurrentState(), {
  active: true,
  accountStatus: AccountStatus.ACTIVE,
  changedAt: "2026-09-04T00:00:00Z",
  reasonCode: null
});

const suspendedService = new AccountStatusService({
  rpc: async () => ({ data: { active: false, account_status: "SUSPENDED" }, error: null })
});
const suspendedState = await suspendedService.getCurrentState();
assert.equal(suspendedState.active, false);
assert.equal(suspendedState.accountStatus, AccountStatus.SUSPENDED);

const failedService = new AccountStatusService({
  rpc: async () => ({ data: null, error: { message: "network unavailable" } })
});
await assert.rejects(
  () => failedService.getCurrentState(),
  error => error.code === "ACCOUNT_STATUS_LOOKUP_FAILED"
);

console.log(JSON.stringify({
  legacyStatusSeparated: true,
  blockedStatuses: ["SUSPENDED", "DISABLED", "PENDING_ACTIVATION"],
  unknownFailsClosed: true,
  accountRpcFailClosed: true,
  result: "PASS"
}));
console.log("ACCOUNT_STATUS_RBAC_REGRESSION_OK");
