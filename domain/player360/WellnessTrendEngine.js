/**
 * Descriptive trend engine for Player 360 Nutrition + Recovery.
 *
 * The engine is deliberately deterministic and provider-independent. It works
 * only with observations that have already passed backend ABAC checks and does
 * not make clinical, diagnostic, prognostic or causal claims.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const WELLNESS_TREND_DIRECTION = Object.freeze({
  UP: "UP",
  DOWN: "DOWN",
  STABLE: "STABLE",
  INSUFFICIENT: "INSUFFICIENT"
});

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function parseIsoDate(value) {
  const normalized = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWindow(anchorDate, daysBack) {
  return new Date(anchorDate.getTime() - Math.max(0, daysBack) * DAY_MS);
}

function mean(values) {
  const numeric = normalizeArray(values)
    .map(Number)
    .filter(Number.isFinite);
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function ratio(values) {
  const booleans = normalizeArray(values).filter(value => typeof value === "boolean");
  if (!booleans.length) return null;
  return booleans.filter(Boolean).length / booleans.length;
}

function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function metricThreshold(metric = {}) {
  const step = Number(metric.step);
  if (Number.isFinite(step) && step > 0) return Math.max(step / 2, 0.05);

  const min = Number(metric.min_value);
  const max = Number(metric.max_value);
  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    return Math.max((max - min) * 0.05, 0.05);
  }

  return 0.1;
}

function direction(current, previous, threshold) {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) {
    return WELLNESS_TREND_DIRECTION.INSUFFICIENT;
  }
  const delta = Number(current) - Number(previous);
  if (Math.abs(delta) < threshold) return WELLNESS_TREND_DIRECTION.STABLE;
  return delta > 0
    ? WELLNESS_TREND_DIRECTION.UP
    : WELLNESS_TREND_DIRECTION.DOWN;
}

function entryDateValue(entry = {}) {
  const parsed = parseIsoDate(entry.entry_date ?? entry.entryDate);
  return parsed ? parsed.getTime() : null;
}

function observationValue(observation = {}) {
  return observation.value;
}

function seriesForMetric(entries, code) {
  const normalizedCode = normalizeCode(code);
  const rows = [];

  for (const entry of normalizeArray(entries)) {
    const date = parseIsoDate(entry.entry_date ?? entry.entryDate);
    if (!date) continue;
    const observation = normalizeArray(entry.observations).find(item =>
      normalizeCode(item?.metric_code ?? item?.metricCode) === normalizedCode
    );
    if (!observation || observationValue(observation) === null || observationValue(observation) === undefined) {
      continue;
    }
    rows.push(Object.freeze({
      date: String(entry.entry_date ?? entry.entryDate).slice(0, 10),
      timestamp: date.getTime(),
      value: observationValue(observation),
      value_type: observation.value_type ?? observation.valueType ?? null,
      unit: observation.unit ?? null
    }));
  }

  return rows.sort((left, right) => left.timestamp - right.timestamp);
}

function windowValues(series, fromInclusive, toInclusive) {
  return series
    .filter(item => item.timestamp >= fromInclusive.getTime() && item.timestamp <= toInclusive.getTime())
    .map(item => item.value);
}

/**
 * Builds descriptive 7/28-day trend summaries anchored to the latest available
 * check-in. This prevents an old season from being compared against today's
 * calendar date and keeps historical views deterministic.
 */
export class WellnessTrendEngine {
  static analyze({
    entries = [],
    metrics = [],
    shortWindowDays = 7,
    longWindowDays = 28
  } = {}) {
    const safeEntries = normalizeArray(entries)
      .filter(entry => entryDateValue(entry) !== null);
    if (!safeEntries.length) {
      return Object.freeze({
        anchorDate: null,
        shortWindowDays,
        longWindowDays,
        metrics: Object.freeze([]),
        clinical_claim: false,
        causal_claim: false,
        source: "DETERMINISTIC_TREND"
      });
    }

    const latestEntry = [...safeEntries].sort((left, right) =>
      entryDateValue(right) - entryDateValue(left)
    )[0];
    const anchorDate = parseIsoDate(latestEntry.entry_date ?? latestEntry.entryDate);
    const shortDays = Math.max(1, Number(shortWindowDays) || 7);
    const longDays = Math.max(shortDays, Number(longWindowDays) || 28);
    const currentStart = startOfWindow(anchorDate, shortDays - 1);
    const previousEnd = startOfWindow(currentStart, 1);
    const previousStart = startOfWindow(previousEnd, shortDays - 1);
    const longStart = startOfWindow(anchorDate, longDays - 1);

    const catalog = normalizeArray(metrics);
    const codes = new Set([
      ...catalog.map(metric => normalizeCode(metric.code)),
      ...safeEntries.flatMap(entry => normalizeArray(entry.observations)
        .map(observation => normalizeCode(observation?.metric_code ?? observation?.metricCode)))
    ]);

    const summaries = [...codes]
      .filter(Boolean)
      .map(code => {
        const metric = catalog.find(item => normalizeCode(item.code) === code) || {};
        const series = seriesForMetric(safeEntries, code);
        if (!series.length) return null;

        const latest = series[series.length - 1];
        const valueType = String(metric.value_type || latest.value_type || "").toUpperCase();
        const currentValues = windowValues(series, currentStart, anchorDate);
        const previousValues = windowValues(series, previousStart, previousEnd);
        const longValues = windowValues(series, longStart, anchorDate);
        const isBoolean = valueType === "BOOLEAN";

        const current = isBoolean ? ratio(currentValues) : mean(currentValues);
        const previous = isBoolean ? ratio(previousValues) : mean(previousValues);
        const long = isBoolean ? ratio(longValues) : mean(longValues);
        const threshold = isBoolean ? 0.05 : metricThreshold(metric);
        const trendDirection = direction(current, previous, threshold);

        return Object.freeze({
          metric_code: code,
          name: metric.name || code.replaceAll("_", " "),
          value_type: valueType || null,
          unit: metric.unit || latest.unit || null,
          latest_value: latest.value,
          latest_date: latest.date,
          short_value: round(current),
          previous_short_value: round(previous),
          long_value: round(long),
          short_samples: currentValues.length,
          previous_short_samples: previousValues.length,
          long_samples: longValues.length,
          direction: trendDirection,
          delta_vs_previous: Number.isFinite(Number(current)) && Number.isFinite(Number(previous))
            ? round(Number(current) - Number(previous))
            : null,
          clinical_claim: false,
          causal_claim: false,
          source: "DETERMINISTIC_TREND"
        });
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftMetric = catalog.find(item => normalizeCode(item.code) === left.metric_code);
        const rightMetric = catalog.find(item => normalizeCode(item.code) === right.metric_code);
        const sortDelta = Number(leftMetric?.sort_order ?? 999) - Number(rightMetric?.sort_order ?? 999);
        return sortDelta || left.metric_code.localeCompare(right.metric_code);
      });

    return Object.freeze({
      anchorDate: String(latestEntry.entry_date ?? latestEntry.entryDate).slice(0, 10),
      shortWindowDays: shortDays,
      longWindowDays: longDays,
      metrics: Object.freeze(summaries),
      clinical_claim: false,
      causal_claim: false,
      source: "DETERMINISTIC_TREND"
    });
  }
}

export default WellnessTrendEngine;
