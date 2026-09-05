/**
 * @fileoverview Family-facing AI product contract.
 * @description Defines sellable outcomes without coupling product language to a
 * provider, model, token budget or billing vendor.
 */
export const FAMILY_AI_PRODUCT_STATUS = Object.freeze({
  DISABLED: "DISABLED",
  PILOT: "PILOT",
  AVAILABLE: "AVAILABLE"
});

export const FAMILY_AI_PRODUCTS = Object.freeze({
  EVOLUTION_REPORT: Object.freeze({
    code: "EVOLUTION_REPORT",
    label: "Informe de evolución",
    entitlement: "AI_INSIGHTS",
    status: FAMILY_AI_PRODUCT_STATUS.DISABLED,
    description: "Resume cambios observados, prioridades y límites de la evidencia."
  }),
  PRIORITIES: Object.freeze({
    code: "PRIORITIES",
    label: "Prioridades de mejora",
    entitlement: "AI_INSIGHTS",
    status: FAMILY_AI_PRODUCT_STATUS.DISABLED,
    description: "Convierte la evidencia disponible en focos claros para conversar con el staff."
  })
});

export const FAMILY_AI_PRODUCTS_EXTENDED = Object.freeze({
  ...FAMILY_AI_PRODUCTS,
  POSTGAME_SUMMARY: Object.freeze({
    code: "POSTGAME_SUMMARY",
    label: "Resumen inteligente postpartido",
    entitlement: "AI_INSIGHTS",
    status: FAMILY_AI_PRODUCT_STATUS.DISABLED,
    description: "Explica el último partido dentro del contexto longitudinal, sin juzgar una actuación aislada."
  }),
  WEEKLY_PLAN: Object.freeze({
    code: "WEEKLY_PLAN",
    label: "Plan inteligente de la semana",
    entitlement: "AI_WEEKLY_PLAN",
    status: FAMILY_AI_PRODUCT_STATUS.DISABLED,
    description: "Propone acciones sobre objetivos ya definidos y actividad reciente, con revisión del staff."
  })
});

export const FAMILY_AI_POLICY = Object.freeze({
  commerciallyAvailable: false,
  providerGenerationEnabled: false,
  allowedEvidenceModules: Object.freeze(["competition", "training", "external_development", "evaluation"]),
  restrictedEvidenceModules: Object.freeze(["nutrition", "recovery", "neuro_cognitive"]),
  disclaimer: "La IA no sustituye al entrenador ni a profesionales sanitarios y no debe atribuir causas no observadas."
});

export default FAMILY_AI_PRODUCTS_EXTENDED;
