/**
 * Pure, provider-agnostic longitudinal calculator for Player 360.
 *
 * It converts normalized observations into weekly series, trends and explicit
 * lagged associations. Associations are descriptive and never causal claims.
 */

import { PLAYER360_LONGITUDINAL_CONFIG } from "../../config/player360-analytics.config.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function requiredText(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`LongitudinalAnalyticsCalculator: ${label} es obligatorio.`);
  return normalized;
}

function finiteNumber(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function utcDate(value, label) {
  const text = requiredText(value, label);
  const timestamp = Date.parse(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(timestamp)) {
    throw new Error(`LongitudinalAnalyticsCalculator: ${label} debe ser una fecha ISO válida.`);
  }
  return new Date(timestamp);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  const daysFromMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysFromMonday);
  return result;
}

function addWeeks(isoDate, weeks) {
  const date = utcDate(isoDate, "bucket_start");
  date.setTime(date.getTime() + (Number(weeks) || 0) * WEEK_MS);
  return isoDay(date);
}

function normalizeEligibilityPeriods(periods, analysisStart, analysisEnd) {
  return (Array.isArray(periods) ? periods : [])
    .map(period => {
      const fromRaw = period?.from || period?.valid_from || period?.start_date || null;
      const toRaw = period?.to || period?.valid_until || period?.end_date || null;
      if (!fromRaw) return null;

      const from = utcDate(fromRaw, "eligibility.from");
      const to = toRaw ? utcDate(toRaw, "eligibility.to") : new Date(analysisEnd);
      to.setUTCHours(23, 59, 59, 999);

      const clippedFrom = new Date(Math.max(from.getTime(), analysisStart.getTime()));
      const clippedTo = new Date(Math.min(to.getTime(), analysisEnd.getTime()));
      if (clippedTo < clippedFrom) return null;

      return {
        from: isoDay(clippedFrom),
        to: isoDay(clippedTo),
        from_timestamp: clippedFrom.getTime(),
        to_timestamp: clippedTo.getTime()
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.from_timestamp - right.from_timestamp);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function metricKey(moduleCode, metricCode) {
  return `${String(moduleCode || "").toLowerCase()}.${String(metricCode || "").toUpperCase()}`;
}

function normalizeMetricDefinition(definition, config) {
  const moduleCode = requiredText(definition?.module, "metricDefinitions.module").toLowerCase();
  const metricCode = requiredText(definition?.metric_code, "metricDefinitions.metric_code").toUpperCase();
  const aggregation = String(
    definition?.aggregation || config.defaultAggregation
  ).toUpperCase();

  if (!config.supportedAggregations.includes(aggregation)) {
    throw new Error(`LongitudinalAnalyticsCalculator: agregación no soportada (${aggregation}).`);
  }

  const tolerance = finiteNumber(definition?.stable_tolerance);
  return {
    key: metricKey(moduleCode, metricCode),
    module: moduleCode,
    metric_code: metricCode,
    unit: definition?.unit ? String(definition.unit) : null,
    aggregation,
    stable_tolerance: tolerance === null
      ? config.defaultStableTolerance
      : Math.max(0, tolerance)
  };
}

function aggregateBucket(items, aggregation) {
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map(item => item.value);

  if (aggregation === "SUM") return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === "MIN") return Math.min(...values);
  if (aggregation === "MAX") return Math.max(...values);
  if (aggregation === "LAST") return sorted.at(-1)?.value ?? null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendFor(points, definition, minimumBuckets) {
  if (points.length < minimumBuckets) {
    return {
      status: "INSUFFICIENT_DATA",
      sample_size: points.length,
      minimum_sample_size: minimumBuckets,
      slope_per_week: null,
      direction: null,
      first_value: points[0]?.value ?? null,
      last_value: points.at(-1)?.value ?? null,
      absolute_change: null,
      relative_change_pct: null
    };
  }

  const n = points.length;
  const firstBucketTimestamp = utcDate(points[0].bucket_start, "bucket_start").getTime();
  const xValues = points.map(point => (
    utcDate(point.bucket_start, "bucket_start").getTime() - firstBucketTimestamp
  ) / WEEK_MS);
  const meanX = xValues.reduce((sum, value) => sum + value, 0) / n;
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / n;
  let numerator = 0;
  let denominator = 0;

  points.forEach((point, index) => {
    numerator += (xValues[index] - meanX) * (point.value - meanY);
    denominator += (xValues[index] - meanX) ** 2;
  });

  const slope = denominator ? numerator / denominator : 0;
  const first = points[0].value;
  const last = points.at(-1).value;
  const change = last - first;
  const tolerance = definition.stable_tolerance;

  return {
    status: "READY",
    sample_size: n,
    minimum_sample_size: minimumBuckets,
    slope_per_week: round(slope),
    direction: Math.abs(slope) <= tolerance ? "STABLE" : slope > 0 ? "UP" : "DOWN",
    first_value: first,
    last_value: last,
    absolute_change: round(change),
    relative_change_pct: first === 0 ? null : round((change / Math.abs(first)) * 100, 2)
  };
}

function pearson(pairs) {
  const n = pairs.length;
  const meanX = pairs.reduce((sum, pair) => sum + pair.left, 0) / n;
  const meanY = pairs.reduce((sum, pair) => sum + pair.right, 0) / n;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  pairs.forEach(pair => {
    const dx = pair.left - meanX;
    const dy = pair.right - meanY;
    covariance += dx * dy;
    varianceX += dx ** 2;
    varianceY += dy ** 2;
  });

  if (varianceX === 0 || varianceY === 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
}

function associationStrength(coefficient) {
  const magnitude = Math.abs(coefficient);
  if (magnitude < 0.3) return "WEAK";
  if (magnitude < 0.5) return "MODERATE";
  return "STRONG";
}

export class LongitudinalAnalyticsCalculator {
  static calculate({
    playerId,
    teamSeasonId,
    period,
    observations = [],
    metricDefinitions = [],
    associationDefinitions = [],
    eligibilityPeriods = [],
    config = PLAYER360_LONGITUDINAL_CONFIG
  } = {}) {
    const normalizedPlayerId = requiredText(playerId, "playerId");
    const normalizedTeamSeasonId = requiredText(teamSeasonId, "teamSeasonId");
    const periodStart = utcDate(period?.from, "period.from");
    const periodEnd = utcDate(period?.to, "period.to");
    periodEnd.setUTCHours(23, 59, 59, 999);
    if (periodEnd < periodStart) {
      throw new Error("LongitudinalAnalyticsCalculator: period.to no puede ser anterior a period.from.");
    }

    const eligiblePeriods = normalizeEligibilityPeriods(
      eligibilityPeriods,
      periodStart,
      periodEnd
    );
    const eligibilityRestricted = Array.isArray(eligibilityPeriods)
      && eligibilityPeriods.length > 0;

    const definitions = metricDefinitions.map(definition =>
      normalizeMetricDefinition(definition, config)
    );
    const definitionByKey = new Map(definitions.map(definition => [definition.key, definition]));
    const bucketsByMetric = new Map(definitions.map(definition => [definition.key, new Map()]));
    let rejectedObservations = 0;

    (Array.isArray(observations) ? observations : []).forEach(observation => {
      if (String(observation?.player_id || "") !== normalizedPlayerId) return;
      if (String(observation?.team_season_id || "") !== normalizedTeamSeasonId) return;

      const definition = definitionByKey.get(
        metricKey(observation?.module, observation?.metric_code)
      );
      if (!definition) return;

      const value = finiteNumber(observation?.value);
      const timestamp = Date.parse(observation?.occurred_at || "");
      if (value === null || Number.isNaN(timestamp)) {
        rejectedObservations += 1;
        return;
      }
      if (timestamp < periodStart.getTime() || timestamp > periodEnd.getTime()) return;
      if (
        eligibilityRestricted
        && !eligiblePeriods.some(period =>
          timestamp >= period.from_timestamp && timestamp <= period.to_timestamp
        )
      ) return;

      const bucketStart = isoDay(startOfUtcWeek(new Date(timestamp)));
      const metricBuckets = bucketsByMetric.get(definition.key);
      if (!metricBuckets.has(bucketStart)) metricBuckets.set(bucketStart, []);
      metricBuckets.get(bucketStart).push({ value, timestamp });
    });

    const expectedBucketStarts = new Set();
    const expectedRanges = eligibilityRestricted
      ? eligiblePeriods
      : [{
          from: isoDay(periodStart),
          to: isoDay(periodEnd),
          from_timestamp: periodStart.getTime(),
          to_timestamp: periodEnd.getTime()
        }];

    expectedRanges.forEach(range => {
      let cursor = startOfUtcWeek(new Date(range.from_timestamp));
      const last = startOfUtcWeek(new Date(range.to_timestamp));
      while (cursor.getTime() <= last.getTime()) {
        expectedBucketStarts.add(isoDay(cursor));
        cursor = new Date(cursor.getTime() + WEEK_MS);
      }
    });
    const expectedBuckets = expectedBucketStarts.size;

    const series = definitions.map(definition => {
      const bucketEntries = [...bucketsByMetric.get(definition.key).entries()]
        .sort(([left], [right]) => left.localeCompare(right));
      const points = bucketEntries.map(([bucketStart, items]) => ({
        bucket_start: bucketStart,
        bucket_end: addWeeks(bucketStart, 1),
        value: round(aggregateBucket(items, definition.aggregation)),
        observation_count: items.length
      }));

      return {
        ...definition,
        points,
        coverage: {
          expected_buckets: expectedBuckets,
          observed_buckets: points.length,
          coverage_pct: expectedBuckets
            ? round((points.length / expectedBuckets) * 100, 2)
            : 0
        },
        trend: trendFor(points, definition, config.minimumTrendBuckets)
      };
    });

    const seriesByKey = new Map(series.map(item => [item.key, item]));
    const associations = associationDefinitions.map(definition => {
      const leftKey = requiredText(definition?.left, "associationDefinitions.left");
      const rightKey = requiredText(definition?.right, "associationDefinitions.right");
      const lagBuckets = Math.max(0, Math.trunc(Number(definition?.lag_buckets) || 0));
      const leftSeries = seriesByKey.get(leftKey);
      const rightSeries = seriesByKey.get(rightKey);

      if (!leftSeries || !rightSeries) {
        throw new Error("LongitudinalAnalyticsCalculator: asociación referencia una serie inexistente.");
      }

      const rightByBucket = new Map(
        rightSeries.points.map(point => [point.bucket_start, point.value])
      );
      const pairs = leftSeries.points
        .map(point => ({
          bucket_start: point.bucket_start,
          outcome_bucket_start: addWeeks(point.bucket_start, lagBuckets),
          left: point.value,
          right: rightByBucket.get(addWeeks(point.bucket_start, lagBuckets))
        }))
        .filter(pair => Number.isFinite(pair.right));

      if (pairs.length < config.minimumAssociationPairs) {
        return {
          left: leftKey,
          right: rightKey,
          lag_buckets: lagBuckets,
          status: "INSUFFICIENT_DATA",
          sample_size: pairs.length,
          minimum_sample_size: config.minimumAssociationPairs,
          coefficient: null,
          direction: null,
          strength: null,
          pairs
        };
      }

      const coefficient = pearson(pairs);
      if (coefficient === null) {
        return {
          left: leftKey,
          right: rightKey,
          lag_buckets: lagBuckets,
          status: "NO_VARIANCE",
          sample_size: pairs.length,
          minimum_sample_size: config.minimumAssociationPairs,
          coefficient: null,
          direction: null,
          strength: null,
          pairs
        };
      }

      return {
        left: leftKey,
        right: rightKey,
        lag_buckets: lagBuckets,
        status: "READY",
        sample_size: pairs.length,
        minimum_sample_size: config.minimumAssociationPairs,
        coefficient: round(coefficient, 4),
        direction: coefficient > 0 ? "POSITIVE" : coefficient < 0 ? "NEGATIVE" : "NONE",
        strength: associationStrength(coefficient),
        pairs
      };
    });

    return deepFreeze({
      contract_version: config.contractVersion,
      calculation_version: config.calculationVersion,
      player_id: normalizedPlayerId,
      team_season_id: normalizedTeamSeasonId,
      period: {
        from: isoDay(periodStart),
        to: isoDay(periodEnd)
      },
      bucket_unit: config.bucketUnit,
      eligibility_periods: eligiblePeriods.map(period => ({
        from: period.from,
        to: period.to
      })),
      expected_buckets: expectedBuckets,
      rejected_observations: rejectedObservations,
      series,
      associations,
      limitations: [
        "Las asociaciones son descriptivas y no demuestran causalidad.",
        "Los resultados dependen de la cobertura, calidad y regularidad de los datos de origen."
      ]
    });
  }
}

export default LongitudinalAnalyticsCalculator;
