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

export const PLAYER360_WELLNESS_CONFIG = Object.freeze({
  contractVersion: "PLAYER360_WELLNESS_V1",
  supportedModules: Object.freeze(["nutrition", "recovery"]),
  supportedValueTypes: Object.freeze(Object.values(WELLNESS_VALUE_TYPE)),
  allowFreeTextValue: false,
  aiProcessingEnabled: false,
  defaultMetrics: PLAYER360_WELLNESS_DEFAULT_METRICS
});

export default PLAYER360_WELLNESS_CONFIG;
