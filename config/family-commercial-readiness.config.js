/**
 * @fileoverview Fail-closed rollout configuration for IQBasket Family monetization.
 * @description External legal/operational approvals are deployment inputs, not
 * authorization rules. Every flag defaults to false. Backend RBAC/ABAC, privacy
 * grants, billing and AI provider gates remain the authoritative controls.
 */

const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};

function envFlag(key) {
  const value = String(env?.[key] ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

export const FAMILY_COMMERCIAL_READINESS_ENV_KEYS = Object.freeze({
  commercialPilotEnabled: "VITE_IQB_FAMILY_COMMERCIAL_PILOT_ENABLED",
  aiPilotEnabled: "VITE_IQB_FAMILY_AI_PILOT_ENABLED",
  privacyTermsApproved: "VITE_IQB_FAMILY_PRIVACY_TERMS_APPROVED",
  consentRulesApproved: "VITE_IQB_FAMILY_CONSENT_RULES_APPROVED",
  specialCategoryReviewApproved: "VITE_IQB_FAMILY_SPECIAL_CATEGORY_REVIEW_APPROVED",
  rightsRetentionProcessApproved: "VITE_IQB_FAMILY_RIGHTS_RETENTION_PROCESS_APPROVED",
  processorContractsApproved: "VITE_IQB_FAMILY_PROCESSOR_CONTRACTS_APPROVED",
  dpiaReviewed: "VITE_IQB_FAMILY_DPIA_REVIEWED",
  aiTransparencyApproved: "VITE_IQB_FAMILY_AI_TRANSPARENCY_APPROVED",
  policyVersioningReady: "VITE_IQB_FAMILY_POLICY_VERSIONING_READY"
});

/**
 * Deployment readiness state. False is always the safe default.
 * These flags never grant access to player data and never replace consent,
 * relationship, entitlement or server-side billing/AI checks.
 */
export const FAMILY_COMMERCIAL_READINESS = Object.freeze(
  Object.fromEntries(
    Object.entries(FAMILY_COMMERCIAL_READINESS_ENV_KEYS)
      .map(([key, envKey]) => [key, envFlag(envKey)])
  )
);

export default FAMILY_COMMERCIAL_READINESS;
