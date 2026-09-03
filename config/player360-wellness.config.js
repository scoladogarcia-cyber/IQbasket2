/**
 * Player 360 Nutrition + Recovery metric defaults.
 *
 * These defaults seed/render a configurable catalog. They are NOT database
 * columns and must never be used as the only source of truth once the remote
 * catalog is installed.
 */

export const WELLNESS_VALUE_TYPE = Object.freeze({
  NUMBER: "NUMBER",
  SCALE: "SCALE",
  BOOLEAN: "BOOLEAN",
  CHOICE: "CHOICE"
});

function metric(definition) {
  return Object.freeze({
    sensitivity: "WELLNESS_RESTRICTED",
    enabled: true,
    ...definition
  });
}

export const PLAYER360_WELLNESS_DEFAULT_METRICS = Object.freeze([
  metric({
    module: "recovery",
    code: "SLEEP_DURATION_HOURS",
    name: "Duración del sueño",
    description: "Horas de sueño percibidas/registradas en el último descanso.",
    value_type: WELLNESS_VALUE_TYPE.NUMBER,
    unit: "HOURS",
    min_value: 0,
    max_value: 16,
    step: 0.25,
    sort_order: 10
  }),
  metric({
    module: "recovery",
    code: "SLEEP_QUALITY",
    name: "Calidad del sueño",
    description: "Valoración subjetiva del descanso.",
    value_type: WELLNESS_VALUE_TYPE.SCALE,
    unit: "SCALE_1_5",
    min_value: 1,
    max_value: 5,
    step: 1,
    sort_order: 20
  }),
  metric({
    module: "recovery",
    code: "FATIGUE",
    name: "Fatiga percibida",
    description: "Sensación general de fatiga antes de la actividad.",
    value_type: WELLNESS_VALUE_TYPE.SCALE,
    unit: "SCALE_1_5",
    min_value: 1,
    max_value: 5,
    step: 1,
    sort_order: 30
  }),
  metric({
    module: "recovery",
    code: "MUSCLE_SORENESS",
    name: "Molestia muscular percibida",
    description: "Nivel global de carga/molestia muscular percibida, no diagnóstico.",
    value_type: WELLNESS_VALUE_TYPE.SCALE,
    unit: "SCALE_1_5",
    min_value: 1,
    max_value: 5,
    step: 1,
    sort_order: 40
  }),
  metric({
    module: "recovery",
    code: "READINESS",
    name: "Preparación percibida",
    description: "Sensación general de estar preparado/a para entrenar o competir.",
    value_type: WELLNESS_VALUE_TYPE.SCALE,
    unit: "SCALE_1_5",
    min_value: 1,
    max_value: 5,
    step: 1,
    sort_order: 50
  }),
  metric({
    module: "nutrition",
    code: "HYDRATION_ADHERENCE",
    name: "Hidratación percibida",
    description: "Valoración de cumplimiento de la pauta personal de hidratación.",
    value_type: WELLNESS_VALUE_TYPE.SCALE,
    unit: "SCALE_1_5",
    min_value: 1,
    max_value: 5,
    step: 1,
    sort_order: 10
  }),
  metric({
    module: "nutrition",
    code: "MEAL_REGULARITY",
    name: "Regularidad de ingestas",
    description: "Valoración de regularidad respecto a la pauta personal.",
    value_type: WELLNESS_VALUE_TYPE.SCALE,
    unit: "SCALE_1_5",
    min_value: 1,
    max_value: 5,
    step: 1,
    sort_order: 20
  }),
  metric({
    module: "nutrition",
    code: "PRE_TRAINING_FUELING",
    name: "Ingesta previa planificada",
    description: "Se siguió la pauta personal prevista antes de entrenar/competir.",
    value_type: WELLNESS_VALUE_TYPE.BOOLEAN,
    unit: "BOOLEAN",
    sort_order: 30
  }),
  metric({
    module: "nutrition",
    code: "POST_TRAINING_RECOVERY",
    name: "Recuperación posterior planificada",
    description: "Se siguió la pauta personal prevista tras entrenar/competir.",
    value_type: WELLNESS_VALUE_TYPE.BOOLEAN,
    unit: "BOOLEAN",
    sort_order: 40
  })
]);

