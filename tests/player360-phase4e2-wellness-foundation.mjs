import assert from "node:assert/strict";

import {
  PLAYER360_WELLNESS_CONFIG,
  PLAYER360_WELLNESS_DEFAULT_METRICS,
  PLAYER360_WELLNESS_PROHIBITED_DEFAULT_CODES,
  WELLNESS_VALUE_TYPE
} from "../config/player360-wellness.config.js";
import { WellnessObservationFactory } from "../domain/player360/WellnessObservationFactory.js";
import { WellnessRecommendationEngine } from "../domain/player360/WellnessRecommendationEngine.js";

const codes = new Set(PLAYER360_WELLNESS_DEFAULT_METRICS.map(metric => metric.code));
for (const prohibited of PLAYER360_WELLNESS_PROHIBITED_DEFAULT_CODES) {
  assert.equal(
    codes.has(prohibited),
    false,
    `El catálogo default no puede incluir ${prohibited}`
  );
}

assert.equal(PLAYER360_WELLNESS_CONFIG.allowFreeTextValue, false);
assert.equal(PLAYER360_WELLNESS_CONFIG.manualInputEnabled, true);
assert.equal(PLAYER360_WELLNESS_CONFIG.externalImportEnabled, false);
assert.equal(PLAYER360_WELLNESS_CONFIG.recommendationsEnabled, true);
assert.equal(PLAYER360_WELLNESS_CONFIG.aiProcessingEnabled, false);
assert.deepEqual(
  [...new Set(PLAYER360_WELLNESS_DEFAULT_METRICS.map(metric => metric.module))].sort(),
  ["nutrition", "recovery"]
);
assert.equal(
  PLAYER360_WELLNESS_DEFAULT_METRICS.every(
    metric => metric.sensitivity === "WELLNESS_RESTRICTED"
  ),
  true
);
assert.equal(
  PLAYER360_WELLNESS_DEFAULT_METRICS.some(
    metric => metric.value_type === "TEXT"
  ),
  false
);

const sleepMetric = PLAYER360_WELLNESS_DEFAULT_METRICS.find(
  metric => metric.code === "SLEEP_DURATION_HOURS"
);
const sleep = WellnessObservationFactory.create({
  metric: sleepMetric,
  playerId: "player-1",
  teamSeasonId: "team-season-1",
  occurredAt: "2026-09-03T07:30:00+02:00",
  sourceType: "PLAYER_SELF_REPORT",
  sourceId: "entry-1",
  value: 7.5,
  capturedBy: "user-1"
});
assert.equal(sleep.module, "recovery");
assert.equal(sleep.metric_code, "SLEEP_DURATION_HOURS");
assert.equal(sleep.value, 7.5);
assert.equal(sleep.unit, "HOURS");
assert.equal(sleep.sensitivity, "WELLNESS_RESTRICTED");
assert.equal(sleep.provenance.value_type, WELLNESS_VALUE_TYPE.NUMBER);

const booleanMetric = PLAYER360_WELLNESS_DEFAULT_METRICS.find(
  metric => metric.code === "PRE_TRAINING_FUELING"
);
const fueling = WellnessObservationFactory.create({
  metric: booleanMetric,
  playerId: "player-1",
  teamSeasonId: "team-season-1",
  occurredAt: "2026-09-03T16:00:00+02:00",
  sourceType: "PLAYER_SELF_REPORT",
  value: true
});
assert.equal(fueling.module, "nutrition");
assert.equal(fueling.value, true);
assert.equal(fueling.provenance.value_type, WELLNESS_VALUE_TYPE.BOOLEAN);

assert.throws(
  () => WellnessObservationFactory.create({
    metric: sleepMetric,
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03",
    sourceType: "PLAYER_SELF_REPORT",
    value: 20
  }),
  /supera el máximo/
);

assert.throws(
  () => WellnessObservationFactory.create({
    metric: booleanMetric,
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03",
    sourceType: "PLAYER_SELF_REPORT",
    value: "sí"
  }),
  /debe ser booleano/
);

