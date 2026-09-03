/**
 * Central configuration for IQBasket Player 360 / Development Intelligence.
 *
 * This file contains product-level module metadata and deterministic thresholds.
 * Runtime permissions remain in security/permissions.js and backend/RLS remains
 * authoritative for access control.
 */

export const PLAYER360_MODULE = Object.freeze({
  COMPETITION: "competition",
  TRAINING: "training",
  EXTERNAL_DEVELOPMENT: "external_development",
  EVALUATION: "evaluation",
  OBJECTIVE_PROFILE: "objective_profile",
  DATA_COVERAGE: "data_coverage",
  ANALYTICS: "analytics",
  AI_INSIGHTS: "ai_insights",
  RECOVERY: "recovery",
  NUTRITION: "nutrition",
  NEURO_COGNITIVE: "neuro_cognitive"
});

export const PLAYER360_SOURCE_TYPE = Object.freeze({
  GAME_SYSTEM: "GAME_SYSTEM",
  CLUB_COACH: "CLUB_COACH",
  PLAYER_SELF_REPORT: "PLAYER_SELF_REPORT",
  FAMILY_REPORT: "FAMILY_REPORT",
  EXTERNAL_COACH: "EXTERNAL_COACH",
  NEUROMAP: "NEUROMAP",
  WEARABLE: "WEARABLE",
  HEALTH_APP: "HEALTH_APP",
  SENSOR: "SENSOR",
  IMPORT: "IMPORT",
  OTHER: "OTHER"
});

export const PLAYER360_SENSITIVITY = Object.freeze({
  STANDARD: "STANDARD",
  PRIVATE_SPORTING: "PRIVATE_SPORTING",
  WELLNESS_RESTRICTED: "WELLNESS_RESTRICTED"
});

export const PLAYER360_EVALUATION_DOMAIN = Object.freeze({
  TECHNICAL: "TECHNICAL",
  TACTICAL: "TACTICAL",
  PHYSICAL: "PHYSICAL"
});

export const PLAYER360_EVALUATION_DOMAIN_LABELS = Object.freeze({
  [PLAYER360_EVALUATION_DOMAIN.TECHNICAL]: "Técnica",
  [PLAYER360_EVALUATION_DOMAIN.TACTICAL]: "Táctica",
  [PLAYER360_EVALUATION_DOMAIN.PHYSICAL]: "Físico"
});

export const TRAINING_ATTENDANCE_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  PRESENT: "PRESENT",
  PARTIAL: "PARTIAL",
  ABSENT: "ABSENT",
  EXCUSED: "EXCUSED"
});

export const TRAINING_ATTENDANCE_LABELS = Object.freeze({
  [TRAINING_ATTENDANCE_STATUS.PLANNED]: "Planificado",
  [TRAINING_ATTENDANCE_STATUS.PRESENT]: "Presente",
  [TRAINING_ATTENDANCE_STATUS.PARTIAL]: "Parcial",
  [TRAINING_ATTENDANCE_STATUS.ABSENT]: "Ausente",
  [TRAINING_ATTENDANCE_STATUS.EXCUSED]: "Justificado"
});

export const EXTERNAL_PROVIDER_TYPE = Object.freeze({
  EXTERNAL_COACH: "EXTERNAL_COACH",
  ACADEMY: "ACADEMY",
  PHYSICAL_COACH: "PHYSICAL_COACH",
  SELF: "SELF",
  OTHER: "OTHER"
});

export const EXTERNAL_PROVIDER_LABELS = Object.freeze({
  [EXTERNAL_PROVIDER_TYPE.EXTERNAL_COACH]: "Tecnificador / entrenador externo",
  [EXTERNAL_PROVIDER_TYPE.ACADEMY]: "Academia",
  [EXTERNAL_PROVIDER_TYPE.PHYSICAL_COACH]: "Preparador físico externo",
  [EXTERNAL_PROVIDER_TYPE.SELF]: "Trabajo autónomo",
  [EXTERNAL_PROVIDER_TYPE.OTHER]: "Otro"
});

export const PLAYER360_CONFIG = Object.freeze({
  contractVersion: "PLAYER360_OBSERVATION_V1",
  insightEvidenceVersion: "PLAYER360_EVIDENCE_V1",

  modules: Object.freeze({
    [PLAYER360_MODULE.COMPETITION]: Object.freeze({
      stage: "ACTIVE",
      defaultEnabled: true,
      sensitivity: PLAYER360_SENSITIVITY.STANDARD
    }),
    [PLAYER360_MODULE.TRAINING]: Object.freeze({
      stage: "PHASE_4B",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.STANDARD
    }),
    [PLAYER360_MODULE.EXTERNAL_DEVELOPMENT]: Object.freeze({
      stage: "PHASE_4B",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.PRIVATE_SPORTING
    }),
    [PLAYER360_MODULE.EVALUATION]: Object.freeze({
      stage: "PHASE_4C",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.PRIVATE_SPORTING
    }),
    [PLAYER360_MODULE.OBJECTIVE_PROFILE]: Object.freeze({
      stage: "PHASE_4C",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.STANDARD
    }),
    [PLAYER360_MODULE.DATA_COVERAGE]: Object.freeze({
      stage: "PHASE_4A",
      defaultEnabled: true,
      sensitivity: PLAYER360_SENSITIVITY.STANDARD
    }),
    [PLAYER360_MODULE.ANALYTICS]: Object.freeze({
      stage: "PHASE_4D",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.STANDARD
    }),
    [PLAYER360_MODULE.AI_INSIGHTS]: Object.freeze({
      stage: "PHASE_4D",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.PRIVATE_SPORTING
    }),
    [PLAYER360_MODULE.RECOVERY]: Object.freeze({
      stage: "PHASE_4E",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.WELLNESS_RESTRICTED
    }),
    [PLAYER360_MODULE.NUTRITION]: Object.freeze({
      stage: "PHASE_4E",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.WELLNESS_RESTRICTED
    }),
    [PLAYER360_MODULE.NEURO_COGNITIVE]: Object.freeze({
      stage: "PHASE_4F",
      defaultEnabled: false,
      sensitivity: PLAYER360_SENSITIVITY.WELLNESS_RESTRICTED
    })
  }),

  coverage: Object.freeze({
    thresholds: Object.freeze({
      NONE_MAX: 0,
      LOW_MAX: 39,
      PARTIAL_MAX: 69,
      GOOD_MAX: 89
    }),
    qualityDefault: 1
  })
});

export default PLAYER360_CONFIG;
