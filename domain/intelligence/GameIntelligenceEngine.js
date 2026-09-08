/**
 * @fileoverview Deterministic team-level intelligence for one basketball game.
 * @description Converts player_game_stats into auditable descriptive metrics and
 * a PLAYER360_EVIDENCE_V1 bundle. It never ranks players, compares teammates or
 * makes causal/performance-quality claims. Provider calls and persistence live
 * outside this pure domain module.
 */

import { GAME_INTELLIGENCE_CONFIG } from "../../config/game-intelligence.config.js";

const COUNT_METRICS = Object.freeze([
  ["points", "competition.game.points"],
  ["fg2_attempted", "competition.game.fg2_attempted"],
  ["fg3_attempted", "competition.game.fg3_attempted"],
  ["ft_attempted", "competition.game.ft_attempted"],
  ["assists", "competition.game.assists"],
  ["turnovers", "competition.game.turnovers"],
  ["off_reb", "competition.game.off_reb"],
  ["def_reb", "competition.game.def_reb"],
  ["total_reb", "competition.game.total_reb"],
  ["steals", "competition.game.steals"],
  ["blocks", "competition.game.blocks"],
  ["fouls_committed", "competition.game.fouls_committed"]
]);

function numeric(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentage(made, attempted) {
  return attempted > 0 ? rounded((made / attempted) * 100) : null;
}

function normalizeRows(playerStats) {
  return (Array.isArray(playerStats) ? playerStats : []).filter(
    row => row && typeof row === "object" && !Array.isArray(row)
  );
}

function blocksOf(row) {
  if (row.blocks_made !== null && row.blocks_made !== undefined) {
    return numeric(row.blocks_made);
  }
  return numeric(row.blocks);
}

function aggregate(rows, field) {
  return rows.reduce((total, row) => total + numeric(row[field]), 0);
}

function countFact(metricKey, value, sampleSize) {
  return {
    fact_type: "GAME_METRIC",
    metric_key: metricKey,
    unit: "count",
    aggregation: "GAME_SUM",
    sample_size: sampleSize,
    last_value: rounded(value),
    causal_claim_allowed: false,
    status: "OBSERVED"
  };
}

function rateFact(metricKey, value, sampleSize) {
  return {
    fact_type: "GAME_METRIC",
    metric_key: metricKey,
    unit: metricKey.endsWith("_ratio") ? "ratio" : "pct",
    aggregation: "GAME_RATE",
    sample_size: sampleSize,
    last_value: rounded(value),
    causal_claim_allowed: false,
    status: "OBSERVED"
  };
}

function missingMetric(metricKey, sampleSize, reason) {
  return {
    fact_type: "MISSING_DATA",
    metric_key: metricKey,
    sample_size: sampleSize,
    causal_claim_allowed: false,
    status: "LIMITED",
    reason
  };
}

/**
 * Aggregates one game's player boxscore without retaining player identifiers.
 * @param {Array<Record<string, any>>} playerStats
 * @returns {Record<string, number|null>}
 */
export function aggregateTeamGameStats(playerStats = []) {
  const rows = normalizeRows(playerStats);
  const fg2Made = aggregate(rows, "fg2_made");
  const fg2Attempted = aggregate(rows, "fg2_attempted");
  const fg3Made = aggregate(rows, "fg3_made");
  const fg3Attempted = aggregate(rows, "fg3_attempted");
  const ftMade = aggregate(rows, "ft_made");
  const ftAttempted = aggregate(rows, "ft_attempted");
  const assists = aggregate(rows, "assists");
  const turnovers = aggregate(rows, "turnovers");
  const offReb = aggregate(rows, "off_reb");
  const defReb = aggregate(rows, "def_reb");
  const blocks = rows.reduce((total, row) => total + blocksOf(row), 0);
  const points = aggregate(rows, "points");
  const derivedPoints = (fg2Made * 2) + (fg3Made * 3) + ftMade;
  const fieldGoalAttempts = fg2Attempted + fg3Attempted;
  const assistTurnoverActions = assists + turnovers;

  return {
    tracked_players: rows.length,
    points,
    derived_points: derivedPoints,
    points_consistency_delta: rounded(points - derivedPoints),
    fg2_made: fg2Made,
    fg2_attempted: fg2Attempted,
    fg2_pct: percentage(fg2Made, fg2Attempted),
    fg3_made: fg3Made,
    fg3_attempted: fg3Attempted,
    fg3_pct: percentage(fg3Made, fg3Attempted),
    ft_made: ftMade,
    ft_attempted: ftAttempted,
    ft_pct: percentage(ftMade, ftAttempted),
    field_goal_attempts: fieldGoalAttempts,
    effective_fg_pct: fieldGoalAttempts > 0
      ? rounded(((fg2Made + (1.5 * fg3Made)) / fieldGoalAttempts) * 100)
      : null,
    assists,
    turnovers,
    assist_turnover_actions: assistTurnoverActions,
    assist_turnover_ratio: turnovers > 0 ? rounded(assists / turnovers) : null,
    off_reb: offReb,
    def_reb: defReb,
    total_reb: offReb + defReb,
    steals: aggregate(rows, "steals"),
    blocks,
    fouls_committed: aggregate(rows, "fouls_committed")
  };
}

/**
 * Builds deterministic post-game intelligence and provider-safe evidence.
 * Low samples suppress rate facts instead of inventing certainty.
 * @param {{playerStats?:Array<Record<string, any>>}} input
 * @returns {{snapshot:Record<string, any>, evidenceBundle:Record<string, any>}}
 */
export function buildGameIntelligence({ playerStats = [] } = {}) {
  const metrics = aggregateTeamGameStats(playerStats);
  const thresholds = GAME_INTELLIGENCE_CONFIG.minimumEvidence;
  const facts = [];
  const missingData = [];
  const limitations = [];

  if (metrics.tracked_players === 0) {
    missingData.push(missingMetric("competition.game.summary", 0, "NO_PLAYER_GAME_STATS"));
    limitations.push("NO_PLAYER_GAME_STATS");
  } else {
    for (const [field, metricKey] of COUNT_METRICS) {
      facts.push(countFact(metricKey, metrics[field], metrics.tracked_players));
    }

    const shotRates = [
      ["fg2_pct", "competition.game.fg2_pct", metrics.fg2_attempted, thresholds.fieldGoalAttemptsForPercentage],
      ["fg3_pct", "competition.game.fg3_pct", metrics.fg3_attempted, thresholds.fieldGoalAttemptsForPercentage],
      ["effective_fg_pct", "competition.game.effective_fg_pct", metrics.field_goal_attempts, thresholds.fieldGoalAttemptsForPercentage],
      ["ft_pct", "competition.game.ft_pct", metrics.ft_attempted, thresholds.freeThrowAttemptsForPercentage]
    ];

    for (const [field, metricKey, sampleSize, minimum] of shotRates) {
      if (sampleSize >= minimum && metrics[field] !== null) {
        facts.push(rateFact(metricKey, metrics[field], sampleSize));
      } else {
        missingData.push(missingMetric(metricKey, sampleSize, "LOW_SAMPLE"));
        limitations.push(`LOW_SAMPLE:${metricKey}`);
      }
    }

    if (
      metrics.assist_turnover_actions >= thresholds.assistTurnoverActionsForRatio
      && metrics.turnovers > 0
    ) {
      facts.push(rateFact(
        "competition.game.assist_turnover_ratio",
        metrics.assist_turnover_ratio,
        metrics.assist_turnover_actions
      ));
    } else {
      missingData.push(missingMetric(
        "competition.game.assist_turnover_ratio",
        metrics.assist_turnover_actions,
        metrics.turnovers > 0 ? "LOW_SAMPLE" : "ZERO_DENOMINATOR"
      ));
      limitations.push("LIMITED:competition.game.assist_turnover_ratio");
    }

    if (metrics.points_consistency_delta !== 0) {
      missingData.push(missingMetric(
        "competition.game.data_quality.points_consistency",
        metrics.tracked_players,
        "BOX_SCORE_POINTS_MISMATCH"
      ));
      limitations.push("BOX_SCORE_POINTS_MISMATCH");
    }
  }

  const qualityStatus = metrics.tracked_players === 0
    ? "NO_DATA"
    : (metrics.points_consistency_delta === 0 ? "OBSERVED" : "LIMITED");

  const snapshot = {
    contract_version: GAME_INTELLIGENCE_CONFIG.contractVersion,
    calculation_version: GAME_INTELLIGENCE_CONFIG.calculationVersion,
    interpretation_mode: GAME_INTELLIGENCE_CONFIG.interpretationMode,
    quality_status: qualityStatus,
    metrics,
    safeguards: { ...GAME_INTELLIGENCE_CONFIG.safeguards },
    limitations: [...new Set(limitations)]
  };

  const evidenceBundle = {
    evidence_version: GAME_INTELLIGENCE_CONFIG.evidenceVersion,
    calculation_version: GAME_INTELLIGENCE_CONFIG.calculationVersion,
    facts,
    missing_data: missingData,
    limitations: [...new Set(limitations)]
  };

  return { snapshot, evidenceBundle };
}

export default buildGameIntelligence;
