import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [layoutSource, appSource] = await Promise.all([
  readFile(new URL("../views/LayoutView.js", import.meta.url), "utf8"),
  readFile(new URL("../index.js", import.meta.url), "utf8")
]);

const logoutActionMatches = layoutSource.match(/data-session-action="logout"/g) || [];
assert.equal(
  logoutActionMatches.length,
  2,
  "Desktop y móvil deben exponer exactamente una acción de cierre de sesión cada uno."
);

const drawerStart = layoutSource.indexOf('id="mobile-more-drawer"');
const mobileLogout = layoutSource.indexOf('id="btn-mobile-logout"');
assert.ok(drawerStart >= 0, "Debe existir el drawer móvil.");
assert.ok(
  mobileLogout > drawerStart,
  "El cierre de sesión móvil debe estar dentro del drawer de navegación."
);

assert.match(
  layoutSource,
  /id="btn-mobile-logout"[\s\S]*?data-session-action="logout"/,
  "El botón móvil debe usar el hook compartido de sesión."
);

assert.match(
  layoutSource,
  /\.drawer-item-logout\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;/,
  "El cierre de sesión móvil debe ocupar una fila completa para ser fácilmente localizable."
);

assert.match(
  appSource,
  /querySelectorAll\('\[data-session-action="logout"\]'\)/,
  "La aplicación debe enlazar todas las superficies de cierre de sesión, no solo el botón desktop."
);

for (const key of [
  "iq_user_email",
  "iq_user_role",
  "iq_user_name",
  "iq_user_lastname",
  "iq_user_phone",
  "iq_user_teams_map",
  "iq_simulated_role",
  "iq_active_team_id",
  "iq_active_season"
]) {
  assert.ok(
    appSource.includes(`"${key}"`),
    `El cierre de sesión debe limpiar el contexto local ${key}.`
  );
}

assert.match(
  appSource,
  /this\.userRole\s*=\s*UserRole\.INVITADO;/,
  "Tras cerrar sesión el estado de aplicación debe volver al rol base."
);

assert.match(
  appSource,
  /this\.currentRoute\s*=\s*"dashboard";/,
  "El cambio de cuenta debe reiniciar la ruta para evitar heredar contexto de navegación."
);

console.log(JSON.stringify({
  desktopLogoutAction: true,
  mobileLogoutAction: true,
  accountContextCleanup: true,
  result: "PASS"
}));
console.log("SESSION_SWITCH_REGRESSION_OK");
