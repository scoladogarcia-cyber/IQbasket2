import assert from "node:assert/strict";
import fs from "node:fs";
import { FAMILY_BILLING_GATEWAY_CONFIG } from "../config/family-billing-gateway.config.js";
import { FamilyBillingGatewayService } from "../services/billing/FamilyBillingGatewayService.js";

const edgeSource = fs.readFileSync("supabase/functions/family-checkout-session/index.ts", "utf8");

assert.equal(FAMILY_BILLING_GATEWAY_CONFIG.checkoutInvocationEnabled, false);
assert.equal(FAMILY_BILLING_GATEWAY_CONFIG.edgeFunctionName, "family-checkout-session");

let calls = 0;
const fakeClient = {
  functions: {
    invoke: async (name, options) => {
      calls += 1;
      return {
        data: {
          success: true,
          checkout_url: "https://billing.example.test/session/abc",
          session_id: "session_abc",
          provider: "TEST"
        },
        error: null,
        name,
        options
      };
    }
  }
};

const disabled = new FamilyBillingGatewayService(fakeClient);
await assert.rejects(
  () => disabled.createCheckoutSession({
    billingAccountId: "675d11ff-97d4-47a0-a189-9f0f818a8ed4",
    planCode: "FAMILY",
    returnUrl: "https://app.example.test/family"
  }),
  /FAMILY_BILLING_GATEWAY_NOT_ENABLED/
);
assert.equal(calls, 0, "disabled client gate must not invoke the Edge Function");

let invoked = null;
const enabledClient = {
  functions: {
    invoke: async (name, options) => {
      invoked = { name, options };
      return {
        data: {
          success: true,
          checkout_url: "https://billing.example.test/session/abc",
          session_id: "session_abc",
          provider: "TEST",
          replayed: false
        },
        error: null
      };
    }
  }
};

const enabled = new FamilyBillingGatewayService(enabledClient, {
  checkoutInvocationEnabled: true
});
const fixedKey = "9813f849-3661-47b0-915e-19119825c33e";
const session = await enabled.createCheckoutSession({
  billingAccountId: "675d11ff-97d4-47a0-a189-9f0f818a8ed4",
  planCode: "family_pro",
  returnUrl: "https://app.example.test/family",
  idempotencyKey: fixedKey
});
assert.equal(invoked.name, "family-checkout-session");
assert.deepEqual(invoked.options.body, {
  billing_account_id: "675d11ff-97d4-47a0-a189-9f0f818a8ed4",
  plan_code: "FAMILY_PRO",
  return_url: "https://app.example.test/family",
  idempotency_key: fixedKey
});
assert.equal(session.idempotencyKey, fixedKey);
assert.equal(session.checkoutUrl, "https://billing.example.test/session/abc");

// Independent backend gates: a frontend flag can never unlock billing.
assert.match(edgeSource, /IQB_FAMILY_BILLING_CHECKOUT_ENABLED/);
assert.match(edgeSource, /IQB_FAMILY_COMMERCIAL_PILOT_ENABLED/);
assert.match(edgeSource, /IQB_FAMILY_PRIVACY_TERMS_APPROVED/);
assert.match(edgeSource, /IQB_FAMILY_CONSENT_RULES_APPROVED/);
assert.match(edgeSource, /IQB_FAMILY_SPECIAL_CATEGORY_REVIEW_APPROVED/);
assert.match(edgeSource, /IQB_FAMILY_RIGHTS_RETENTION_PROCESS_APPROVED/);
assert.match(edgeSource, /IQB_FAMILY_PROCESSOR_CONTRACTS_APPROVED/);
assert.match(edgeSource, /IQB_FAMILY_DPIA_REVIEWED/);
assert.match(edgeSource, /IQB_FAMILY_POLICY_VERSIONING_READY/);

// Server validates identity, billing authority, plan publication and safe return URL.
assert.match(edgeSource, /callerClient\.auth\.getUser\(\)/);
assert.match(edgeSource, /saas_billing_account_members/);
assert.match(edgeSource, /BILLING_ROLES/);
assert.match(edgeSource, /saas_plans/);
assert.match(edgeSource, /plan\.status !== "ACTIVE"/);
assert.match(edgeSource, /plan\.is_public !== true/);
assert.match(edgeSource, /IQB_FAMILY_PAID_PLAN_CODES/);
assert.match(edgeSource, /IQB_APP_ALLOWED_RETURN_ORIGINS/);

// V1 cannot mutate commercial truth or call any external billing provider.
assert.doesNotMatch(edgeSource, /from\("saas_subscriptions"\)/);
assert.doesNotMatch(edgeSource, /from\("saas_entitlement_overrides"\)/);
assert.doesNotMatch(edgeSource, /\.insert\s*\(/);
assert.doesNotMatch(edgeSource, /\.update\s*\(/);
assert.doesNotMatch(edgeSource, /\.upsert\s*\(/);
assert.doesNotMatch(edgeSource, /await\s+fetch\s*\(/);
assert.match(edgeSource, /BILLING_PROVIDER_NOT_CONFIGURED/);
assert.match(edgeSource, /BILLING_PROVIDER_NOT_IMPLEMENTED/);

console.log("FAMILY_BILLING_BOUNDARY_OK");
