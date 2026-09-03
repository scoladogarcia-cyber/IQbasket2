import assert from "node:assert/strict";

import { ObjectiveGapCalculator } from "../domain/player360/ObjectiveGapCalculator.js";
import { EvaluationService } from "../services/player360/EvaluationService.js";

// -----------------------------------------------------------------------------
// Domain: deterministic gaps.
// -----------------------------------------------------------------------------
const evaluations = [
  {
    id: "eval-new",
    evaluation_date: "2026-02-10",
    status: "CURRENT",
    created_at: "2026-02-10T10:00:00Z",
    scores: [
      { metric_code: "SHOOTING", score: 7 },
      { metric_code: "TURNOVER_RATE", score: 4 }
    ]
  },
  {
    id: "eval-old",
    evaluation_date: "2026-01-10",
    status: "CURRENT",
    created_at: "2026-01-10T10:00:00Z",
    scores: [
      { metric_code: "SHOOTING", score: 6 }
    ]
  }
];

const targets = [
  {
    profile_id: "profile-1",
    metric_code: "SHOOTING",
    domain_code: "TECHNICAL",
    metric_name: "Tiro",
    target_score: 8.5,
    higher_is_better: true,
    priority_weight: 2
  },
  {
    profile_id: "profile-1",
    metric_code: "TURNOVER_RATE",
    domain_code: "TACTICAL",
    metric_name: "Pérdidas",
    target_score: 3,
    higher_is_better: false,
    priority_weight: 1
  },
  {
    profile_id: "profile-1",
    metric_code: "AGILITY",
    domain_code: "PHYSICAL",
    metric_name: "Agilidad",
    target_score: 8,
    higher_is_better: true,
    priority_weight: 1
  }
];

const gaps = ObjectiveGapCalculator.calculate({ targets, evaluations });

assert.equal(gaps[0].current_score, 7);
assert.equal(gaps[0].gap_to_target, 1.5);
assert.equal(gaps[0].gap_status, "GAP");

assert.equal(gaps[1].current_score, 4);
assert.equal(gaps[1].gap_to_target, 1);
assert.equal(gaps[1].gap_status, "GAP");

assert.equal(gaps[2].current_score, null);
assert.equal(gaps[2].gap_to_target, null);
assert.equal(gaps[2].data_status, "NO_EVALUATION");
assert.equal(gaps[2].gap_status, "NO_DATA");

const summary = ObjectiveGapCalculator.summarize(gaps);
assert.deepEqual(summary, {
  total_targets: 3,
  targets_with_data: 2,
  targets_without_data: 1,
  targets_met: 0,
  targets_pending: 2,
  weighted_pending_gap: 4
});

// -----------------------------------------------------------------------------
// Service: controlled RPC payloads + hydrated read models.
// -----------------------------------------------------------------------------
const calls = [];

const dataByTable = {
  player_evaluations: [
    {
      id: "eval-1",
      team_season_id: "ts-1",
      player_id: "player-1",
      evaluation_date: "2026-02-10",
      title: "Evaluación",
      status: "CURRENT"
    }
  ],
  player_evaluation_scores: [
    {
      id: "score-1",
      evaluation_id: "eval-1",
      team_season_id: "ts-1",
      metric_code: "SHOOTING",
      score: 7
    }
  ],
  player_objective_profiles: [
    {
      id: "profile-1",
      team_season_id: "ts-1",
      player_id: "player-1",
      effective_date: "2026-02-10",
      status: "ACTIVE"
    }
  ],
  player_objective_targets: [
    {
      id: "target-1",
      profile_id: "profile-1",
      team_season_id: "ts-1",
      metric_code: "SHOOTING",
      target_score: 8.5
    }
  ]
};

class FakeQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.limitValue = null;
  }

  select(columns) {
    calls.push({ type: "select", table: this.table, columns });
    return this;
  }

  eq(key, value) {
    this.filters.push({ op: "eq", key, value });
    return this;
  }

  neq(key, value) {
    this.filters.push({ op: "neq", key, value });
    return this;
  }

  in(key, values) {
    this.filters.push({ op: "in", key, values: values.map(String) });
    return this;
  }

  order() {
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  then(resolve, reject) {
    let rows = [...(dataByTable[this.table] || [])];

    for (const filter of this.filters) {
      if (filter.op === "eq") {
        rows = rows.filter(row => String(row[filter.key]) === String(filter.value));
      }
      if (filter.op === "neq") {
        rows = rows.filter(row => String(row[filter.key]) !== String(filter.value));
      }
      if (filter.op === "in") {
        rows = rows.filter(row => filter.values.includes(String(row[filter.key])));
      }
    }

    if (this.limitValue !== null) rows = rows.slice(0, this.limitValue);

    return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  }
}

