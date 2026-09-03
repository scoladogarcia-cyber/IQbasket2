import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const has = permission => (ROLE_PERMISSIONS[UserRole.INVITADO] || []).includes(permission);

for (const permission of [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_TEAM,
  Permission.VIEW_ROSTER,
  Permission.VIEW_PLAYER_PROFILE,
  Permission.VIEW_PLAYER_STATS,
  Permission.VIEW_GAMES,
  Permission.VIEW_BOXSCORE,
  Permission.VIEW_LINEUPS,
  Permission.VIEW_ADVANCED_TEAM_STATS,
  Permission.VIEW_ADVANCED_PLAYER_STATS,
  Permission.VIEW_PLAYER_COMPARISON,
  Permission.VIEW_TRAINING,
  Permission.VIEW_EXTERNAL_DEVELOPMENT,
  Permission.VIEW_PLAYER_360,
  Permission.VIEW_PLAYER_EVALUATION,
  Permission.VIEW_OBJECTIVE_PROFILE,
  Permission.VIEW_DATA_COVERAGE,
  Permission.VIEW_LONGITUDINAL_ANALYTICS,
  Permission.VIEW_AI_INSIGHTS
]) {
  assert.equal(has(permission), true, `INVITADO debe consultar ${permission}`);
}

for (const permission of [
  Permission.CREATE_GAME,
  Permission.EDIT_GAME,
  Permission.DELETE_GAME,
  Permission.RECORD_LIVE_GAME,
  Permission.CREATE_TRAINING,
  Permission.EDIT_TRAINING,
  Permission.DELETE_TRAINING,
  Permission.CREATE_EXTERNAL_DEVELOPMENT,
  Permission.EDIT_EXTERNAL_DEVELOPMENT,
  Permission.CREATE_PLAYER_EVALUATION,
  Permission.EDIT_PLAYER_EVALUATION,
  Permission.ARCHIVE_PLAYER_EVALUATION,
  Permission.CREATE_OBJECTIVE_PROFILE,
  Permission.EDIT_OBJECTIVE_PROFILE,
  Permission.ARCHIVE_OBJECTIVE_PROFILE,
  Permission.GENERATE_LONGITUDINAL_ANALYTICS,
  Permission.GENERATE_AI_INSIGHTS,
  Permission.REVIEW_AI_INSIGHTS,
  Permission.MANAGE_CLUBS,
  Permission.MANAGE_TEAMS,
  Permission.MANAGE_ROSTER,
  Permission.MANAGE_SEASONS,
  Permission.MANAGE_TRANSLATIONS
]) {
  assert.equal(has(permission), false, `INVITADO no debe recibir ${permission}`);
}

assert.equal(has(Permission.VIEW_PRIVATE_PLAYER_EVALUATION), false);
assert.equal(has(Permission.VIEW_RECOVERY), false);
assert.equal(has(Permission.VIEW_NUTRITION), false);
assert.equal(has(Permission.VIEW_PRIVACY_AUTHORIZATIONS), false);

const layoutSource = readFileSync(
  new URL("../views/LayoutView.js", import.meta.url),
  "utf8"
);
assert.doesNotMatch(
  layoutSource,
  /isTrainingRestricted\s*=\s*\[[^\]]*"INVITADO"/,
  "LayoutView no debe hardcodear INVITADO como bloqueado para Training."
);
assert.match(layoutSource, /\.mobile-drawer-overlay\s*\{[\s\S]*height:\s*100dvh/i);
assert.match(
  layoutSource,
  /\.mobile-drawer-content\s*\{[\s\S]*max-height:\s*calc\(100dvh[\s\S]*overflow-y:\s*auto[\s\S]*touch-action:\s*pan-y/i
);

const settingsSource = readFileSync(
  new URL("../views/TranslationsView.js", import.meta.url),
  "utf8"
);
assert.match(settingsSource, /\.iq-modal-overlay\s*\{[\s\S]*height:\s*100dvh/i);
assert.match(
  settingsSource,
  /\.iq-modal-card\s*\{[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto[\s\S]*touch-action:\s*pan-y/i
);

console.log("MOBILE_INVITED_READONLY_REGRESSION_OK");
