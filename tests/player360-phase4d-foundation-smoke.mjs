import assert from "node:assert/strict";

import { normalizePlayer360Observation } from "../domain/player360/contracts.js";
import { LongitudinalAnalyticsCalculator } from "../domain/player360/LongitudinalAnalyticsCalculator.js";
import { LongitudinalEvidenceAssembler } from "../domain/player360/LongitudinalEvidenceAssembler.js";

const PLAYER_ID = "player-1";
const TEAM_SEASON_ID = "team-season-1";

function observation({ module, metric, value, occurredAt, sourceId }) {
  return normalizePlayer360Observation({
    module,
    player_id: PLAYER_ID,
    team_season_id: TEAM_SEASON_ID,
    occurred_at: occurredAt,
    source_type: module === "competition" ? "GAME_SYSTEM" : "CLUB_COACH",
    source_id: sourceId,
    metric_code: metric,
    value,
    quality: 1
  });
}

const observations = [];
for (let week = 0; week < 6; week += 1) {
  const trainingDate = new Date(Date.UTC(2026, 0, 5 + (week * 7), 18));
  const gameDate = new Date(Date.UTC(2026, 0, 12 + (week * 7), 12));

  observations.push(observation({
    module: "training",
    metric: "SESSION_LOAD",
    value: week + 1,
    occurredAt: trainingDate.toISOString(),
    sourceId: `training-${week + 1}`
  }));
  observations.push(observation({
    module: "competition",
    metric: "EFFICIENCY",
    value: (week + 1) * 2,
    occurredAt: gameDate.toISOString(),
    sourceId: `game-${week + 1}`
  }));
  if (week % 2 === 0) {
    observations.push(observation({
      module: "training",
      metric: "SPARSE_LOAD",
      value: week,
      occurredAt: trainingDate.toISOString(),
      sourceId: `sparse-${week + 1}`
    }));
  }
}

// LAST must retain the chronologically latest value inside the same week.
observations.push(observation({
  module: "evaluation",
  metric: "SHOOTING",
  value: 6.5,
  occurredAt: "2026-02-03T10:00:00.000Z",
  sourceId: "eval-1"
}));
observations.push(observation({
  module: "evaluation",
  metric: "SHOOTING",
  value: 7,
  occurredAt: "2026-02-05T10:00:00.000Z",
  sourceId: "eval-2"
}));

// A known metric with a non-numeric value is rejected explicitly.
observations.push(observation({
  module: "training",
  metric: "SESSION_LOAD",
  value: "not-numeric",
  occurredAt: "2026-02-20T10:00:00.000Z",
  sourceId: "invalid-1"
}));
observations.push(observation({
  module: "training",
  metric: "SESSION_LOAD",
  value: null,
  occurredAt: "2026-02-21T10:00:00.000Z",
  sourceId: "invalid-2"
}));

const snapshot = LongitudinalAnalyticsCalculator.calculate({
  playerId: PLAYER_ID,
  teamSeasonId: TEAM_SEASON_ID,
  period: { from: "2026-01-05", to: "2026-02-22" },
  observations,
  metricDefinitions: [
    {
      module: "training",
      metric_code: "SESSION_LOAD",
      unit: "AU",
      aggregation: "SUM"
    },
    {
      module: "competition",
      metric_code: "EFFICIENCY",
      unit: "INDEX",
      aggregation: "AVERAGE"
    },
    {
      module: "evaluation",
      metric_code: "SHOOTING",
      unit: "SCORE_0_10",
      aggregation: "LAST"
    },
    {
      module: "training",
      metric_code: "SPARSE_LOAD",
      unit: "AU",
      aggregation: "SUM"
    }
  ],
  associationDefinitions: [{
    left: "training.SESSION_LOAD",
    right: "competition.EFFICIENCY",
    lag_buckets: 1
  }]
});

assert.equal(snapshot.contract_version, "PLAYER360_LONGITUDINAL_V1");
assert.equal(snapshot.expected_buckets, 7);
assert.equal(snapshot.rejected_observations, 2);
assert.equal(Object.isFrozen(snapshot), true);

const training = snapshot.series.find(item => item.key === "training.SESSION_LOAD");
assert.equal(training.points.length, 6);
assert.equal(training.points[0].value, 1);
assert.equal(training.points.at(-1).value, 6);
assert.equal(training.coverage.coverage_pct, 85.71);
assert.equal(training.trend.status, "READY");
assert.equal(training.trend.direction, "UP");
assert.equal(training.trend.slope_per_week, 1);

const sparseTraining = snapshot.series.find(item => item.key === "training.SPARSE_LOAD");
assert.equal(sparseTraining.points.length, 3);
assert.equal(sparseTraining.trend.status, "READY");
assert.equal(sparseTraining.trend.slope_per_week, 1);

const evaluation = snapshot.series.find(item => item.key === "evaluation.SHOOTING");
assert.equal(evaluation.points.length, 1);
assert.equal(evaluation.points[0].value, 7);
assert.equal(evaluation.trend.status, "INSUFFICIENT_DATA");

const association = snapshot.associations[0];
assert.equal(association.status, "READY");
assert.equal(association.sample_size, 6);
assert.equal(association.coefficient, 1);
assert.equal(association.direction, "POSITIVE");
assert.equal(association.strength, "STRONG");

const evidence = LongitudinalEvidenceAssembler.build({
  snapshot,
  coverage: { status: "GOOD", coverage_pct: 85.71 },
  generatedAt: "2026-02-23T10:00:00.000Z"
});

assert.equal(evidence.evidence_version, "PLAYER360_EVIDENCE_V1");
assert.equal(evidence.calculation_version, snapshot.calculation_version);
assert.equal(
  evidence.facts.some(fact => fact.fact_type === "DESCRIPTIVE_ASSOCIATION"),
  true
);
assert.equal(
  evidence.facts.find(fact => fact.fact_type === "DESCRIPTIVE_ASSOCIATION")
    .causal_claim_allowed,
  false
);
assert.equal(
  evidence.missing_data.some(item => item.metric_key === "evaluation.SHOOTING"),
  true
);
assert.equal(
  evidence.limitations.some(item => item.includes("no demuestran causalidad")),
  true
);

const stintAwareSnapshot = LongitudinalAnalyticsCalculator.calculate({
  playerId: PLAYER_ID,
  teamSeasonId: TEAM_SEASON_ID,
  period: { from: "2026-01-05", to: "2026-02-22" },
  eligibilityPeriods: [{ from: "2026-01-19", to: "2026-02-08" }],
  observations,
  metricDefinitions: [{
    module: "training",
    metric_code: "SESSION_LOAD",
    unit: "AU",
    aggregation: "SUM"
  }]
});
const stintTraining = stintAwareSnapshot.series[0];
assert.equal(stintAwareSnapshot.expected_buckets, 3);
assert.deepEqual(stintAwareSnapshot.eligibility_periods, [{
  from: "2026-01-19",
  to: "2026-02-08"
}]);
assert.equal(stintTraining.points.length, 3);
assert.equal(stintTraining.points[0].value, 3);
assert.equal(stintTraining.points.at(-1).value, 5);
assert.equal(stintTraining.coverage.coverage_pct, 100);

assert.throws(
  () => LongitudinalAnalyticsCalculator.calculate({
    playerId: PLAYER_ID,
    teamSeasonId: TEAM_SEASON_ID,
    period: { from: "2026-03-01", to: "2026-02-01" },
    observations: [],
    metricDefinitions: []
  }),
  /period\.to no puede ser anterior/
);

console.log("PLAYER360_PHASE4D_FOUNDATION_OK");
