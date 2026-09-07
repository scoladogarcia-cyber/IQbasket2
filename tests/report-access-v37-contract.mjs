import assert from "node:assert/strict";
import fs from "node:fs";
import { PermissionService, Permission, UserRole } from "../security/PermissionService.js";
import { ReportAccessPolicy, ReportType } from "../security/ReportAccessPolicy.js";
import { ReportExporter } from "../services/ReportExporter.js";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_SEASON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWN_PLAYER = "10000000-0000-4000-8000-000000000001";
const OTHER_PLAYER = "10000000-0000-4000-8000-000000000002";

function serviceFor(user) {
  const auth = new PermissionService();
  auth.setCurrentUser({
    account_status: "ACTIVE",
    allowedTeamIds: [TEAM_ID],
    allowedTeamSeasonIds: [TEAM_SEASON_ID],
    contextualMemberships: [{ teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID, role: user.role, status: "ACTIVE" }],
    ...user
  });
  return auth;
}

// Official demo role: broad sporting read scope, no mutation/elevation.
const invited = serviceFor({ id: "guest", role: UserRole.INVITADO });
const invitedPolicy = new ReportAccessPolicy(invited);
assert.equal(invited.can(Permission.VIEW_GAMES, { teamId: TEAM_ID }), true);
assert.equal(invited.can(Permission.VIEW_PLAYER_STATS, { teamId: TEAM_ID }), true);
assert.equal(invited.can(Permission.VIEW_LONGITUDINAL_ANALYTICS, { teamId: TEAM_ID }), true);
assert.equal(invited.can(Permission.EDIT_BOXSCORE, { teamId: TEAM_ID }), false);
assert.equal(invited.can(Permission.EDIT_PLAYER, { teamId: TEAM_ID }), false);
assert.equal(invited.can(Permission.MANAGE_USERS, { teamId: TEAM_ID }), false);
assert.equal(invited.canAccessPlayer(OTHER_PLAYER, TEAM_ID), true, "demo guest must read players inside assigned demo team");
assert.equal(invitedPolicy.canView(ReportType.PLAYER_EVOLUTION, {
  teamId: TEAM_ID,
  teamSeasonId: TEAM_SEASON_ID,
  playerId: OTHER_PLAYER,
  playerTeamId: TEAM_ID
}), true);
assert.equal(invitedPolicy.canExport(ReportType.SEASON_DOSSIER, {
  teamId: TEAM_ID,
  teamSeasonId: TEAM_SEASON_ID
}), false, "INVITADO remains read-only and does not gain export privilege implicitly");

// Player can export only the player resource they can actually read.
const player = serviceFor({ id: "player-user", role: UserRole.JUGADOR, playerId: OWN_PLAYER, linkedPlayerIds: [OWN_PLAYER] });
const playerPolicy = new ReportAccessPolicy(player);
assert.equal(playerPolicy.canView(ReportType.PLAYER_STATS, {
  teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID, playerId: OWN_PLAYER, playerTeamId: TEAM_ID
}), true);
assert.equal(playerPolicy.canView(ReportType.PLAYER_STATS, {
  teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID, playerId: OTHER_PLAYER, playerTeamId: TEAM_ID
}), false);

const players = [
  { id: OWN_PLAYER, team_id: TEAM_ID, first_name: "Own" },
  { id: OTHER_PLAYER, team_id: TEAM_ID, first_name: "Other" }
];
const games = [{ id: "game-1", team_id: TEAM_ID, team_season_id: TEAM_SEASON_ID }];
const sanitized = playerPolicy.sanitizeDossierConfig({
  includeTeamSummary: true,
  includeColectiveCharts: true,
  includeCalendar: true,
  includeBoxScores: true,
  includeRosterMatrix: true,
  includePlayerCards: true,
  includeShotCharts: true,
  includeGlossary: true,
  selectedPlayerIds: [OWN_PLAYER, OTHER_PLAYER],
  selectedGameIds: ["game-1"]
}, { teamId: TEAM_ID, teamSeasonId: TEAM_SEASON_ID }, { players, games });
assert.deepEqual(sanitized.authorizedPlayerIds, [OWN_PLAYER]);
assert.deepEqual(sanitized.config.selectedPlayerIds, [OWN_PLAYER]);

// Exporter itself fails closed: view-level button checks are never sufficient.
globalThis.alert = () => {};
assert.equal(ReportExporter.printReport("forbidden", "<p>secret</p>"), false);
assert.equal(ReportExporter.withAuthorization({ allowed: true }, () => "AUTHORIZED_EXPORT_CONTEXT"), "AUTHORIZED_EXPORT_CONTEXT");

// Contract: V37 keeps the proven V36 implementation and adds a distinct evolution mode.
const viewSource = fs.readFileSync("views/ReportsView.js", "utf8");
const exporterSource = fs.readFileSync("services/ReportExporter.js", "utf8");
const migrationSource = fs.readFileSync("supabase/migrations/20260907190000_restore_demo_invited_scope_v37.sql", "utf8");
assert.match(viewSource, /ReportsViewLegacyV36/);
assert.match(viewSource, /ReportAccessPolicy/);
assert.match(viewSource, /data-mode = "evolution"|dataset\.mode = "evolution"/);
assert.match(viewSource, /PLAYER_EVOLUTION/);
assert.match(viewSource, /sanitizeDossierConfig/);
assert.match(exporterSource, /REPORT_EXPORT_DENIED|REPORT_SCOPE_DENIED|falta autorización de recurso/);
assert.match(exporterSource, /withAuthorization/);
assert.match(migrationSource, /function_role\) <> 'INVITADO'|upper\(function_role\) <> 'INVITADO'/i);
assert.match(migrationSource, /status = 'ACTIVE'/i);

console.log("REPORT_ACCESS_V37_CONTRACT_OK");
