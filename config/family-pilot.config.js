/**
 * @fileoverview Product configuration for the closed Family value pilot.
 * @description UX configuration only. Backend RPCs independently validate the
 * duration, guardian relationship, pilot authority and entitlement bundle.
 */

export const FAMILY_PILOT_CONFIG = Object.freeze({
  pilotCode: "FAMILY_VALUE_V1",
  // Four weeks is long enough to observe repeated game/training cycles without
  // turning the pilot into an indefinite free premium plan.
  defaultTrialDays: 28,
  allowedTrialDays: Object.freeze([7, 14, 28, 42, 56]),
  includesAi: false,
  includesSensitiveModules: false,
  entitlementCodes: Object.freeze([
    "ADVANCED_ANALYTICS",
    "PLAYER360",
    "PLAYER_GOALS",
    "DEVELOPMENT_PLAN",
    "TECHNIFICATION",
    "FAMILY_INSIGHTS",
    "REPORT_EXPORT",
    "EXPORT_MONTHLY_UNITS"
  ])
});

export default FAMILY_PILOT_CONFIG;
