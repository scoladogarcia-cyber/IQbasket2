import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const layout = await readFile(new URL("../views/LayoutView.js", import.meta.url), "utf8");
const app = await readFile(new URL("../index.js", import.meta.url), "utf8");
const player360 = await readFile(new URL("../views/Player360View.js", import.meta.url), "utf8");
const permissions = await readFile(new URL("../security/permissions.js", import.meta.url), "utf8");

assert.match(layout, /const ownPlayerId = currentUser\?\.playerId/);
assert.match(layout, /`player360\/\$\{ownPlayerId\}`/);
assert.match(layout, /data-route-key="\$\{myPlayerKey\}"/);
assert.match(layout, /return 'player360'/);

assert.match(app, /Permission\.VIEW_OWN_PLAYER_360/);
assert.match(app, /Permission\.VIEW_LINKED_PLAYER_360/);
assert.match(player360, /_viewPermission\(\)/);
assert.match(player360, /UserRole\.JUGADOR.*VIEW_OWN_PLAYER_360/);
assert.match(player360, /UserRole\.FAMILIA_TUTOR.*VIEW_LINKED_PLAYER_360/);
const playerRoleStart = permissions.indexOf("[UserRole.JUGADOR]: [");
const familyRoleStart = permissions.indexOf("[UserRole.FAMILIA_TUTOR]: [", playerRoleStart);
assert.ok(playerRoleStart >= 0 && familyRoleStart > playerRoleStart);
const playerRoleBlock = permissions.slice(playerRoleStart, familyRoleStart);
assert.match(playerRoleBlock, /Permission\.VIEW_OWN_PLAYER_360/);
assert.doesNotMatch(playerRoleBlock, /Permission\.VIEW_PLAYER_360,/);

console.log("PLAYER_SELF_ACCESS_CONTRACT_OK");
const { PermissionService, Permission, UserRole } = await import("../security/PermissionService.js");
const auth = new PermissionService();
auth.setCurrentUser({
  id: "user-player",
  email: "player@example.test",
  role: UserRole.JUGADOR,
  linked_player_id: "player-self",
  assigned_team_ids: ["team-1"],
  account_status: "ACTIVE"
});
assert.equal(auth.can(Permission.VIEW_OWN_PLAYER_360, { playerId: "player-self" }), true);
assert.equal(auth.can(Permission.VIEW_OWN_PLAYER_360, { playerId: "player-other" }), false);
assert.equal(auth.can(Permission.VIEW_PLAYER_360, { playerId: "player-self" }), false);

console.log("PLAYER_SELF_ACCESS_RUNTIME_OK");
