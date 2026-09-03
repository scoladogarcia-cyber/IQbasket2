/**
 * Deterministic objective-gap utilities for Player 360.
 *
 * Positive gap => improvement still required.
 * Zero/negative gap => target met or exceeded.
 * Missing current score => NO_EVALUATION; never coerced to zero.
 */

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export class ObjectiveGapCalculator {
  static calculate({ targets = [], evaluations = [] } = {}) {
    const latestByMetric = new Map();

    (Array.isArray(evaluations) ? evaluations : [])
      .filter(item => String(item?.status || "CURRENT").toUpperCase() === "CURRENT")
      .sort((a, b) => {
        const da = String(a?.evaluation_date || a?.evaluationDate || "");
        const db = String(b?.evaluation_date || b?.evaluationDate || "");
        if (da !== db) return db.localeCompare(da);
        return String(b?.created_at || "").localeCompare(String(a?.created_at || ""));
      })
      .forEach(evaluation => {
        (Array.isArray(evaluation?.scores) ? evaluation.scores : []).forEach(score => {
          const code = normalizeCode(score.metric_code || score.metricCode);
          if (!code || latestByMetric.has(code)) return;
          latestByMetric.set(code, {
            score: finiteOrNull(score.score),
            evaluationId: evaluation.id || null,
            evaluationDate: evaluation.evaluation_date || evaluation.evaluationDate || null
          });
        });
      });

    return (Array.isArray(targets) ? targets : []).map(target => {
      const code = normalizeCode(target.metric_code || target.metricCode);
      const current = latestByMetric.get(code) || null;
      const targetScore = finiteOrNull(target.target_score ?? target.targetScore);
      const currentScore = finiteOrNull(current?.score);
      const higherIsBetter = target.higher_is_better ?? target.higherIsBetter ?? true;

      const gap = currentScore === null || targetScore === null
        ? null
        : (higherIsBetter
          ? targetScore - currentScore
          : currentScore - targetScore);

      return Object.freeze({
        profile_id: target.profile_id || target.profileId || null,
        metric_code: code,
        domain_code: String(target.domain_code || target.domainCode || "").toUpperCase(),
        metric_name: target.metric_name || target.metricName || code,
        current_score: currentScore,
        target_score: targetScore,
        gap_to_target: gap,
        priority_weight: finiteOrNull(target.priority_weight ?? target.priorityWeight) ?? 1,
        last_evaluation_date: current?.evaluationDate || null,
        current_evaluation_id: current?.evaluationId || null,
        data_status: currentScore === null ? "NO_EVALUATION" : "AVAILABLE",
        gap_status: currentScore === null
          ? "NO_DATA"
          : (gap <= 0 ? "TARGET_MET" : "GAP")
      });
    });
  }

  static classify(row = {}) {
    if (row.data_status === "NO_EVALUATION" || row.current_score === null) return "NO_DATA";
    const gap = finiteOrNull(row.gap_to_target);
    if (gap === null) return "NO_DATA";
    return gap <= 0 ? "TARGET_MET" : "GAP";
  }

  static summarize(rows = []) {
    const list = Array.isArray(rows) ? rows : [];
    const withData = list.filter(row => this.classify(row) !== "NO_DATA");
    const met = withData.filter(row => this.classify(row) === "TARGET_MET");
    const pending = withData.filter(row => this.classify(row) === "GAP");

    const weightedPending = pending.reduce((sum, row) => {
      const gap = Math.max(0, finiteOrNull(row.gap_to_target) ?? 0);
      const weight = finiteOrNull(row.priority_weight) ?? 1;
      return sum + gap * weight;
    }, 0);

    return Object.freeze({
      total_targets: list.length,
      targets_with_data: withData.length,
      targets_without_data: list.length - withData.length,
      targets_met: met.length,
      targets_pending: pending.length,
      weighted_pending_gap: Math.round(weightedPending * 1000) / 1000
    });
  }
}

export default ObjectiveGapCalculator;