assert.throws(
  () => WellnessObservationFactory.create({
    metric: {
      module: "nutrition",
      code: "FREE_TEXT_DIET",
      name: "Texto",
      value_type: "TEXT",
      sensitivity: "WELLNESS_RESTRICTED"
    },
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03",
    sourceType: "PLAYER_SELF_REPORT",
    value: "contenido libre"
  }),
  /tipo no soportado/
);

assert.throws(
  () => WellnessObservationFactory.create({
    metric: {
      module: "nutrition",
      code: "HYDRATION",
      value_type: "SCALE",
      min_value: 1,
      max_value: 5,
      sensitivity: "STANDARD"
    },
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03",
    sourceType: "PLAYER_SELF_REPORT",
    value: 3
  }),
  /debe ser WELLNESS_RESTRICTED/
);

const choiceMetric = {
  module: "recovery",
  code: "RECOVERY_WINDOW",
  value_type: "CHOICE",
  options: ["MORNING", "EVENING"],
  unit: "CODE",
  sensitivity: "WELLNESS_RESTRICTED"
};
const choice = WellnessObservationFactory.create({
  metric: choiceMetric,
  playerId: "player-1",
  teamSeasonId: "team-season-1",
  occurredAt: "2026-09-03",
  sourceType: "PLAYER_SELF_REPORT",
  value: "morning"
});
assert.equal(choice.value, "MORNING");

const fatigueMetric = PLAYER360_WELLNESS_DEFAULT_METRICS.find(
  metric => metric.code === "FATIGUE"
);
const hydrationMetric = PLAYER360_WELLNESS_DEFAULT_METRICS.find(
  metric => metric.code === "HYDRATION_ADHERENCE"
);
const readinessMetric = PLAYER360_WELLNESS_DEFAULT_METRICS.find(
  metric => metric.code === "READINESS"
);

const supportObservations = [
  WellnessObservationFactory.create({
    metric: fatigueMetric,
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03T15:00:00+02:00",
    sourceType: "PLAYER_SELF_REPORT",
    value: 4
  }),
  WellnessObservationFactory.create({
    metric: hydrationMetric,
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03T15:00:00+02:00",
    sourceType: "PLAYER_SELF_REPORT",
    value: 2
  }),
  WellnessObservationFactory.create({
    metric: readinessMetric,
    playerId: "player-1",
    teamSeasonId: "team-season-1",
    occurredAt: "2026-09-03T15:00:00+02:00",
    sourceType: "PLAYER_SELF_REPORT",
    value: 4
  })
];

const recommendations = WellnessRecommendationEngine.evaluate({
  observations: supportObservations
});
assert.equal(recommendations.length, 2);
assert.equal(recommendations[0].priority, "REVIEW");
assert.equal(recommendations[0].clinical_claim, false);
assert.equal(recommendations[0].causal_claim, false);
assert.equal(recommendations.every(item => item.source === "DETERMINISTIC_RULE"), true);
assert.equal(
  recommendations.some(item => item.code === "REVIEW_FATIGUE_LOAD"),
  true
);
assert.equal(
  recommendations.some(item => item.code === "SUPPORT_HYDRATION_PLAN"),
  true
);

const summary = WellnessRecommendationEngine.summarize(recommendations);
assert.deepEqual(summary, {
  total: 2,
  review: 1,
  support: 1,
  info: 0,
  hasRecommendations: true
});

const noRecommendations = WellnessRecommendationEngine.evaluate({
  observations: [
    WellnessObservationFactory.create({
      metric: fatigueMetric,
      playerId: "player-1",
      teamSeasonId: "team-season-1",
      occurredAt: "2026-09-03T15:00:00+02:00",
      sourceType: "PLAYER_SELF_REPORT",
      value: 2
    }),
    WellnessObservationFactory.create({
      metric: hydrationMetric,
      playerId: "player-1",
      teamSeasonId: "team-season-1",
      occurredAt: "2026-09-03T15:00:00+02:00",
      sourceType: "PLAYER_SELF_REPORT",
      value: 5
    })
  ]
});
assert.equal(noRecommendations.length, 0);

console.log("PLAYER360_PHASE4E2_WELLNESS_FOUNDATION_OK");
