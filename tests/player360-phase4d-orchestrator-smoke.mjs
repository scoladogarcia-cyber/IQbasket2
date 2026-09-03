import assert from "node:assert/strict";

import { Player360ObservationAssembler } from "../services/player360/Player360ObservationAssembler.js";
import { LongitudinalAnalyticsOrchestrator } from "../services/player360/LongitudinalAnalyticsOrchestrator.js";

const PLAYER_ID = "player-1";
const TEAM_ID = "team-1";
const TEAM_SEASON_ID = "team-season-1";

const assembled = Player360ObservationAssembler.assemble({
  playerId: PLAYER_ID,
  teamSeasonId: TEAM_SEASON_ID,
  eligibleGames: [{ id: "game-1", date: "2026-01-10" }],
  playerGameStats: [
    {
      game_id: "game-1",
      player_id: PLAYER_ID,
      points: 12,
      evaluation: 14,
      minutes: 20,
      rebounds: 5,
      assists: 3,
      plus_minus: 4
    },
    {
      game_id: "game-not-eligible",
      player_id: PLAYER_ID,
      points: 99,
      evaluation: 99,
      minutes: 40,
      rebounds: 20,
      assists: 20,
      plus_minus: 50
    }
  ],
  trainingSessions: [{
    id: "training-1",
    session_date: "2026-01-15",
    participants: [{
      player_id: PLAYER_ID,
      attendance_status: "PRESENT",
      participated_minutes: 60,
      rpe: 5,
      internal_load: 300
    }]
  }],
  externalSessions: [{
    id: "external-1",
    player_id: PLAYER_ID,
    activity_date: "2026-01-20",
    source_type: "EXTERNAL_COACH",
    duration_minutes: 50,
    rpe: 4,
    internal_load: 200
  }],
  evaluations: [{
    id: "eval-1",
    evaluation_date: "2026-01-25",
    source_type: "CLUB_COACH",
    scores: [{
      metric_code: "SHOOTING",
      metric_name: "Tiro",
      domain_code: "TECHNICAL",
      score: 7
    }]
  }],
  evaluationMetrics: [{
    code: "SHOOTING",
    name: "Tiro",
    domain_code: "TECHNICAL",
    sensitivity: "PRIVATE_SPORTING"
  }]
});

assert.ok(assembled.observations.length > 0);
assert.equal(
  assembled.observations.some(item => item.source_id === "game-not-eligible"),
  false,
  "Las estadísticas de partidos no elegibles no pueden entrar en Player 360."
);
assert.equal(
  assembled.observations.some(item =>
    item.module === "training"
    && item.metric_code === "SESSION_LOAD"
    && item.value === 300
  ),
  true
);
assert.equal(
  assembled.observations.some(item =>
    item.module === "external_development"
    && item.sensitivity === "PRIVATE_SPORTING"
  ),
  true
);
assert.equal(assembled.metricLabels["evaluation.SHOOTING"], "Tiro");

const analyticsCalls = [];
const analyticsService = {
  async saveSnapshot(args) {
    analyticsCalls.push(structuredClone(args));
    return "snapshot-1";
  }
};

const dataStore = {
  getEligibleGamesForPlayer(playerId, teamId) {
    assert.equal(playerId, PLAYER_ID);
    assert.equal(teamId, TEAM_ID);
    return [{ id: "game-1", date: "2026-01-10" }];
  },
  getPlayerGameStats(playerId) {
    assert.equal(playerId, PLAYER_ID);
    return [{
      game_id: "game-1",
      player_id: PLAYER_ID,
      points: 12,
      evaluation: 14,
      minutes: 20,
      rebounds: 5,
      assists: 3,
      plus_minus: 4
    }];
  },
  getSeasonParticipantPlayers(teamId) {
    assert.equal(teamId, TEAM_ID);
    return [{
      id: PLAYER_ID,
      roster_stints: [{
        valid_from: "2026-01-08",
        valid_until: "2026-01-31"
      }]
    }];
  }
};

