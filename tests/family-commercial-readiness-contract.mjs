import assert from "node:assert/strict";
import {
  canStartFamilyAi,
  canStartFamilyCheckout,
  evaluateFamilyCommercialReadiness
} from "../domain/family/FamilyCommercialReadinessPolicy.js";

const baseReady = Object.freeze({
  commercialPilotEnabled: true,
  aiPilotEnabled: false,
  privacyTermsApproved: true,
  consentRulesApproved: true,
  specialCategoryReviewApproved: true,
  rightsRetentionProcessApproved: true,
  processorContractsApproved: true,
  dpiaReviewed: true,
  aiTransparencyApproved: false,
  policyVersioningReady: true
});

const growthEnabled = Object.freeze({ checkoutEnabled: true });
const aiEnabled = Object.freeze({ commerciallyAvailable: true, providerGenerationEnabled: true });

// Safe defaults: deployment cannot become commercial accidentally.
const defaults = evaluateFamilyCommercialReadiness();
assert.equal(defaults.checkout.ready, false);
assert.equal(defaults.ai.ready, false);
assert(defaults.checkout.blockers.some(item => item.code === "COMMERCIAL_PILOT_DISABLED"));
assert(defaults.checkout.blockers.some(item => item.code === "CHECKOUT_GATE_DISABLED"));

// All legal/operational readiness plus product checkout gate is required.
const checkoutReady = evaluateFamilyCommercialReadiness({
  readiness: baseReady,
  growthConfig: growthEnabled,
  aiPolicy: aiEnabled
});
assert.equal(checkoutReady.legalOperational.ready, true);
assert.equal(checkoutReady.checkout.ready, true);
assert.equal(canStartFamilyCheckout({ readiness: baseReady, growthConfig: growthEnabled, aiPolicy: aiEnabled }), true);

// One missing external approval must fail closed and remain explainable.
const missingRights = evaluateFamilyCommercialReadiness({
  readiness: { ...baseReady, rightsRetentionProcessApproved: false },
  growthConfig: growthEnabled,
  aiPolicy: aiEnabled
});
assert.equal(missingRights.checkout.ready, false);
assert(missingRights.checkout.blockers.some(item => item.code === "RIGHTS_RETENTION"));

// Commercial readiness alone never activates family AI.
assert.equal(checkoutReady.ai.ready, false);
assert(checkoutReady.ai.blockers.some(item => item.code === "AI_PILOT_DISABLED"));
assert(checkoutReady.ai.blockers.some(item => item.code === "AI_TRANSPARENCY"));

// AI requires its own rollout flag, transparency approval and provider/product gates.
const aiReadyFlags = { ...baseReady, aiPilotEnabled: true, aiTransparencyApproved: true };
const aiReady = evaluateFamilyCommercialReadiness({
  readiness: aiReadyFlags,
  growthConfig: growthEnabled,
  aiPolicy: aiEnabled
});
assert.equal(aiReady.ai.ready, true);
assert.equal(canStartFamilyAi({ readiness: aiReadyFlags, growthConfig: growthEnabled, aiPolicy: aiEnabled }), true);

const providerBlocked = evaluateFamilyCommercialReadiness({
  readiness: aiReadyFlags,
  growthConfig: growthEnabled,
  aiPolicy: { commerciallyAvailable: true, providerGenerationEnabled: false }
});
assert.equal(providerBlocked.ai.ready, false);
assert(providerBlocked.ai.blockers.some(item => item.code === "AI_PROVIDER_DISABLED"));

console.log("FAMILY_COMMERCIAL_READINESS_OK");
