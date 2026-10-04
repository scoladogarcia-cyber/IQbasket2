/**
 * @fileoverview Central product configuration for the IQBasket Player Passport.
 * @description Keeps commercial gating, presentation rules and longitudinal thresholds
 * independent from UI code. Authorization still requires RBAC/ABAC and backend validation.
 */
import { EntitlementCode } from "../security/entitlements.js";

export const PLAYER_PASSPORT_CONFIG = Object.freeze({
  schemaVersion: "1.0",
  entitlementCode: EntitlementCode.PLAYER_PASSPORT,
  catalogUrl: new URL("./player-passport.catalog.json", import.meta.url).href,
  scoreScale: Object.freeze({ min: 1, max: 5, notEvaluated: "NE" }),
  contexts: Object.freeze(["T", "JR", "P5", "VIDEO"]),
  privilegedRoles: Object.freeze(["SUPERADMIN", "ADMIN"]),
  demo: Object.freeze({
    allowTestSeasons: true
  }),
  confidence: Object.freeze({
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH"
  }),
  roleCoverageThreshold: 0.6,
  strengthThreshold: 4,
  limiterThreshold: 2,
  evolutionWindowsMonths: Object.freeze([6, 12, 24])
});

export default PLAYER_PASSPORT_CONFIG;