const trainingService = {
  async listSessions({ teamSeasonId, fromDate, toDate }) {
    assert.equal(teamSeasonId, TEAM_SEASON_ID);
    assert.equal(fromDate, "2026-01-01");
    assert.equal(toDate, "2026-02-15");
    return [{
      id: "training-1",
      session_date: "2026-01-15",
      participants: [{
        player_id: PLAYER_ID,
        attendance_status: "PRESENT",
        participated_minutes: 60,
        rpe: 5,
        internal_load: 300
      }]
    }];
  },
  async listExternalDevelopment({ teamSeasonId, playerId }) {
    assert.equal(teamSeasonId, TEAM_SEASON_ID);
    assert.equal(playerId, PLAYER_ID);
    return [{
      id: "external-1",
      player_id: PLAYER_ID,
      activity_date: "2026-01-20",
      source_type: "EXTERNAL_COACH",
      duration_minutes: 50,
      rpe: 4,
      internal_load: 200
    }];
  }
};

const evaluationService = {
  async listEvaluations({ teamSeasonId, playerId, includeHistory }) {
    assert.equal(teamSeasonId, TEAM_SEASON_ID);
    assert.equal(playerId, PLAYER_ID);
    assert.equal(includeHistory, false);
    return [{
      id: "eval-1",
      evaluation_date: "2026-01-25",
      source_type: "CLUB_COACH",
      scores: [{
        metric_code: "SHOOTING",
        metric_name: "Tiro",
        domain_code: "TECHNICAL",
        score: 7
      }]
    }];
  },
  async listMetrics({ teamSeasonId }) {
    assert.equal(teamSeasonId, TEAM_SEASON_ID);
    return [{
      code: "SHOOTING",
      name: "Tiro",
      domain_code: "TECHNICAL",
      sensitivity: "PRIVATE_SPORTING"
    }];
  }
};

const orchestrator = new LongitudinalAnalyticsOrchestrator({
  dataStore,
  trainingService,
  evaluationService,
  analyticsService
});

const context = {
  teamId: TEAM_ID,
  teamSeasonId: TEAM_SEASON_ID,
  playerId: PLAYER_ID,
  periodStart: "2026-01-01",
  periodEnd: "2026-02-15"
};

const firstCandidate = await orchestrator.buildSnapshotCandidate(context);
const secondCandidate = await orchestrator.buildSnapshotCandidate(context);

assert.equal(firstCandidate.sourceFingerprint, secondCandidate.sourceFingerprint);
assert.match(firstCandidate.sourceFingerprint, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(firstCandidate.snapshot.eligibility_periods, [{
  from: "2026-01-08",
  to: "2026-01-31"
}]);
assert.equal(firstCandidate.snapshot.expected_buckets, 4);
assert.equal(firstCandidate.sourceCounts.competition_games, 1);
assert.equal(firstCandidate.sourceCounts.training_sessions, 1);
assert.equal(firstCandidate.sourceCounts.external_sessions, 1);
assert.equal(firstCandidate.sourceCounts.evaluations, 1);
assert.equal(
  firstCandidate.evidenceBundle.facts
    .filter(fact => fact.fact_type === "DESCRIPTIVE_ASSOCIATION")
    .every(fact => fact.causal_claim_allowed === false),
  true
);

const generated = await orchestrator.generateAndSaveSnapshot(context);
assert.equal(generated.snapshotId, "snapshot-1");
assert.equal(analyticsCalls.length, 1);
assert.equal(analyticsCalls[0].teamSeasonId, TEAM_SEASON_ID);
assert.equal(analyticsCalls[0].playerId, PLAYER_ID);
assert.equal(analyticsCalls[0].sourceFingerprint, firstCandidate.sourceFingerprint);
assert.equal(
  analyticsCalls[0].snapshot.eligibility_periods[0].from,
  "2026-01-08"
);

console.log("PLAYER360_PHASE4D_ORCHESTRATOR_OK");
