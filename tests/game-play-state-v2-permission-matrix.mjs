import assert from "node:assert/strict";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const ACTIONS = [
  Permission.PREPARE_GAME,
  Permission.START_GAME,
  Permission.FINISH_GAME,
  Permission.CANCEL_GAME
];

for (const action of ACTIONS) assert(ROLE_PERMISSIONS[UserRole.SUPERADMIN].includes(action));
for (const action of ACTIONS) assert(ROLE_PERMISSIONS[UserRole.ADMIN].includes(action));
for (const action of ACTIONS) assert(ROLE_PERMISSIONS[UserRole.ENTRENADOR].includes(action));
for (const action of ACTIONS.slice(0, 3)) assert(ROLE_PERMISSIONS[UserRole.ANALISTA].includes(action));
assert(!ROLE_PERMISSIONS[UserRole.ANALISTA].includes(Permission.CANCEL_GAME));

for (const role of [UserRole.PREPARADOR_FISICO, UserRole.JUGADOR, UserRole.FAMILIA_TUTOR, UserRole.VISOR, UserRole.INVITADO]) {
  for (const action of ACTIONS) assert(!ROLE_PERMISSIONS[role].includes(action), `${role} unexpectedly has ${action}`);
}

console.log("GAME_PLAY_STATE_PERMISSION_MATRIX_OK");
