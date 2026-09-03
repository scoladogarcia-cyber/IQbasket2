/**
 * Deterministic configuration for Player 360 longitudinal analytics.
 *
 * These thresholds describe evidence sufficiency, not player performance.
 * They are centralized so future licenses or organizations can override them
 * without changing the calculation code.
 */
export const PLAYER360_LONGITUDINAL_CONFIG = Object.freeze({
  contractVersion: "PLAYER360_LONGITUDINAL_V1",
  calculationVersion: "PLAYER360_LONGITUDINAL_2026.09_V1",
  bucketUnit: "WEEK",
  weekStartsOn: 1,
  minimumTrendBuckets: 3,
  minimumAssociationPairs: 5,
  defaultAggregation: "AVERAGE",
  supportedAggregations: Object.freeze([
    "AVERAGE",
    "SUM",
    "MIN",
    "MAX",
    "LAST"
  ]),
  defaultStableTolerance: 0.000001
});

export default PLAYER360_LONGITUDINAL_CONFIG;
