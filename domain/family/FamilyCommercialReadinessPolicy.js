/**
 * @fileoverview Pure commercial-readiness policy for IQBasket Family.
 * @description Adds a fail-closed deployment guard around monetization and
 * family AI. It does not grant data access and must never replace RBAC/ABAC,
 * privacy authorization, entitlements, billing verification or server-side AI gates.
 */
import { FAMILY_COMMERCIAL_READINESS } from "../../config/family-commercial-readiness.config.js";
import { FAMILY_GROWTH_CONFIG } from "../../config/family-growth.config.js";
import { FAMILY_AI_POLICY } from "../../config/family-ai-products.config.js";

const BASE_REQUIREMENTS = Object.freeze([
  Object.freeze({ key: "privacyTermsApproved", code: "PRIVACY_TERMS", label: "Textos de privacidad y términos aprobados" }),
  Object.freeze({ key: "consentRulesApproved", code: "CONSENT_RULES", label: "Reglas de edad/consentimiento validadas para el mercado objetivo" }),
  Object.freeze({ key: "specialCategoryReviewApproved", code: "SPECIAL_CATEGORY_REVIEW", label: "Base jurídica y categorías especiales revisadas por módulo" }),
  Object.freeze({ key: "rightsRetentionProcessApproved", code: "RIGHTS_RETENTION", label: "Proceso de conservación, supresión, exportación y derechos aprobado" }),
  Object.freeze({ key: "processorContractsApproved", code: "PROCESSOR_CONTRACTS", label: "Encargados/subencargados y localización de datos validados" }),
  Object.freeze({ key: "dpiaReviewed", code: "DPIA_REVIEW", label: "EIPD/DPIA revisada cuando proceda" }),
  Object.freeze({ key: "policyVersioningReady", code: "POLICY_VERSIONING", label: "Versionado y evidencia de aceptación de políticas preparado" })
]);

const AI_REQUIREMENTS = Object.freeze([
  ...BASE_REQUIREMENTS,
  Object.freeze({ key: "aiTransparencyApproved", code: "AI_TRANSPARENCY", label: "Transparencia, finalidad y límites de IA aprobados" })
]);

function blocker(code, label, source = "READINESS") {
  return Object.freeze({ code, label, source });
}

function requirementBlockers(requirements, readiness) {
  return requirements
    .filter(item => !Boolean(readiness?.[item.key]))
    .map(item => blocker(item.code, item.label));
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

/**
 * Evaluates deployment readiness only. Authorization/data access is deliberately
 * absent from this policy so a paid plan can never be interpreted as consent.
 */
export function evaluateFamilyCommercialReadiness({
  readiness = FAMILY_COMMERCIAL_READINESS,
  growthConfig = FAMILY_GROWTH_CONFIG,
  aiPolicy = FAMILY_AI_POLICY
} = {}) {
  const operationalBlockers = requirementBlockers(BASE_REQUIREMENTS, readiness);
  const checkoutBlockers = [...operationalBlockers];
  const aiBlockers = requirementBlockers(AI_REQUIREMENTS, readiness);

  if (!readiness?.commercialPilotEnabled) {
    checkoutBlockers.unshift(blocker("COMMERCIAL_PILOT_DISABLED", "Piloto comercial desactivado", "ROLLOUT"));
  }
  if (!growthConfig?.checkoutEnabled) {
    checkoutBlockers.push(blocker("CHECKOUT_GATE_DISABLED", "Checkout desactivado por configuración de producto", "PRODUCT_GATE"));
  }

  if (!readiness?.commercialPilotEnabled) {
    aiBlockers.unshift(blocker("COMMERCIAL_PILOT_DISABLED", "Piloto comercial desactivado", "ROLLOUT"));
  }
  if (!readiness?.aiPilotEnabled) {
    aiBlockers.push(blocker("AI_PILOT_DISABLED", "Piloto IA familiar desactivado", "ROLLOUT"));
  }
  if (!aiPolicy?.commerciallyAvailable) {
    aiBlockers.push(blocker("AI_PRODUCT_DISABLED", "Productos IA familiares no comercializables", "PRODUCT_GATE"));
  }
  if (!aiPolicy?.providerGenerationEnabled) {
    aiBlockers.push(blocker("AI_PROVIDER_DISABLED", "Generación IA del proveedor desactivada", "PROVIDER_GATE"));
  }

  const safeCheckoutBlockers = dedupe(checkoutBlockers);
  const safeAiBlockers = dedupe(aiBlockers);

  return Object.freeze({
    legalOperational: Object.freeze({
      ready: operationalBlockers.length === 0,
      blockers: Object.freeze([...operationalBlockers])
    }),
    checkout: Object.freeze({
      ready: safeCheckoutBlockers.length === 0,
      blockers: Object.freeze(safeCheckoutBlockers)
    }),
    ai: Object.freeze({
      ready: safeAiBlockers.length === 0,
      blockers: Object.freeze(safeAiBlockers)
    })
  });
}

export function canStartFamilyCheckout(options = {}) {
  return evaluateFamilyCommercialReadiness(options).checkout.ready;
}

export function canStartFamilyAi(options = {}) {
  return evaluateFamilyCommercialReadiness(options).ai.ready;
}

export const FAMILY_COMMERCIAL_BASE_REQUIREMENTS = BASE_REQUIREMENTS;
export const FAMILY_COMMERCIAL_AI_REQUIREMENTS = AI_REQUIREMENTS;

export default evaluateFamilyCommercialReadiness;
