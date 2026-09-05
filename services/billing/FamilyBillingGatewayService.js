/**
 * @fileoverview Provider-neutral client boundary for IQBasket Family checkout.
 * @description The browser may only request a backend checkout session. It can
 * never create/update subscriptions, billing customers or paid entitlements.
 */

import { FAMILY_BILLING_GATEWAY_CONFIG } from "../../config/family-billing-gateway.config.js";

function assertFunctionsClient(client) {
  if (!client?.functions || typeof client.functions.invoke !== "function") {
    throw new Error("FAMILY_BILLING_BACKEND_UNAVAILABLE");
  }
}

function requiredText(value, code) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function resolveIdempotencyKey(value = null) {
  if (value) return requiredText(value, "BILLING_IDEMPOTENCY_KEY_REQUIRED");
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  throw new Error("BILLING_IDEMPOTENCY_KEY_UNAVAILABLE");
}

/**
 * Thin client adapter. Security is intentionally not implemented here: the
 * server independently validates authentication, account membership, plan
 * availability, commercial readiness and provider configuration.
 */
export class FamilyBillingGatewayService {
  constructor(supabaseClient = null, options = {}) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.edgeFunctionName = options.edgeFunctionName
      || FAMILY_BILLING_GATEWAY_CONFIG.edgeFunctionName;
    this.checkoutInvocationEnabled = options.checkoutInvocationEnabled
      ?? FAMILY_BILLING_GATEWAY_CONFIG.checkoutInvocationEnabled;
  }

  isEnabled() {
    return Boolean(this.checkoutInvocationEnabled);
  }

  async createCheckoutSession({
    billingAccountId,
    planCode,
    returnUrl,
    idempotencyKey = null
  } = {}) {
    assertFunctionsClient(this.supabase);

    if (!this.isEnabled()) {
      throw new Error("FAMILY_BILLING_GATEWAY_NOT_ENABLED");
    }

    const accountId = requiredText(billingAccountId, "BILLING_ACCOUNT_REQUIRED");
    const code = requiredText(planCode, "BILLING_PLAN_REQUIRED").toUpperCase();
    const safeReturnUrl = requiredText(returnUrl, "BILLING_RETURN_URL_REQUIRED");
    const requestKey = resolveIdempotencyKey(idempotencyKey);

    const { data, error } = await this.supabase.functions.invoke(this.edgeFunctionName, {
      body: {
        billing_account_id: accountId,
        plan_code: code,
        return_url: safeReturnUrl,
        idempotency_key: requestKey
      }
    });

    if (error) throw error;
    if (!data?.success || !data?.checkout_url || !data?.session_id) {
      const codeValue = data?.error_code || "FAMILY_CHECKOUT_SESSION_FAILED";
      throw new Error(codeValue);
    }

    return Object.freeze({
      checkoutUrl: data.checkout_url,
      sessionId: data.session_id,
      provider: data.provider || null,
      expiresAt: data.expires_at || null,
      idempotencyKey: requestKey,
      replayed: Boolean(data.replayed)
    });
  }
}

export default FamilyBillingGatewayService;
