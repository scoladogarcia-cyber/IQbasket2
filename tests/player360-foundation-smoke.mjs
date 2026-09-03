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
// RBAC: sporting development vs sensitive wellness
// -----------------------------------------------------------------------------
for (const sensitive of [
  Permission.VIEW_RECOVERY,
  Permission.EDIT_RECOVERY,
  Permission.VIEW_NUTRITION,
  Permission.EDIT_NUTRITION,
  Permission.VIEW_NEURO_DATA
]) {
  assert.equal(has(UserRole.SUPERADMIN, sensitive), true);
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
    assert.equal(
      has(role, sensitive),
      false,
      `${role} no debe recibir ${sensitive} antes de ABAC/privacidad 4E`
    );
  }
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