export const PLAYER360_WELLNESS_PROHIBITED_DEFAULT_CODES = Object.freeze([
  "WEIGHT_KG",
  "BMI",
  "BODY_FAT_PCT",
  "CALORIE_INTAKE",
  "ENERGY_DEFICIT",
  "MENSTRUATION",
  "MEDICATION",
  "DIAGNOSIS",
  "CLINICAL_SYMPTOMS"
]);

export const WELLNESS_RECOMMENDATION_PRIORITY = Object.freeze({
  INFO: "INFO",
  SUPPORT: "SUPPORT",
  REVIEW: "REVIEW"
});

export const WELLNESS_RECOMMENDATION_RULES = Object.freeze([
  Object.freeze({
    module: "recovery",
    metric_code: "SLEEP_QUALITY",
    trigger: "LTE",
    threshold: 2,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT,
    code: "SUPPORT_SLEEP_ROUTINE",
    title: "Protege tu rutina de descanso",
    message: "Hoy prioriza una rutina de descanso estable y reduce cambios innecesarios antes de la siguiente sesión."
  }),
  Object.freeze({
    module: "recovery",
    metric_code: "FATIGUE",
    trigger: "GTE",
    threshold: 4,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.REVIEW,
    code: "REVIEW_FATIGUE_LOAD",
    title: "Revisa la carga del día",
    message: "La fatiga percibida es alta. Conviene revisar con el staff la intensidad prevista y priorizar calidad de ejecución."
  }),
  Object.freeze({
    module: "recovery",
    metric_code: "MUSCLE_SORENESS",
    trigger: "GTE",
    threshold: 4,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.REVIEW,
    code: "REVIEW_MUSCLE_LOAD",
    title: "Ajusta la exigencia si es necesario",
    message: "La molestia muscular percibida es alta. Revisa sensaciones con el staff antes de aumentar la carga."
  }),
  Object.freeze({
    module: "recovery",
    metric_code: "READINESS",
    trigger: "LTE",
    threshold: 2,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.REVIEW,
    code: "REVIEW_READINESS",
    title: "Prioriza calidad sobre cantidad",
    message: "La preparación percibida es baja. Antes de la sesión, revisa objetivos y carga para mantener una ejecución de calidad."
  }),
  Object.freeze({
    module: "nutrition",
    metric_code: "HYDRATION_ADHERENCE",
    trigger: "LTE",
    threshold: 2,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT,
    code: "SUPPORT_HYDRATION_PLAN",
    title: "Recupera tu pauta de hidratación",
    message: "Vuelve a la pauta de hidratación que ya tengas definida y distribúyela de forma regular durante el día."
  }),
  Object.freeze({
    module: "nutrition",
    metric_code: "MEAL_REGULARITY",
    trigger: "LTE",
    threshold: 2,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT,
    code: "SUPPORT_MEAL_REGULARITY",
    title: "Gana regularidad",
    message: "Intenta recuperar una pauta regular de ingestas acorde con tu planificación habitual."
  }),
  Object.freeze({
    module: "nutrition",
    metric_code: "PRE_TRAINING_FUELING",
    trigger: "EQ",
    threshold: false,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT,
    code: "SUPPORT_PRE_ACTIVITY_ROUTINE",
    title: "Prepara mejor la próxima sesión",
    message: "Para la próxima sesión, planifica con antelación tu pauta habitual previa a la actividad."
  }),
  Object.freeze({
    module: "nutrition",
    metric_code: "POST_TRAINING_RECOVERY",
    trigger: "EQ",
    threshold: false,
    priority: WELLNESS_RECOMMENDATION_PRIORITY.SUPPORT,
    code: "SUPPORT_POST_ACTIVITY_ROUTINE",
    title: "Cierra mejor la sesión",
    message: "Recupera tu pauta habitual posterior a la actividad para reforzar la consistencia de recuperación."
  })
]);

export const PLAYER360_WELLNESS_CONFIG = Object.freeze({
  contractVersion: "PLAYER360_WELLNESS_V1",
  supportedModules: Object.freeze(["nutrition", "recovery"]),
  supportedValueTypes: Object.freeze(Object.values(WELLNESS_VALUE_TYPE)),
  allowFreeTextValue: false,
  manualInputEnabled: true,
  externalImportEnabled: false,
  recommendationsEnabled: true,
  aiProcessingEnabled: false,
  defaultMetrics: PLAYER360_WELLNESS_DEFAULT_METRICS,
  recommendationRules: WELLNESS_RECOMMENDATION_RULES
});

export default PLAYER360_WELLNESS_CONFIG;
