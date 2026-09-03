/**
 * Converts deterministic longitudinal results into the evidence contract that
 * an AI renderer may consume. It never asks a model to calculate metrics.
 */

import { buildInsightEvidenceBundle } from "./contracts.js";

export class LongitudinalEvidenceAssembler {
  static build({ snapshot, coverage = null, generatedAt } = {}) {
    if (!snapshot?.player_id || !snapshot?.team_season_id) {
      throw new Error("LongitudinalEvidenceAssembler: snapshot longitudinal incompleto.");
    }

    const facts = [];
    const missingData = [];

    (snapshot.series || []).forEach(series => {
      if (series.trend?.status === "READY") {
        facts.push({
          fact_type: "LONGITUDINAL_TREND",
          metric_key: series.key,
          unit: series.unit,
          aggregation: series.aggregation,
          sample_size: series.trend.sample_size,
          direction: series.trend.direction,
          slope_per_week: series.trend.slope_per_week,
          first_value: series.trend.first_value,
          last_value: series.trend.last_value,
          absolute_change: series.trend.absolute_change,
          relative_change_pct: series.trend.relative_change_pct,
          coverage_pct: series.coverage?.coverage_pct ?? null
        });
      } else {
        missingData.push({
          evidence_type: "LONGITUDINAL_TREND",
          metric_key: series.key,
          observed_buckets: series.trend?.sample_size || 0,
          minimum_buckets: series.trend?.minimum_sample_size || null,
          reason: series.trend?.status || "NO_DATA"
        });
      }
    });

    (snapshot.associations || []).forEach(association => {
      if (association.status === "READY") {
        facts.push({
          fact_type: "DESCRIPTIVE_ASSOCIATION",
          left_metric_key: association.left,
          right_metric_key: association.right,
          lag_buckets: association.lag_buckets,
          sample_size: association.sample_size,
          coefficient: association.coefficient,
          direction: association.direction,
          strength: association.strength,
          causal_claim_allowed: false
        });
      } else {
        missingData.push({
          evidence_type: "DESCRIPTIVE_ASSOCIATION",
          left_metric_key: association.left,
          right_metric_key: association.right,
          observed_pairs: association.sample_size,
          minimum_pairs: association.minimum_sample_size,
          reason: association.status
        });
      }
    });

    if (coverage) {
      facts.push({
        fact_type: "DATA_COVERAGE",
        ...coverage
      });
    }

    return buildInsightEvidenceBundle({
      playerId: snapshot.player_id,
      teamSeasonId: snapshot.team_season_id,
      period: snapshot.period,
      facts,
      missingData,
      limitations: [
        ...(snapshot.limitations || []),
        "La IA solo puede redactar e interpretar los hechos incluidos; no puede sustituir sus cálculos."
      ],
      calculationVersion: snapshot.calculation_version,
      generatedAt
    });
  }
}

export default LongitudinalEvidenceAssembler;
