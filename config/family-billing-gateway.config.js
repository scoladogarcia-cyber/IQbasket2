/**
 * @fileoverview Client-side configuration for the IQBasket Family billing boundary.
 * @description This is a UX/deployment gate only. It never authorizes billing,
 * activates subscriptions or exposes provider credentials. The Edge Function is
 * independently fail-closed with server-only environment flags.
 */

export const FAMILY_BILLING_GATEWAY_CONFIG = Object.freeze({
  gatewayVersion: "FAMILY_BILLING_GATEWAY_V1",
  edgeFunctionName: "family-checkout-session",
  /**
   * Deliberately false until the backend billing adapter, webhook verification,
   * commercial readiness and paid-plan publication are validated.
   */
  checkoutInvocationEnabled: false
});

export default FAMILY_BILLING_GATEWAY_CONFIG;
