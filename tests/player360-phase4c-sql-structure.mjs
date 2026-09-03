import assert from "node:assert/strict";
import fs from "node:fs";

const path = new URL(
  "../supabase/ready/20260903_apply_v4_phase4c_evaluation_objective.sql",
  import.meta.url
);
const sql = fs.readFileSync(path, "utf8");

const normalized = sql.toLowerCase();

assert.equal(
  (normalized.match(/^[ \t]*begin;[ \t]*$/gm) || []).length,
  1,
  "Phase 4C apply debe abrir una sola transacción"
);

assert.equal(
  (normalized.match(/^[ \t]*commit;[ \t]*$/gm) || []).length,
  1,
  "Phase 4C apply debe cerrar una sola transacción"
);

for (const table of [
  "player360_evaluation_metrics",
  "player_evaluations",
  "player_evaluation_scores",
  "player_objective_profiles",
  "player_objective_targets"
]) {
  assert.match(
    normalized,
    new RegExp("create\\s+table\\s+public\\." + table + "\\s*\\("),
    "Falta tabla " + table
  );
  assert.match(
    normalized,
    new RegExp(
      "alter\\s+table\\s+public\\." + table
      + "\\s+enable\\s+row\\s+level\\s+security"
    ),
    "RLS no activada en " + table
  );
}

for (const fn of [
  "iq_v4_can_manage_evaluation",
  "iq_v4_can_view_private_evaluation",
  "iq_v4_can_manage_objective_profile",
  "iq_v4_list_evaluation_metrics",
  "iq_v4_upsert_evaluation_metric",
  "iq_v4_save_player_evaluation",
  "iq_v4_archive_player_evaluation",
  "iq_v4_save_objective_profile",
  "iq_v4_archive_objective_profile",
  "iq_v4_get_player_objective_gap",
  "iq_v4_evaluation_capabilities"
]) {
  assert.match(
    normalized,
    new RegExp("create\\s+or\\s+replace\\s+function\\s+public\\." + fn),
    "Falta función " + fn
  );
}

assert.match(
  normalized,
  /revoke\s+insert,\s*update,\s*delete[\s\S]+from\s+authenticated;/,
  "Las mutaciones directas authenticated deben estar revocadas"
);

assert.match(
  normalized,
  /player_not_eligible_on_evaluation_date/,
  "La evaluación debe validar elegibilidad temporal"
);

assert.match(
  normalized,
  /player_not_eligible_on_objective_date/,
  "El perfil objetivo debe validar elegibilidad temporal"
);

assert.match(
  normalized,
  /status\s*=\s*'superseded'/,
  "Debe conservar histórico mediante revisiones superseded"
);

assert.match(
  normalized,
  /'player_family_access',\s*false/,
  "Phase 4C no debe abrir player/family access"
);

assert.match(
  normalized,
  /'ai_writes_evidence',\s*false/,
  "La IA no puede escribir evidencia de evaluación"
);

console.log("PLAYER360_PHASE4C_SQL_STRUCTURE_OK");
