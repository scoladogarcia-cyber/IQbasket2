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


/**
 * Source-to-observation mappings used by the real-data analytics adapter.
 * Keeping them here avoids field/metric knowledge inside the UI.
 */
export const PLAYER360_LONGITUDINAL_SOURCE_METRICS = Object.freeze({
  competition: Object.freeze([
    Object.freeze({ metric_code: "POINTS", source_field: "points", unit: "PTS", aggregation: "AVERAGE", label: "Puntos" }),
    Object.freeze({ metric_code: "EVALUATION", source_field: "evaluation", unit: "INDEX", aggregation: "AVERAGE", label: "Valoración" }),
    Object.freeze({ metric_code: "MINUTES", source_field: "minutes", unit: "MIN", aggregation: "AVERAGE", label: "Minutos" }),
    Object.freeze({ metric_code: "REBOUNDS", source_field: "rebounds", unit: "COUNT", aggregation: "AVERAGE", label: "Rebotes" }),
    Object.freeze({ metric_code: "ASSISTS", source_field: "assists", unit: "COUNT", aggregation: "AVERAGE", label: "Asistencias" }),
    Object.freeze({ metric_code: "PLUS_MINUS", source_field: "plus_minus", unit: "POINT_DIFF", aggregation: "AVERAGE", label: "+/-" })
  ]),
  training: Object.freeze([
    Object.freeze({ metric_code: "SESSION_LOAD", source_field: "internal_load", unit: "AU", aggregation: "SUM", label: "Carga de entrenamiento" }),
    Object.freeze({ metric_code: "PARTICIPATED_MINUTES", source_field: "participated_minutes", unit: "MIN", aggregation: "SUM", label: "Minutos de entrenamiento" }),
    Object.freeze({ metric_code: "RPE", source_field: "rpe", unit: "RPE_0_10", aggregation: "AVERAGE", label: "RPE de entrenamiento" })
  ]),
  external_development: Object.freeze([
    Object.freeze({ metric_code: "EXTERNAL_LOAD", source_field: "internal_load", unit: "AU", aggregation: "SUM", label: "Carga de tecnificación" }),
    Object.freeze({ metric_code: "EXTERNAL_MINUTES", source_field: "duration_minutes", unit: "MIN", aggregation: "SUM", label: "Minutos de tecnificación" }),
    Object.freeze({ metric_code: "EXTERNAL_RPE", source_field: "rpe", unit: "RPE_0_10", aggregation: "AVERAGE", label: "RPE de tecnificación" })
  ])
});

export const PLAYER360_LONGITUDINAL_ASSOCIATIONS = Object.freeze([
  Object.freeze({
    left: "training.SESSION_LOAD",
    right: "competition.EVALUATION",
    lag_buckets: 1,
    label: "Carga de entrenamiento → valoración competitiva"
  }),
  Object.freeze({
    left: "training.SESSION_LOAD",
    right: "competition.POINTS",
    lag_buckets: 1,
    label: "Carga de entrenamiento → puntos"
  })
]);

export const PLAYER360_AI_UI_CONFIG = Object.freeze({
  /**
   * External model calls are intentionally disabled until a server-side
   * provider adapter/Edge Function is deployed. Never put provider secrets in
   * the browser bundle.
   */
  generationEnabled: false,
  edgeFunctionName: "player360-ai-insight",
  promptVersion: "PLAYER360_STAFF_ES_V1"
});

export default PLAYER360_LONGITUDINAL_CONFIG;
