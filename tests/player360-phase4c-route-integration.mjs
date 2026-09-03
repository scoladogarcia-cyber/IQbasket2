import assert from "node:assert/strict";
import fs from "node:fs";

import { PermissionService, Permission } from "../security/PermissionService.js";

const index = fs.readFileSync(new URL("../index.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const playerStats = fs.readFileSync(new URL("../views/PlayerStatsView.js", import.meta.url), "utf8");
const permissions = fs.readFileSync(new URL("../security/permissions.js", import.meta.url), "utf8");

for (const [name, source] of [["index.js", index], ["app.js", app]]) {
  assert.match(
    source,
    /import\s+\{\s*Player360View\s*\}\s+from\s+["']\.\/views\/Player360View\.js["']/,
    `${name} debe importar Player360View`
  );
  assert.match(
    source,
    /case\s+["']player360["'][\s\S]{0,500}Player360View|case\s+["']player360["'][\s\S]{0,500}views\.player360/,
    `${name} debe resolver #/player360/:playerId`
  );
}

assert.match(
  playerStats,
  /#\/player360\/\$\{encodeURIComponent\(String\(p\.id\)\)\}/,
  "La ficha de jugador debe enlazar al Player 360 del jugador seleccionado"
);
assert.match(
  permissions,
  /player360:\s*Permission\.VIEW_PLAYER_360/,
  "La ruta Player 360 debe conservar su gate RBAC"
);
assert.match(
  index,
  /routePlayerId\s*=\s*\[[^\]]*["']player360["'][^\]]*\]\.includes\(targetRoute\)/,
  "El router debe limitar el contexto playerId a rutas Player 360"
);
assert.match(
  index,
  /playerId:\s*routePlayerId/,
  "El gate de ruta debe recibir el jugador solicitado como contexto de recurso"
);

const teamId = "11111111-1111-4111-8111-111111111111";
const teamSeasonId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const playerId = "10000000-0000-4000-8000-000000000001";
const context = { teamId, teamSeasonId, playerId, playerTeamId: teamId };

const coach = new PermissionService({
  id: "coach-1",
  email: "coach@example.com",
  role: "ENTRENADOR",
  assigned_team_ids: [teamId],
  allowed_team_season_ids: [teamSeasonId]
});
assert.equal(coach.can(Permission.VIEW_PLAYER_360, context), true);

const guest = new PermissionService({
  id: "guest-1",
  email: "guest@example.com",
  role: "INVITADO",
  assigned_team_ids: [teamId],
  allowed_team_season_ids: [teamSeasonId]
});
assert.equal(guest.can(Permission.VIEW_PLAYER_360, context), true);
assert.equal(guest.can(Permission.CREATE_PLAYER_EVALUATION, context), false);
assert.equal(guest.can(Permission.EDIT_PLAYER_EVALUATION, context), false);
assert.equal(guest.can(Permission.CREATE_OBJECTIVE_PROFILE, context), false);
assert.equal(guest.can(Permission.EDIT_OBJECTIVE_PROFILE, context), false);

console.log("PLAYER360_PHASE4C_ROUTE_INTEGRATION_OK");
