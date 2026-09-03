import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PermissionService, Permission } from "../security/PermissionService.js";

const service = readFileSync(
  new URL("../services/games/GameLockService.js", import.meta.url),
  "utf8"
);
const dataStore = readFileSync(new URL("../services/DataStore.js", import.meta.url), "utf8");
const view = readFileSync(new URL("../views/GameLiveEditorView.js", import.meta.url), "utf8");
const boxScoreView = readFileSync(new URL("../views/GameBoxScoreView.js", import.meta.url), "utf8");

const teamId = "11111111-1111-4111-8111-111111111111";
const teamSeasonId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { teamId, teamSeasonId };

const admin = new PermissionService({
  id: "admin-1",
  email: "admin@example.com",
  role: "ADMIN",
  assigned_team_ids: [teamId],
  allowed_team_season_ids: [teamSeasonId]
});
assert.equal(admin.can(Permission.LOCK_GAME, context), true);
assert.equal(admin.can(Permission.REOPEN_GAME, context), true);
assert.equal(admin.can(Permission.REVIEW_GAME_LOCK_REQUESTS, context), true);
assert.equal(admin.can(Permission.REQUEST_GAME_LOCK, context), false);
assert.equal(admin.can(Permission.EDIT_BOXSCORE, context), true);

const coach = new PermissionService({
  id: "coach-1",
  email: "coach@example.com",
  role: "ENTRENADOR",
  assigned_team_ids: [teamId],
  allowed_team_season_ids: [teamSeasonId]
});
assert.equal(coach.can(Permission.REQUEST_GAME_LOCK, context), true);
assert.equal(coach.can(Permission.LOCK_GAME, context), false);
assert.equal(coach.can(Permission.REOPEN_GAME, context), false);
assert.equal(coach.can(Permission.EDIT_BOXSCORE, context), true);

const analyst = new PermissionService({
  id: "analyst-1",
  email: "analyst@example.com",
  role: "ANALISTA",
  assigned_team_ids: [teamId],
  allowed_team_season_ids: [teamSeasonId]
});
assert.equal(analyst.can(Permission.REQUEST_GAME_LOCK, context), true);
assert.equal(analyst.can(Permission.LOCK_GAME, context), false);
assert.equal(analyst.can(Permission.EDIT_BOXSCORE, context), true);

const guest = new PermissionService({
  id: "guest-1",
  email: "guest@example.com",
  role: "INVITADO",
  assigned_team_ids: [teamId],
  allowed_team_season_ids: [teamSeasonId]
});
assert.equal(guest.can(Permission.VIEW_GAMES, context), true);
assert.equal(guest.can(Permission.REQUEST_GAME_LOCK, context), false);
assert.equal(guest.can(Permission.LOCK_GAME, context), false);
assert.equal(guest.can(Permission.EDIT_BOXSCORE, context), false);

assert.match(service, /iq_v5_request_game_lock/);
assert.match(service, /iq_v5_set_game_edit_state/);
assert.match(service, /iq_v5_resolve_game_lock_request/);
assert.match(dataStore, /Partido cerrado: reabre el partido antes de modificar datos/i);
assert.match(view, /Solicitar cierre/i);
assert.match(view, /Reabrir/i);
assert.match(view, /Peticiones de cierre/i);
assert.match(boxScoreView, /Permission\.EDIT_BOXSCORE/);
assert.match(boxScoreView, /GameLockService\.isLocked/);
assert.match(boxScoreView, /_isTeamSeasonFrozen/);
assert.match(boxScoreView, /this\._canEdit\(currentGame\)/);

console.log("GAME_LOCKING_UI_RBAC_OK");
