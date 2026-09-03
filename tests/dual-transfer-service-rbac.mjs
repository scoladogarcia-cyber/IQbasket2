import assert from "node:assert/strict";
import fs from "node:fs";

import { PermissionService, Permission } from "../security/PermissionService.js";

const service = fs.readFileSync(
  new URL("../services/transfers/TransferRequestService.js", import.meta.url),
  "utf8"
);
const permissions = fs.readFileSync(
  new URL("../security/permissions.js", import.meta.url),
  "utf8"
);

const superadmin = new PermissionService({
  id: "sa",
  email: "scolado@nechigroup.com",
  role: "SUPERADMIN"
});
assert.equal(superadmin.can(Permission.REVIEW_TRANSFER_SOURCE), true);
assert.equal(superadmin.can(Permission.REVIEW_TRANSFER_DESTINATION), true);
assert.equal(superadmin.can(Permission.FINALIZE_TRANSFER), true);

const admin = new PermissionService({
  id: "admin",
  email: "admin@example.com",
  role: "ADMIN"
});
assert.equal(admin.can(Permission.REQUEST_TRANSFER), true);
assert.equal(admin.can(Permission.REVIEW_TRANSFER_SOURCE), true);
assert.equal(admin.can(Permission.REVIEW_TRANSFER_DESTINATION), true);
assert.equal(admin.can(Permission.FINALIZE_TRANSFER), false);
assert.equal(admin.can(Permission.APPROVE_TRANSFER), false);

const coach = new PermissionService({
  id: "coach",
  email: "coach@example.com",
  role: "ENTRENADOR"
});
assert.equal(coach.can(Permission.REQUEST_TRANSFER), true);
assert.equal(coach.can(Permission.REVIEW_TRANSFER_SOURCE), false);
assert.equal(coach.can(Permission.REVIEW_TRANSFER_DESTINATION), false);
assert.equal(coach.can(Permission.FINALIZE_TRANSFER), false);

const analyst = new PermissionService({
  id: "analyst",
  email: "analyst@example.com",
  role: "ANALISTA"
});
assert.equal(analyst.can(Permission.REQUEST_TRANSFER), false);
assert.equal(analyst.can(Permission.REVIEW_TRANSFER_SOURCE), false);

assert.match(
  service,
  /iq_v4_transfer_request_capabilities/,
  "El servicio debe detectar V4 antes de usarlo."
);
assert.match(
  service,
  /iq_v3_transfer_request_capabilities/,
  "El servicio debe conservar fallback V3."
);
assert.match(
  service,
  /capabilities\?\.dual_review[\s\S]*iq_v4_request_transfer/,
  "Las nuevas solicitudes deben usar V4 cuando está disponible."
);
assert.match(service, /iq_v4_review_transfer_side/);
assert.match(service, /iq_v4_finalize_transfer_request/);
assert.match(
  service,
  /from_team_season_id\.eq\.\$\{scopeId\},to_team_season_id\.eq\.\$\{scopeId\}/,
  "El listado debe incluir solicitudes entrantes y salientes del ámbito activo."
);
assert.match(
  service,
  /roster_transfer_reviews/,
  "El servicio debe hidratar las decisiones de origen y destino."
);
assert.match(
  service,
  /readyForFinalization:[\s\S]*sourceReview\?\.decision === "APPROVED"[\s\S]*destinationReview\?\.decision === "APPROVED"/,
  "La UI sólo debe tratar como lista una solicitud aprobada por ambas partes."
);

assert.match(permissions, /REVIEW_TRANSFER_SOURCE/);
assert.match(permissions, /REVIEW_TRANSFER_DESTINATION/);
assert.match(permissions, /FINALIZE_TRANSFER/);

console.log("DUAL_TRANSFER_SERVICE_RBAC_OK");
