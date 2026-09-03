/**
 * Deterministic, explainable recommendation engine for manual Nutrition/Recovery
 * check-ins. It is intentionally non-clinical and does not call AI providers.
 */

import {
  PLAYER360_WELLNESS_CONFIG,
  WELLNESS_RECOMMENDATION_PRIORITY
} from "../../config/player360-wellness.config.js";

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeModule(value) {
  return String(value || "").trim().toLowerCase();
}

function ruleMatches(rule, observation) {
  const metricCode = normalizeCode(observation?.metric_code ?? observation?.metricCode);
  const moduleCode = normalizeModule(observation?.module);
  if (metricCode !== normalizeCode(rule.metric_code)) return false;
  if (moduleCode !== normalizeModule(rule.module)) return false;

  const value = observation?.value;
  switch (String(rule.trigger || "").toUpperCase()) {
    case "LTE":
      return Number.isFinite(Number(value)) && Number(value) <= Number(rule.threshold);
    case "GTE":
      return Number.isFinite(Number(value)) && Number(value) >= Number(rule.threshold);
    case "EQ":
      return value === rule.threshold;
    default:
      return false;
  }
}

const PRIORITY_WEIGHT = Object.freeze({
  [WELLNESS_RECOMMENDATION_PRIORITY.REVIEW]: 3,
  [WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT]: 2,
  [WELLNESS_RECOMMENDATION_PRIORITY.INFO]: 1
});

export class WellnessRecommendationEngine {
  static evaluate({
    observations = [],
    rules = PLAYER360_WELLNESS_CONFIG.recommendationRules
  } = {}) {
    if (!PLAYER360_WELLNESS_CONFIG.recommendationsEnabled) {
      return Object.freeze([]);
    }

    const normalizedObservations = Array.isArray(observations) ? observations : [];
    const recommendations = [];

    for (const rule of Array.isArray(rules) ? rules : []) {
      const evidence = normalizedObservations.filter(item => ruleMatches(rule, item));
      if (!evidence.length) continue;

      recommendations.push(Object.freeze({
        code: rule.code,
        module: rule.module,
        metric_code: rule.metric_code,
        priority: rule.priority,
        title: rule.title,
        message: rule.message,
        evidence: Object.freeze(evidence.map(item => Object.freeze({
          metric_code: normalizeCode(item.metric_code ?? item.metricCode),
          value: item.value,
          occurred_at: item.occurred_at ?? item.occurredAt ?? null
        }))),
        clinical_claim: false,
        causal_claim: false,
        source: "DETERMINISTIC_RULE"
      }));
    }

    return Object.freeze(
      recommendations
        .sort((left, right) => {
          const priorityDelta =
            (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0);
          if (priorityDelta !== 0) return priorityDelta;
          return String(left.code).localeCompare(String(right.code));
        })
    );
  }

  static summarize(recommendations = []) {
    const rows = Array.isArray(recommendations) ? recommendations : [];
    return Object.freeze({
      total: rows.length,
      review: rows.filter(item => item.priority === WELLNESS_RECOMMENDATION_PRIORITY.REVIEW).length,
      support: rows.filter(item => item.priority === WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT).length,
      info: rows.filter(item => item.priority === WELLNESS_RECOMMENDATION_PRIORITY.INFO).length,
      hasRecommendations: rows.length > 0
    });
  }
}

export default WellnessRecommendationEngine;
