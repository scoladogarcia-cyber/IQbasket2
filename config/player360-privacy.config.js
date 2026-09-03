/**
 * Player 360 privacy / ABAC configuration.
 *
 * This file models product authorization requirements. It does not encode a
 * legal opinion: lawful-basis and special-category conditions are persisted as
 * auditable attributes so policy can evolve without rewriting UI logic.
 */

export const PLAYER360_PRIVACY_ACTION = Object.freeze({
  READ: "READ",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  EXPORT: "EXPORT",
  AI_PROCESS: "AI_PROCESS"
});

export const PLAYER360_PRIVACY_PURPOSE = Object.freeze({
  SPORT_PERFORMANCE: "SPORT_PERFORMANCE",
  PLAYER_SELF_SERVICE: "PLAYER_SELF_SERVICE",
  FAMILY_SUPPORT: "FAMILY_SUPPORT",
  OPERATIONS: "OPERATIONS",
  RESEARCH: "RESEARCH"
});

export const PLAYER360_SUBJECT_RELATION = Object.freeze({
  SELF: "SELF",
  GUARDIAN: "GUARDIAN",
  STAFF: "STAFF",
  NONE: "NONE"
});

export const PLAYER360_AUTHORIZATION_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
  SUSPENDED: "SUSPENDED"
});

export const PLAYER360_ABAC_REASON = Object.freeze({
  ALLOW_STANDARD_RBAC: "ALLOW_STANDARD_RBAC",
  ALLOW_PRIVATE_SPORTING_RBAC: "ALLOW_PRIVATE_SPORTING_RBAC",
  ALLOW_RESTRICTED_SELF: "ALLOW_RESTRICTED_SELF",
  ALLOW_RESTRICTED_GUARDIAN: "ALLOW_RESTRICTED_GUARDIAN",
  ALLOW_RESTRICTED_EXPLICIT_GRANT: "ALLOW_RESTRICTED_EXPLICIT_GRANT",
  DENY_NOT_AUTHENTICATED: "DENY_NOT_AUTHENTICATED",
  DENY_BASE_PERMISSION: "DENY_BASE_PERMISSION",
  DENY_SCOPE: "DENY_SCOPE",
  DENY_UNSUPPORTED_ACTION: "DENY_UNSUPPORTED_ACTION",
  DENY_UNSUPPORTED_PURPOSE: "DENY_UNSUPPORTED_PURPOSE",
  DENY_PROCESSING_AUTHORIZATION: "DENY_PROCESSING_AUTHORIZATION",
  DENY_SPECIAL_CATEGORY_CONDITION: "DENY_SPECIAL_CATEGORY_CONDITION",
  DENY_EXPLICIT_GRANT: "DENY_EXPLICIT_GRANT",
  DENY_AI_PROCESSING_NOT_AUTHORIZED: "DENY_AI_PROCESSING_NOT_AUTHORIZED",
  DENY_EXPORT_NOT_AUTHORIZED: "DENY_EXPORT_NOT_AUTHORIZED"
});

export const PLAYER360_PRIVACY_CONFIG = Object.freeze({
  restrictedSensitivity: "WELLNESS_RESTRICTED",

  restrictedModules: Object.freeze([
    "recovery",
    "nutrition",
    "neuro_cognitive"
  ]),

  allowedRestrictedPurposes: Object.freeze([
    PLAYER360_PRIVACY_PURPOSE.SPORT_PERFORMANCE,
    PLAYER360_PRIVACY_PURPOSE.PLAYER_SELF_SERVICE,
    PLAYER360_PRIVACY_PURPOSE.FAMILY_SUPPORT,
    PLAYER360_PRIVACY_PURPOSE.OPERATIONS
  ]),

  /**
   * Research is intentionally excluded from the default runtime policy.
   * A future research mode must use a separate approval/pseudonymisation path.
   */
  researchEnabled: false,

  /**
   * Restricted AI processing is opt-in per processing authorization and never
   * inherited from generic USE_AI / GENERATE_AI_INSIGHTS.
   */
  aiProcessingRequiresExplicitAuthorization: true,

  /**
   * Generic export of restricted data always requires an explicit grant.
   * Subject rights/portability should use a dedicated audited workflow.
   */
  restrictedExportRequiresExplicitGrant: true
});

export default PLAYER360_PRIVACY_CONFIG;
