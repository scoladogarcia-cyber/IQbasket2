import assert from "node:assert/strict";
import fs from "node:fs";

const apply = fs.readFileSync(
  new URL("../supabase/ready/20260903_apply_v4_dual_transfer.sql", import.meta.url),
  "utf8"
);
const verify = fs.readFileSync(
  new URL("../supabase/ready/20260903_verify_v4_dual_transfer_readonly.sql", import.meta.url),
  "utf8"
);
const rollback = fs.readFileSync(
  new URL("../supabase/ready/20260903_rollback_v4_dual_transfer.sql", import.meta.url),
  "utf8"
);

assert.match(apply, /add column if not exists requested_first_date_to date/i);
assert.match(apply, /create table if not exists public\.roster_transfer_reviews/i);
assert.match(apply, /unique \(request_id, side\)/i);
assert.match(apply, /side in \('SOURCE','DESTINATION'\)/i);

assert.match(
  apply,
  /iq_v4_can_review_transfer_scope[\s\S]*'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'/i,
  "La revisión debe limitarse a gobierno de plantilla, no a cualquier editor."
);
assert.doesNotMatch(
  apply.match(/create or replace function public\.iq_v4_can_review_transfer_scope[\s\S]*?\$\$;/i)?.[0] || "",
  /ENTRENADOR|AYUDANTE/i,
  "Entrenador/ayudante pueden solicitar, pero no aprobar administrativamente el traspaso."
);

assert.match(apply, /iq_v4_request_transfer\(\s*p_player_id uuid[\s\S]*p_requested_first_date_to date/i);
assert.match(apply, /workflow_version = 'DUAL_REVIEW_V2'/i);
assert.match(apply, /AUTO_APPROVED_BY_DESTINATION_REQUESTER/i);

assert.match(apply, /iq_v4_review_transfer_side/i);
assert.match(apply, /TRANSFER_SIDE_REVIEW_DENIED/i);
assert.match(apply, /TARGET_START_MUST_BE_AFTER_SOURCE_END/i);
assert.match(apply, /TRANSFER_REVIEW_DATE_OUTSIDE_SEASON/i);

assert.match(
  apply,
  /iq_v3_approve_transfer_request[\s\S]*DUAL_TRANSFER_REVIEWS_REQUIRED[\s\S]*DUAL_TRANSFER_REVIEW_DATES_MISMATCH/i,
  "La API legacy no debe poder saltarse las dos revisiones de una solicitud V2."
);
assert.match(
  apply,
  /iq_v4_finalize_transfer_request[\s\S]*SUPERADMIN_REQUIRED_FOR_TRANSFER_FINALIZATION[\s\S]*iq_v3_approve_transfer_request/i,
  "La finalización técnica debe seguir usando el motor V3 bajo SUPERADMIN."
);

assert.match(apply, /enable row level security/i);
assert.match(apply, /revoke insert, update, delete/i);
assert.match(apply, /iq_v4_transfer_reviews_select_authorized/i);
assert.match(
  apply,
  /iq_v3_transfer_request_select_authorized[\s\S]*requested_by = auth\.uid\(\)/i,
  "El solicitante debe poder leer su propia petición sin obtener permisos de mutación."
);

assert.doesNotMatch(rollback, /drop table/i, "Rollback no debe borrar auditoría de revisiones.");
assert.doesNotMatch(rollback, /drop column/i, "Rollback no debe destruir metadatos añadidos.");
assert.doesNotMatch(
  rollback,
  /DUAL_TRANSFER_REVIEWS_REQUIRED/i,
  "Rollback debe restaurar la función legacy sin el gate V2."
);

assert.match(verify, /TRANSFER_DUAL_VERIFY/i);
assert.match(verify, /legacy_guard_reviews_ok/i);
assert.match(verify, /finalizer_superadmin_ok/i);

console.log("DUAL_TRANSFER_SQL_OK");
