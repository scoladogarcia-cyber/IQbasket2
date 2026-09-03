/**
 * Deterministic data coverage calculator.
 *
 * Coverage answers "how much information do we have?", never "how well is the
 * player performing?". A 0% module means no information, not poor performance.
 */

import { PLAYER360_CONFIG } from "../../config/player360.config.js";

function uniqueNormalized(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(value => String(value ?? "").trim().toUpperCase())
      .filter(Boolean)
  )];
}

function normalizeQuality(value) {
  if (value === null || value === undefined || value === "") {
    return PLAYER360_CONFIG.coverage.qualityDefault;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return PLAYER360_CONFIG.coverage.qualityDefault;
  return Math.max(0, Math.min(1, number));
}

function coverageStatus(coveragePct) {
  const { thresholds } = PLAYER360_CONFIG.coverage;
  if (coveragePct <= thresholds.NONE_MAX) return "NO_DATA";
  if (coveragePct <= thresholds.LOW_MAX) return "LOW";
  if (coveragePct <= thresholds.PARTIAL_MAX) return "PARTIAL";
  if (coveragePct <= thresholds.GOOD_MAX) return "GOOD";
  return "COMPLETE";
}

export class DataCoverageCalculator {
  static calculateModule({
    module,
    expectedMetricCodes = [],
    observedMetricCodes = [],
    quality = null,
    enabled = true
  } = {}) {
    const moduleCode = String(module ?? "").trim().toLowerCase();
    if (!moduleCode) {
      throw new Error("DataCoverageCalculator: module es obligatorio.");
    }

    const expected = uniqueNormalized(expectedMetricCodes);
    const observed = uniqueNormalized(observedMetricCodes);

    if (!enabled) {
      return Object.freeze({
        module: moduleCode,
        enabled: false,
        status: "NOT_ENABLED",
        expected_count: expected.length,
        observed_count: 0,
        matched_count: 0,
        missing_metric_codes: expected,
        coverage_pct: null,
        quality_score: null
      });
    }

    const expectedSet = new Set(expected);
    const matched = expected.length
      ? observed.filter(code => expectedSet.has(code))
      : [];

    const coveragePct = expected.length
      ? Math.round((matched.length / expected.length) * 10000) / 100
      : 0;

    const missing = expected.filter(code => !matched.includes(code));

    return Object.freeze({
      module: moduleCode,
      enabled: true,
      status: coverageStatus(coveragePct),
      expected_count: expected.length,
      observed_count: observed.length,
      matched_count: matched.length,
      missing_metric_codes: missing,
      coverage_pct: coveragePct,
      quality_score: normalizeQuality(quality)
    });
  }

  static calculateOverall(moduleResults = []) {
    const enabled = (Array.isArray(moduleResults) ? moduleResults : [])
      .filter(result => result?.enabled && Number.isFinite(result?.coverage_pct));

    if (!enabled.length) {
      return Object.freeze({
        status: "NO_DATA",
        coverage_pct: 0,
        enabled_modules: 0,
        modules_with_data: 0
      });
    }

    const total = enabled.reduce((sum, result) => sum + result.coverage_pct, 0);
    const coveragePct = Math.round((total / enabled.length) * 100) / 100;

    return Object.freeze({
      status: coverageStatus(coveragePct),
      coverage_pct: coveragePct,
      enabled_modules: enabled.length,
      modules_with_data: enabled.filter(result => result.coverage_pct > 0).length
    });
  }
}

export default DataCoverageCalculator;
