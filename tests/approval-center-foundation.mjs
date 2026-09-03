import assert from "node:assert/strict";
import fs from "node:fs";

import { PermissionService, Permission } from "../security/PermissionService.js";

const service = fs.readFileSync(
  new URL("../services/ApprovalCenterService.js", import.meta.url),
  "utf8"
);
const view = fs.readFileSync(
  new URL("../views/ApprovalCenterView.js", import.meta.url),
  "utf8"
);
const layout = fs.readFileSync(
  new URL("../views/LayoutView.js", import.meta.url),
  "utf8"
);
const index = fs.readFileSync(new URL("../index.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const permissions = fs.readFileSync(
  new URL("../security/permissions.js", import.meta.url),
  "utf8"
);
const translations = fs.readFileSync(
  new URL("../services/TranslationStore.js", import.meta.url),
  "utf8"
);
const gameLockService = fs.readFileSync(
  new URL("../services/games/GameLockService.js", import.meta.url),
  "utf8"
);

function user(role) {
  return new PermissionService({
    id: role.toLowerCase() + "-1",
    email: role === "SUPERADMIN"
      ? "scolado@nechigroup.com"
      : role.toLowerCase() + "@example.com",
    role
  });
}

const admin = user("ADMIN");
assert.equal(admin.can(Permission.VIEW_APPROVAL_CENTER), true);
assert.equal(admin.can(Permission.APPROVE_TEAM_ACCESS), true);
assert.equal(admin.can(Permission.REVIEW_GAME_LOCK_REQUESTS), true);

const coach = user("ENTRENADOR");
assert.equal(coach.can(Permission.VIEW_APPROVAL_CENTER), true);
assert.equal(coach.can(Permission.REQUEST_GAME_LOCK), true);
assert.equal(coach.can(Permission.REVIEW_GAME_LOCK_REQUESTS), false);
assert.equal(coach.can(Permission.APPROVE_TEAM_ACCESS), false);

const analyst = user("ANALISTA");
assert.equal(analyst.can(Permission.VIEW_APPROVAL_CENTER), true);
assert.equal(analyst.can(Permission.REQUEST_GAME_LOCK), true);
assert.equal(analyst.can(Permission.REVIEW_GAME_LOCK_REQUESTS), false);

const guest = user("INVITADO");
assert.equal(guest.can(Permission.VIEW_APPROVAL_CENTER), true);
assert.equal(guest.can(Permission.APPROVE_TEAM_ACCESS), false);
assert.equal(guest.can(Permission.REVIEW_GAME_LOCK_REQUESTS), false);
assert.equal(guest.can(Permission.LOCK_GAME), false);

const player = user("JUGADOR");
assert.equal(player.can(Permission.VIEW_APPROVAL_CENTER), true);
assert.equal(player.can(Permission.APPROVE_TEAM_ACCESS), false);

const family = user("FAMILIA_TUTOR");
assert.equal(family.can(Permission.VIEW_APPROVAL_CENTER), true);
assert.equal(family.can(Permission.APPROVE_TEAM_ACCESS), false);

assert.match(
  service,
  /new TeamAccessRequestService\(this\.supabase\)/,
  "La bandeja debe reutilizar TeamAccessRequestService."
);
assert.match(
  service,
  /new GameLockService\(this\.supabase, this\.auth\)/,
  "La bandeja debe reutilizar GameLockService."
);
assert.match(
  service,
  /Promise\.allSettled/,
  "Un fallo de una fuente no debe derribar toda la bandeja."
);
assert.match(
  service,
  /Permission\.APPROVE_TEAM_ACCESS/,
  "La aprobación de accesos debe respetar su permiso específico."
);
assert.match(
  service,
  /canReviewRequests\(game\)/,
  "La aprobación de cierres debe respetar el permiso del servicio de partidos."
);
assert.match(
  service,
  /teamAccessService\.reviewRequest\(item\.id, true\)/,
  "Aprobar acceso debe delegarse al servicio existente."
);
assert.match(
  service,
  /gameLockService\.resolveRequest\(item\.id, "APPROVED"/,
  "Aprobar cierre debe delegarse al servicio existente."
);
assert.doesNotMatch(
  service,
  /\.from\([^\n]+\)\s*\.(?:insert|update|delete|upsert)\(/,
  "ApprovalCenterService no debe escribir directamente en Supabase."
);

assert.match(
  view,
  /Permission\.VIEW_APPROVAL_CENTER/,
  "La vista debe tener gate de lectura propio."
);
assert.match(
  view,
  /item\.canApprove/,
  "La UI no debe mostrar aprobación sólo por estar dentro de la bandeja."
);
assert.match(
  view,
  /item\.canReject/,
  "La UI no debe mostrar rechazo sólo por estar dentro de la bandeja."
);
assert.match(
  view,
  /min-height:44px/,
  "Los controles deben conservar targets táctiles aptos para móvil."
);
assert.match(
  view,
  /replaceAll\("&", "&amp;"\)/,
  "La vista debe escapar contenido procedente de solicitudes."
);

for (const alias of ["approvals", "requests", "solicitudes", "bandeja"]) {
  assert.match(
    permissions,
    new RegExp(alias + ":\\s*Permission\\.VIEW_APPROVAL_CENTER"),
    `La ruta ${alias} debe pasar por VIEW_APPROVAL_CENTER.`
  );
  assert.match(
    index,
    new RegExp(`case\\s+["']${alias}["']`),
    `index.js debe resolver ${alias}.`
  );
  assert.match(
    app,
    new RegExp(`case\\s+["']${alias}["']`),
    `app.js debe resolver ${alias}.`
  );
}

assert.match(
  layout,
  /key:\s*"approvals"[\s\S]{0,180}fallback:\s*"Solicitudes"/,
  "El menú desktop debe exponer Solicitudes."
);
assert.match(
  layout,
  /href="#\/approvals"[\s\S]{0,180}Solicitudes/,
  "El drawer móvil debe exponer Solicitudes."
);
assert.match(
  index,
  /import\s+\{\s*ApprovalCenterView\s*\}\s+from\s+["']\.\/views\/ApprovalCenterView\.js["']/,
  "El router principal debe importar ApprovalCenterView."
);
assert.match(
  app,
  /import\s+\{\s*ApprovalCenterView\s*\}\s+from\s+["']\.\/views\/ApprovalCenterView\.js["']/,
  "El router de compatibilidad debe importar ApprovalCenterView."
);
assert.equal(
  (translations.match(/approval_center:\s*"/g) || []).length,
  4,
  "El acceso a la bandeja debe tener fallback ES/CA/EN/FR."
);
assert.equal(
  (translations.match(/"approvals\.title":\s*"/g) || []).length,
  4,
  "El título de la bandeja debe tener fallback ES/CA/EN/FR."
);
assert.match(
  view,
  /TranslationStore/,
  "La vista debe usar el sistema de traducción existente."
);
assert.match(
  view,
  /_itemTitle\(item\)/,
  "La presentación de títulos debe resolverse en la vista y no en el servicio."
);
assert.doesNotMatch(
  service,
  /Cerrar partido vs|Acceso a \$\{request\.teamName/,
  "El agregador no debe contener copy de presentación."
);

assert.match(
  gameLockService,
  /async listRequests\(gameIds = \[\], \{ status = null \} = \{\}\)/,
  "GameLockService debe exponer un listado reutilizable sin romper listPendingRequests."
);
assert.match(
  gameLockService,
  /async listPendingRequests\(gameIds = \[\]\)[\s\S]{0,100}this\.listRequests/,
  "La API legacy listPendingRequests debe mantenerse."
);

console.log("APPROVAL_CENTER_FOUNDATION_OK");
