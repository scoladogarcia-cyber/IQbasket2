import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PLAYER360_CONFIG,
  PLAYER360_MODULE,
  PLAYER360_SENSITIVITY
} from "../config/player360.config.js";
import {
  normalizePlayer360Observation,
  buildInsightEvidenceBundle
} from "../domain/player360/contracts.js";
import { DataCoverageCalculator } from "../domain/player360/DataCoverageCalculator.js";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

function has(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

// -----------------------------------------------------------------------------
// Module configuration / privacy defaults
// -----------------------------------------------------------------------------
assert.equal(PLAYER360_CONFIG.modules[PLAYER360_MODULE.DATA_COVERAGE].defaultEnabled, true);
assert.equal(PLAYER360_CONFIG.modules[PLAYER360_MODULE.NUTRITION].defaultEnabled, false);
assert.equal(
  PLAYER360_CONFIG.modules[PLAYER360_MODULE.NUTRITION].sensitivity,
  PLAYER360_SENSITIVITY.WELLNESS_RESTRICTED
);
assert.equal(
  PLAYER360_CONFIG.modules[PLAYER360_MODULE.RECOVERY].sensitivity,
  PLAYER360_SENSITIVITY.WELLNESS_RESTRICTED
);
assert.equal(
  PLAYER360_CONFIG.modules[PLAYER360_MODULE.NEURO_COGNITIVE].defaultEnabled,
  false
);

// -----------------------------------------------------------------------------
// Observation contract
// -----------------------------------------------------------------------------
const observation = normalizePlayer360Observation({
  module: "training",
  player_id: "player-1",
  team_season_id: "team-season-1",
  occurred_at: "2026-09-03T10:00:00+02:00",
  source_type: "CLUB_COACH",
  metric_code: "shot_reps",
  value: 120,
  unit: "reps",
  quality: 0.9,
  confidence: 0.8,
  metadata: { block: "shooting" }
});

assert.equal(observation.contract_version, "PLAYER360_OBSERVATION_V1");
assert.equal(observation.metric_code, "SHOT_REPS");
assert.equal(observation.value, 120);
assert.equal(observation.quality, 0.9);
assert.equal(observation.module, "training");
assert.equal(observation.sensitivity, PLAYER360_SENSITIVITY.STANDARD);

assert.throws(
  () => normalizePlayer360Observation({
    module: "training",
    player_id: "player-1",
    occurred_at: "2026-09-03",
    source_type: "CLUB_COACH",
    metric_code: "RPE",
    quality: 2
  }),
  /quality debe estar entre 0 y 1/
);

assert.throws(
  () => normalizePlayer360Observation({
    module: "training",
    player_id: "player-1",
    occurred_at: "2026-09-03",
    source_type: "AI",
    metric_code: "RPE"
  }),
  /source_type no soportado/
);

// -----------------------------------------------------------------------------
// AI evidence is a separate contract, not an objective measurement
// -----------------------------------------------------------------------------
const evidence = buildInsightEvidenceBundle({
  playerId: "player-1",
  teamSeasonId: "team-season-1",
  facts: [{
    metric_code: "THREE_POINT_PCT",
    value: 24,
    sample_size: 6,
    source: "GAME_SYSTEM"
  }],
  missingData: ["PRE_GAME_FATIGUE"],
  limitations: ["SMALL_SAMPLE"],
  calculationVersion: "v1"
});

assert.equal(evidence.evidence_version, "PLAYER360_EVIDENCE_V1");
assert.equal(evidence.facts.length, 1);
assert.deepEqual(evidence.missing_data, ["PRE_GAME_FATIGUE"]);
assert.equal("source_type" in evidence, false);

// -----------------------------------------------------------------------------
// Deterministic coverage
// -----------------------------------------------------------------------------
const trainingCoverage = DataCoverageCalculator.calculateModule({
  module: "training",
  expectedMetricCodes: ["DURATION", "RPE", "SHOT_REPS", "ATTENDANCE"],
  observedMetricCodes: ["duration", "shot_reps", "UNRELATED"],
  quality: 0.8
});

assert.equal(trainingCoverage.coverage_pct, 50);
assert.equal(trainingCoverage.status, "PARTIAL");
assert.equal(trainingCoverage.matched_count, 2);
assert.deepEqual(trainingCoverage.missing_metric_codes, ["RPE", "ATTENDANCE"]);
assert.equal(trainingCoverage.quality_score, 0.8);

const noData = DataCoverageCalculator.calculateModule({
  module: "nutrition",
  expectedMetricCodes: ["HYDRATION", "MEAL_ADHERENCE"],
  observedMetricCodes: []
});
assert.equal(noData.coverage_pct, 0);
assert.equal(noData.status, "NO_DATA");

const disabled = DataCoverageCalculator.calculateModule({
  module: "recovery",
  expectedMetricCodes: ["SLEEP"],
  observedMetricCodes: ["SLEEP"],
  enabled: false
});
assert.equal(disabled.coverage_pct, null);
assert.equal(disabled.status, "NOT_ENABLED");

const overall = DataCoverageCalculator.calculateOverall([
  trainingCoverage,
  noData,
  disabled
]);
assert.equal(overall.coverage_pct, 25);
assert.equal(overall.enabled_modules, 2);
assert.equal(overall.modules_with_data, 1);

// -----------------------------------------------------------------------------
// RBAC + ABAC: sensitive wellness base permissions
// -----------------------------------------------------------------------------
// 4E.2 exposes Nutrition/Recovery only as a base capability. The authoritative
// read/write decision still lives in backend ABAC and cannot be inferred from
// ROLE_PERMISSIONS alone.
for (const role of [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.ENTRENADOR,
  UserRole.PREPARADOR_FISICO,
  UserRole.JUGADOR,
  UserRole.FAMILIA_TUTOR
]) {
  assert.equal(has(role, Permission.VIEW_RECOVERY), true, `${role} debe poder solicitar/ver Recovery vía ABAC`);
  assert.equal(has(role, Permission.EDIT_RECOVERY), true, `${role} debe poder editar Recovery vía ABAC`);
  assert.equal(has(role, Permission.VIEW_NUTRITION), true, `${role} debe poder solicitar/ver Nutrition vía ABAC`);
  assert.equal(has(role, Permission.EDIT_NUTRITION), true, `${role} debe poder editar Nutrition vía ABAC`);
  assert.equal(has(role, Permission.VIEW_WELLNESS_RECOMMENDATIONS), true);
}

for (const role of [
  UserRole.ANALISTA,
  UserRole.VISOR
]) {
  assert.equal(has(role, Permission.VIEW_RECOVERY), false);
  assert.equal(has(role, Permission.EDIT_RECOVERY), false);
  assert.equal(has(role, Permission.VIEW_NUTRITION), false);
  assert.equal(has(role, Permission.EDIT_NUTRITION), false);
  assert.equal(has(role, Permission.VIEW_WELLNESS_RECOMMENDATIONS), false);
}

// INVITADO can see the module shell, but RBAC never grants wellness mutation.
// Backend ABAC remains authoritative for whether any personal row is readable.
assert.equal(has(UserRole.INVITADO, Permission.VIEW_RECOVERY), true);
assert.equal(has(UserRole.INVITADO, Permission.EDIT_RECOVERY), false);
assert.equal(has(UserRole.INVITADO, Permission.VIEW_NUTRITION), true);
assert.equal(has(UserRole.INVITADO, Permission.EDIT_NUTRITION), false);
assert.equal(has(UserRole.INVITADO, Permission.VIEW_WELLNESS_RECOMMENDATIONS), true);

// Neuro remains closed in 4E.2; only SUPERADMIN has the dormant platform
// capability and no Neuro data model/UI is enabled.
assert.equal(has(UserRole.SUPERADMIN, Permission.VIEW_NEURO_DATA), true);
for (const role of [
  UserRole.ADMIN,
  UserRole.ENTRENADOR,
  UserRole.ANALISTA,
  UserRole.PREPARADOR_FISICO,
  UserRole.JUGADOR,
  UserRole.FAMILIA_TUTOR,
  UserRole.VISOR,
  UserRole.INVITADO
]) {
  assert.equal(has(role, Permission.VIEW_NEURO_DATA), false);
}

assert.equal(has(UserRole.ADMIN, Permission.CREATE_TRAINING), true);
assert.equal(has(UserRole.ENTRENADOR, Permission.CREATE_TRAINING), true);
assert.equal(has(UserRole.ANALISTA, Permission.VIEW_TRAINING), true);
assert.equal(has(UserRole.ANALISTA, Permission.CREATE_TRAINING), false);
assert.equal(has(UserRole.PREPARADOR_FISICO, Permission.VIEW_TRAINING), true);

assert.equal(has(UserRole.JUGADOR, Permission.VIEW_OWN_PLAYER_360), true);
assert.equal(has(UserRole.JUGADOR, Permission.VIEW_PLAYER_360), false);
assert.equal(has(UserRole.FAMILIA_TUTOR, Permission.VIEW_LINKED_PLAYER_360), true);
assert.equal(has(UserRole.FAMILIA_TUTOR, Permission.VIEW_PLAYER_360), false);

assert.equal(has(UserRole.VISOR, Permission.VIEW_OBJECTIVE_PROFILE), true);
assert.equal(has(UserRole.VISOR, Permission.VIEW_PRIVATE_PLAYER_EVALUATION), false);

// Phase 4D: analytical generation, AI generation and human approval are separate actions.
for (const role of [UserRole.ADMIN, UserRole.ENTRENADOR]) {
  assert.equal(has(role, Permission.VIEW_LONGITUDINAL_ANALYTICS), true);
  assert.equal(has(role, Permission.GENERATE_LONGITUDINAL_ANALYTICS), true);
  assert.equal(has(role, Permission.VIEW_AI_INSIGHTS), true);
  assert.equal(has(role, Permission.GENERATE_AI_INSIGHTS), true);
  assert.equal(has(role, Permission.REVIEW_AI_INSIGHTS), true);
}

for (const role of [UserRole.ANALISTA, UserRole.PREPARADOR_FISICO]) {
  assert.equal(has(role, Permission.VIEW_LONGITUDINAL_ANALYTICS), true);
  assert.equal(has(role, Permission.GENERATE_LONGITUDINAL_ANALYTICS), true);
  assert.equal(has(role, Permission.VIEW_AI_INSIGHTS), true);
  assert.equal(has(role, Permission.GENERATE_AI_INSIGHTS), true);
  assert.equal(has(role, Permission.REVIEW_AI_INSIGHTS), false);
}

assert.equal(has(UserRole.VISOR, Permission.VIEW_LONGITUDINAL_ANALYTICS), false);
assert.equal(has(UserRole.VISOR, Permission.VIEW_AI_INSIGHTS), false);

// INVITADO is a sporting read-only role: broad visibility without write grants.
for (const permission of [
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
  Permission.VIEW_AI_INSIGHTS,
  Permission.VIEW_RECOVERY,
  Permission.VIEW_NUTRITION,
  Permission.VIEW_WELLNESS_RECOMMENDATIONS
]) {
  assert.equal(has(UserRole.INVITADO, permission), true, `INVITADO debe poder consultar ${permission}`);
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
  Permission.REVIEW_AI_INSIGHTS
]) {
  assert.equal(has(UserRole.INVITADO, permission), false, `INVITADO no debe modificar mediante ${permission}`);
}
assert.equal(has(UserRole.INVITADO, Permission.VIEW_PRIVATE_PLAYER_EVALUATION), false);
assert.equal(has(UserRole.INVITADO, Permission.VIEW_RECOVERY), false);
assert.equal(has(UserRole.INVITADO, Permission.VIEW_NUTRITION), false);

