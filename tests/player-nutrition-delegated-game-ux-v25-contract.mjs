import assert from "node:assert/strict";
import fs from "node:fs";
import { PermissionService } from "../security/PermissionService.js";
import { Permission } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";
import { PlayerSubmissionPanel } from "../views/player360/PlayerSubmissionPanel.js";
import { PlayerSubmissionType } from "../services/player360/PlayerDataSubmissionService.js";
import { GameCaptureDelegationPanel } from "../components/games/GameCaptureDelegationPanel.js";

const lazyRegistry = fs.readFileSync("services/LazyViewRegistry.js", "utf8");
const gameAccess = fs.readFileSync("views/games/GameAccessView.js", "utf8");
const delegatedGames = fs.readFileSync("views/games/DelegatedGamesView.js", "utf8");
const nutritionRouter = fs.readFileSync("views/PlayerNutritionRouterView.js", "utf8");
const submissionPanelSource = fs.readFileSync("views/player360/PlayerSubmissionPanel.js", "utf8");
const delegationPanelSource = fs.readFileSync("components/games/GameCaptureDelegationPanel.js", "utf8");
const release = JSON.parse(fs.readFileSync("release.json", "utf8"));

const delegatedGameId = "11111111-1111-4111-8111-111111111111";
const unrelatedGameId = "22222222-2222-4222-8222-222222222222";
const staleTeamId = "33333333-3333-4333-8333-333333333333";
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const familyPermissions = new PermissionService({
  id: "44444444-4444-4444-8444-444444444444",
  email: "family@example.com",
  role: UserRole.FAMILIA_TUTOR,
  accountStatus: "ACTIVE",
  allowedTeamIds: [],
  allowedTeamSeasonIds: [],
  linkedPlayerIds: [],
  gameDelegations: [{
    gameId: delegatedGameId,
    team_id: staleTeamId,
    capabilities: [Permission.RECORD_LIVE_GAME, Permission.EDIT_BOXSCORE],
    validUntil: future
  }]
});

// Generic Partidos navigation may enter the scoped landing, but the delegation
// must never turn into team/player scope.
assert.equal(familyPermissions.can(Permission.VIEW_GAMES, { teamId: staleTeamId }), true);
assert.equal(familyPermissions.canAccessTeam(staleTeamId), false);
assert.equal(familyPermissions.can(Permission.VIEW_TEAM, { teamId: staleTeamId }), false);
assert.equal(familyPermissions.can(Permission.RECORD_LIVE_GAME, { gameId: delegatedGameId, teamId: staleTeamId }), true);
assert.equal(familyPermissions.can(Permission.RECORD_LIVE_GAME, { gameId: unrelatedGameId, teamId: staleTeamId }), false);

const playerPermissions = new PermissionService({
  id: "55555555-5555-4555-8555-555555555555",
  email: "player@example.com",
  role: UserRole.JUGADOR,
  accountStatus: "ACTIVE",
  playerId: "66666666-6666-4666-8666-666666666666",
  allowedTeamIds: []
});
assert.equal(playerPermissions.can(Permission.VIEW_NUTRITION, { teamId: staleTeamId }), true);
assert.equal(playerPermissions.canAccessTeam(staleTeamId), false);

assert.match(lazyRegistry, /GameAccessView/);
assert.match(lazyRegistry, /PlayerNutritionRouterView/);
assert.match(gameAccess, /getMyDelegations/);
assert.match(gameAccess, /!this\._hasNormalTeamScope/);
assert.match(delegatedGames, /Mis partidos asignados/);
assert.match(delegatedGames, /#\/live\/\$\{encodeURIComponent\(gameId\)\}/);
assert.match(delegatedGames, /#\/boxscore\/\$\{encodeURIComponent\(gameId\)\}/);
assert.doesNotMatch(delegatedGames, /\.from\(/);
assert.doesNotMatch(delegatedGames, /user_player_links|family_player_links|linkedPlayerIds/);
assert.match(nutritionRouter, /UserRole\.JUGADOR/);
assert.match(nutritionRouter, /UserRole\.FAMILIA_TUTOR/);
assert.match(nutritionRouter, /view\.activeTab = "wellness"/);
assert.match(nutritionRouter, /return view\.render\(containerId, subjectPlayerId, teamId\)/);
assert.doesNotMatch(nutritionRouter, /window\.location\.hash\s*=\s*target/);

const submissionPanel = new PlayerSubmissionPanel({ service: {} });
const correctionHtml = submissionPanel._wellnessCorrectionEditor({
  id: "77777777-7777-4777-8777-777777777777",
  submission_type: PlayerSubmissionType.WELLNESS_CHECKIN,
  status: "RETURNED",
  payload: {
    module: "nutrition",
    entry_date: "2026-09-06",
    values: [
      { metric_code: "hydration_adherence", value: 4 },
      { metric_code: "meal_regularity", value: 3 },
      { metric_code: "post_training_recovery", value: false }
    ]
  }
});
assert.match(submissionPanelSource, /WELLNESS_SCALE_1_TO_5/);
assert.match(correctionHtml, /data-metric-code="hydration_adherence"[\s\S]*?<option value="5"/);
assert.match(correctionHtml, /data-metric-code="meal_regularity"[\s\S]*?<option value="5"/);
assert.doesNotMatch(correctionHtml, /data-metric-code="hydration_adherence"[^>]*type="number"/);
assert.doesNotMatch(correctionHtml, /data-metric-code="meal_regularity"[^>]*type="number"/);

const delegationPanel = new GameCaptureDelegationPanel(null, null);
const grantRows = [
  Permission.RECORD_LIVE_GAME,
  Permission.EDIT_BOXSCORE,
  Permission.PREPARE_GAME,
  Permission.START_GAME,
  Permission.FINISH_GAME
].map((capability, index) => ({
  id: `88888888-8888-4888-8888-88888888888${index}`,
  delegate_user_id: "99999999-9999-4999-8999-999999999999",
  email: "family@example.com",
  name: "Familia Demo",
  capability,
  valid_from: "2026-09-06T18:00:00Z",
  valid_until: "2026-09-07T01:20:00Z",
  grant_note: "Anotador"
}));
const groups = delegationPanel._groupRows(grantRows);
assert.equal(groups.length, 1);
assert.equal(groups[0].ids.length, 5);
assert.equal(groups[0].capabilities.length, 5);
assert.match(delegationPanelSource, /Activas \(\$\{activeGroups\.length\}\)/);
assert.match(delegationPanelSource, /data-ids=/);
assert.match(delegationPanelSource, /for \(const delegationId of delegationIds\)/);

const version = release.release.split(".").map(Number);
const baseline = "2026.09.06.11".split(".").map(Number);
const compare = (a, b) => {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};
assert.ok(compare(version, baseline) >= 0, "La release V25 no puede retroceder.");
if (release.release === "2026.09.06.11") {
  assert.equal(release.label, "player-nutrition-delegated-game-ux-v25");
}

console.log("PLAYER_NUTRITION_DELEGATED_GAME_UX_V25_OK");
