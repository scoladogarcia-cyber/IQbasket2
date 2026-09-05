/**
 * @fileoverview Product configuration for the closed Family value pilot.
 * @description UX configuration only. Backend RPCs independently validate the
 * duration, guardian relationship, pilot authority and entitlement bundle.
 */

export const FAMILY_PILOT_CONFIG = Object.freeze({
  pilotCode: "FAMILY_VALUE_V1",
  defaultTrialDays: 14,
  allowedTrialDays: Object.freeze([7, 14, 21, 30]),
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