const fakeSupabase = {
  from(table) {
    calls.push({ type: "from", table });
    return new FakeQuery(table);
  },

  async rpc(name, args = {}) {
    calls.push({ type: "rpc", name, args });

    if (name === "iq_v4_evaluation_capabilities") {
      return {
        data: {
          ready: true,
          evaluation: true,
          objective_profile: true,
          metric_catalog: true
        },
        error: null
      };
    }

    if (name === "iq_v4_list_evaluation_metrics") {
      return {
        data: [
          {
            id: "metric-1",
            code: "SHOOTING",
            domain_code: "TECHNICAL",
            name: "Tiro",
            scale_min: 0,
            scale_max: 10,
            scale_step: 0.5,
            higher_is_better: true
          }
        ],
        error: null
      };
    }

    if (name === "iq_v4_save_player_evaluation") {
      return { data: "eval-new", error: null };
    }

    if (name === "iq_v4_save_objective_profile") {
      return { data: "profile-new", error: null };
    }

    if (name === "iq_v4_get_player_objective_gap") {
      return {
        data: [
          {
            profile_id: "profile-1",
            metric_code: "SHOOTING",
            current_score: 7,
            target_score: 8.5,
            gap_to_target: 1.5,
            data_status: "AVAILABLE"
          }
        ],
        error: null
      };
    }

    if (name === "iq_v4_archive_player_evaluation"
      || name === "iq_v4_archive_objective_profile") {
      return { data: true, error: null };
    }

    throw new Error("RPC inesperada: " + name);
  }
};

const service = new EvaluationService(fakeSupabase);

const capabilities = await service.getCapabilities();
assert.equal(capabilities.evaluation, true);

const metrics = await service.listMetrics({ teamSeasonId: "ts-1" });
assert.equal(metrics.length, 1);
assert.equal(metrics[0].code, "SHOOTING");

const hydratedEvaluations = await service.listEvaluations({
  teamSeasonId: "ts-1",
  playerId: "player-1"
});
assert.equal(hydratedEvaluations.length, 1);
assert.equal(hydratedEvaluations[0].scores.length, 1);

const profile = await service.getActiveObjectiveProfile({
  teamSeasonId: "ts-1",
  playerId: "player-1"
});
assert.equal(profile.id, "profile-1");
assert.equal(profile.targets.length, 1);

await service.saveEvaluation({
  teamSeasonId: "ts-1",
  playerId: "player-1",
  evaluationDate: "2026-02-10",
  title: "Evaluación UI",
  scores: [{ metric_code: "SHOOTING", score: 7.5 }]
});

const saveEvalCall = calls.find(
  call => call.type === "rpc" && call.name === "iq_v4_save_player_evaluation"
);
assert.ok(saveEvalCall);
assert.equal(saveEvalCall.args.p_team_season_id, "ts-1");
assert.equal(saveEvalCall.args.p_player_id, "player-1");
assert.equal(saveEvalCall.args.p_scores[0].metric_code, "SHOOTING");
assert.equal(saveEvalCall.args.p_scores[0].score, 7.5);

await service.saveObjectiveProfile({
  teamSeasonId: "ts-1",
  playerId: "player-1",
  effectiveDate: "2026-02-10",
  title: "Objetivo",
  targets: [{
    metric_code: "SHOOTING",
    target_score: 8.5,
    priority_weight: 2
  }]
});

const saveProfileCall = calls.find(
  call => call.type === "rpc" && call.name === "iq_v4_save_objective_profile"
);
assert.ok(saveProfileCall);
assert.equal(saveProfileCall.args.p_targets[0].target_score, 8.5);
assert.equal(saveProfileCall.args.p_targets[0].priority_weight, 2);

const rpcGap = await service.getObjectiveGap("profile-1");
assert.equal(rpcGap[0].gap_to_target, 1.5);

console.log("PLAYER360_PHASE4C_DOMAIN_SERVICE_OK");
