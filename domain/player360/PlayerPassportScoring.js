/**
 * @fileoverview Pure longitudinal scoring helpers for Player Passport.
 * @description Preserves ordinal 1-5 semantics, NE and evaluation confidence.
 */

export function normalizePassportScore(value) {
  if (value === null || value === undefined || value === "" || value === "NE") return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

export function latestScoresByAttribute(evaluations = []) {
  const sorted = [...(Array.isArray(evaluations) ? evaluations : [])].sort((a, b) =>
    String(b?.evaluation_date || "").localeCompare(String(a?.evaluation_date || ""))
  );
  const result = new Map();
  for (const evaluation of sorted) {
    for (const score of evaluation?.scores || []) {
      const code = String(score?.metric_code || "").toUpperCase();
      const value = normalizePassportScore(score?.score);
      if (!code || value === null || result.has(code)) continue;
      result.set(code, {
        ...score,
        score: value,
        evaluation_date: evaluation.evaluation_date,
        evaluation_id: evaluation.id,
        context: score.evaluation_context || score.metadata?.evaluation_context || evaluation.metadata?.evaluation_context || null,
        confidence: score.confidence_label || score.metadata?.confidence_label || null,
        evidence_count: Number(score.evidence_count ?? score.metadata?.evidence_count ?? 0) || 0
      });
    }
  }
  return result;
}

export function summarizePassport(catalog = [], evaluations = [], { strengthThreshold = 4, limiterThreshold = 2 } = {}) {
  const latest = latestScoresByAttribute(evaluations);
  const attributes = (Array.isArray(catalog) ? catalog : []).map(attribute => {
    const score = latest.get(String(attribute.code || "").toUpperCase()) || null;
    return { ...attribute, latest: score };
  });
  const rated = attributes.filter(item => item.latest?.score != null);
  const strengths = rated.filter(item => item.latest.score >= strengthThreshold)
    .sort((a,b) => b.latest.score - a.latest.score || a.name.localeCompare(b.name));
  const limiters = rated.filter(item => item.latest.score <= limiterThreshold)
    .sort((a,b) => a.latest.score - b.latest.score || a.name.localeCompare(b.name));
  return {
    attributes,
    ratedCount: rated.length,
    totalCount: attributes.length,
    coverage: attributes.length ? rated.length / attributes.length : 0,
    strengths,
    limiters
  };
}

export function rightLeftAsymmetries(summaryAttributes = []) {
  const byCode = new Map((summaryAttributes || []).map(x => [x.code, x]));
  const pairs = [
    ["TEC-BOT-01","TEC-BOT-02","Bote"],
    ["TEC-PAS-01","TEC-PAS-02","Pase"],
    ["TEC-FIN-01","TEC-FIN-02","Finalización"]
  ];
  return pairs.map(([rightCode,leftCode,label]) => {
    const right = byCode.get(rightCode)?.latest?.score ?? null;
    const left = byCode.get(leftCode)?.latest?.score ?? null;
    return {
      label, rightCode, leftCode, right, left,
      difference: right != null && left != null ? right - left : null
    };
  });
}
