/**
 * @fileoverview Stable commercial capability contract for IQBasket.
 * @description RBAC/ABAC decides who may act. Entitlements decide whether a
 * billing account has purchased a capability for an eligible sports subject.
 * Plan codes are never used directly for authorization decisions.
 */

export const EntitlementValueType = Object.freeze({
  BOOLEAN: "BOOLEAN",
  INTEGER: "INTEGER",
  TEXT: "TEXT"
});

export const BillingAccountType = Object.freeze({
  FAMILY: "FAMILY",
  TEAM: "TEAM",
  CLUB: "CLUB",
  ACADEMY: "ACADEMY",
  INTERNAL: "INTERNAL"
});

export const BillingSubjectType = Object.freeze({
  PLAYER: "PLAYER",
  TEAM: "TEAM",
  CLUB: "CLUB"
});
export const BillingAccountStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CLOSED: "CLOSED"
});

export const SubscriptionStatus = Object.freeze({
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  GRACE: "GRACE",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED"
});

export const BeneficiaryScope = Object.freeze({
  ACCOUNT_MEMBERS: "ACCOUNT_MEMBERS",
  AUTHORIZED_STAFF: "AUTHORIZED_STAFF",
  ALL_AUTHORIZED: "ALL_AUTHORIZED"
});

export const EntitlementCode = Object.freeze({
  PLAYER_PROFILE: "PLAYER_PROFILE",
  GAME_HISTORY: "GAME_HISTORY",
  BASIC_STATS: "BASIC_STATS",
  BASIC_TIMELINE: "BASIC_TIMELINE",
  ADVANCED_ANALYTICS: "ADVANCED_ANALYTICS",
  PLAYER360: "PLAYER360",
  PLAYER_GOALS: "PLAYER_GOALS",
  DEVELOPMENT_PLAN: "DEVELOPMENT_PLAN",
  TECHNIFICATION: "TECHNIFICATION",
  FAMILY_INSIGHTS: "FAMILY_INSIGHTS",
  REPORT_EXPORT: "REPORT_EXPORT",
  WELLNESS: "WELLNESS",
  NUTRITION_RECOVERY: "NUTRITION_RECOVERY",
  PRIVACY_CENTER: "PRIVACY_CENTER",
  AI_INSIGHTS: "AI_INSIGHTS",
  AI_WEEKLY_PLAN: "AI_WEEKLY_PLAN",
  ROSTER_MANAGEMENT: "ROSTER_MANAGEMENT",
  LIVE_GAME: "LIVE_GAME",
  TRAINING_MANAGEMENT: "TRAINING_MANAGEMENT",
  CLUB_ADMIN: "CLUB_ADMIN",
  AUDIT_LOG: "AUDIT_LOG",
  API_ACCESS: "API_ACCESS",
  WHITE_LABEL: "WHITE_LABEL",
  MAX_PLAYERS: "MAX_PLAYERS",
  MAX_ACTIVE_TEAMS: "MAX_ACTIVE_TEAMS",
  AI_MONTHLY_UNITS: "AI_MONTHLY_UNITS",
  EXPORT_MONTHLY_UNITS: "EXPORT_MONTHLY_UNITS"
});
export function normalizeEntitlementCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeBillingSubjectType(value) {
  return String(value || "").trim().toUpperCase();
}