// Phase 4E: privacy administration is granular and does not enable wellness data.
for (const permission of [
  Permission.VIEW_PRIVACY_AUTHORIZATIONS,
  Permission.CREATE_PRIVACY_AUTHORIZATION,
  Permission.REVOKE_PRIVACY_AUTHORIZATION,
  Permission.VIEW_SENSITIVE_ACCESS_GRANTS,
  Permission.GRANT_SENSITIVE_ACCESS,
  Permission.REVOKE_SENSITIVE_ACCESS,
  Permission.VIEW_PRIVACY_AUDIT
]) {
  assert.equal(has(UserRole.ADMIN, permission), true, `ADMIN debe disponer de ${permission}`);
}
assert.equal(has(UserRole.ADMIN, Permission.REQUEST_SENSITIVE_ACCESS), true);
for (const role of [
  UserRole.ENTRENADOR,
  UserRole.ANALISTA,
  UserRole.PREPARADOR_FISICO
]) {
  assert.equal(has(role, Permission.REQUEST_SENSITIVE_ACCESS), true);
  assert.equal(has(role, Permission.GRANT_SENSITIVE_ACCESS), false);
  assert.equal(has(role, Permission.REVOKE_SENSITIVE_ACCESS), false);
  assert.equal(has(role, Permission.CREATE_PRIVACY_AUTHORIZATION), false);
  assert.equal(has(role, Permission.VIEW_PRIVACY_AUDIT), false);
}
for (const role of [
  UserRole.JUGADOR,
  UserRole.FAMILIA_TUTOR,
  UserRole.VISOR,
  UserRole.INVITADO
]) {
  assert.equal(has(role, Permission.REQUEST_SENSITIVE_ACCESS), false);
  assert.equal(has(role, Permission.GRANT_SENSITIVE_ACCESS), false);
  assert.equal(has(role, Permission.CREATE_PRIVACY_AUTHORIZATION), false);
}

// 4E.2 activates only the Nutrition/Recovery base permissions above.
// Neuro remains outside the active product scope.
for (const role of [
  UserRole.ADMIN,
  UserRole.ENTRENADOR,
  UserRole.ANALISTA,
  UserRole.PREPARADOR_FISICO,
  UserRole.JUGADOR,
  UserRole.FAMILIA_TUTOR,
  UserRole.VISOR,
  UserRole.INVITADO
]) {
  assert.equal(has(role, Permission.VIEW_NEURO_DATA), false);
}

// Guard against accidentally duplicated ROLE_PERMISSIONS blocks in source.
const permissionSource = readFileSync(
  new URL("../security/permissions.js", import.meta.url),
  "utf8"
);
for (const role of [
  "ADMIN",
  "ENTRENADOR",
  "ANALISTA",
  "PREPARADOR_FISICO",
  "JUGADOR",
  "FAMILIA_TUTOR",
  "VISOR",
  "INVITADO"
]) {
  const marker = `[UserRole.${role}]: [`;
  assert.equal(
    permissionSource.split(marker).length - 1,
    1,
    `ROLE_PERMISSIONS contiene un bloque duplicado para ${role}`
  );
}

console.log("PLAYER360_PHASE4A_FOUNDATION_OK");
