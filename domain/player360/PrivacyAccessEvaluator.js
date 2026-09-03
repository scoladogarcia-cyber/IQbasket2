/**
 * Pure ABAC evaluator for Player 360.
 *
 * IMPORTANT:
 * - This is a frontend/domain preview of access policy, never the authoritative
 *   security boundary. Backend RLS/RPC must evaluate equivalent attributes.
 * - SUPERADMIN does not bypass WELLNESS_RESTRICTED rules.
 * - Consent is not assumed to be the only lawful basis. The evaluator requires
 *   an auditable processing authorization with legal-basis attributes.
 */

import {
  PLAYER360_ABAC_REASON,
  PLAYER360_AUTHORIZATION_STATUS,
  PLAYER360_PRIVACY_ACTION,
  PLAYER360_PRIVACY_CONFIG,
  PLAYER360_PRIVACY_PURPOSE,
  PLAYER360_SUBJECT_RELATION
} from "../../config/player360-privacy.config.js";

const ACTIONS = new Set(Object.values(PLAYER360_PRIVACY_ACTION));
const PURPOSES = new Set(Object.values(PLAYER360_PRIVACY_PURPOSE));
const RELATIONS = new Set(Object.values(PLAYER360_SUBJECT_RELATION));

function normalizeUpper(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function containsNormalized(values, target, { lower = false } = {}) {
  const normalizedTarget = lower ? normalizeLower(target) : normalizeUpper(target);
  return (Array.isArray(values) ? values : [])
    .map(value => lower ? normalizeLower(value) : normalizeUpper(value))
    .includes(normalizedTarget);
}

function validNow(record = {}, now = new Date()) {
  if (normalizeUpper(record.status) !== PLAYER360_AUTHORIZATION_STATUS.ACTIVE) return false;
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(timestamp)) return false;

  const from = record.valid_from || record.validFrom;
  const until = record.valid_until || record.validUntil;
  if (from) {
    const fromTime = new Date(from).getTime();
    if (!Number.isFinite(fromTime) || fromTime > timestamp) return false;
  }
  if (until) {
    const untilTime = new Date(until).getTime();
    if (!Number.isFinite(untilTime) || untilTime <= timestamp) return false;
  }
  return true;
}

function scopeMatches(record = {}, context = {}) {
  const recordPlayerId = record.player_id ?? record.playerId ?? null;
  const recordTeamSeasonId = record.team_season_id ?? record.teamSeasonId ?? null;

  if (recordPlayerId && String(recordPlayerId) !== String(context.playerId || "")) return false;
  if (
    recordTeamSeasonId
    && String(recordTeamSeasonId) !== String(context.teamSeasonId || "")
  ) return false;
  return true;
}

function processingAuthorizationMatches(authorization = {}, context = {}, now) {
  if (!authorization || !validNow(authorization, now)) return false;
  if (!scopeMatches(authorization, context)) return false;
  if (!containsNormalized(authorization.modules, context.module, { lower: true })) return false;
  if (!containsNormalized(authorization.purposes, context.purpose)) return false;

  const legalBasis = String(
    authorization.legal_basis
    ?? authorization.legalBasis
    ?? ""
  ).trim();
  const specialCondition = String(
    authorization.special_category_condition
    ?? authorization.specialCategoryCondition
    ?? ""
  ).trim();

  return Boolean(legalBasis && specialCondition);
}

function grantMatches(grant = {}, context = {}, now) {
  if (!grant || !validNow(grant, now)) return false;
  if (!scopeMatches(grant, context)) return false;

  const actorId = grant.user_id ?? grant.userId ?? null;
  if (actorId && String(actorId) !== String(context.actorUserId || "")) return false;

  if (!containsNormalized(grant.modules, context.module, { lower: true })) return false;
  if (!containsNormalized(grant.actions, context.action)) return false;
  if (!containsNormalized(grant.purposes, context.purpose)) return false;

  return true;
}

function decision(allowed, reason, obligations = {}) {
  return Object.freeze({
    allowed: Boolean(allowed),
    reason,
    obligations: Object.freeze({
      audit: Boolean(obligations.audit),
      noClientProviderSecrets: Boolean(obligations.noClientProviderSecrets),
      humanReview: Boolean(obligations.humanReview),
      explicitExportGrant: Boolean(obligations.explicitExportGrant)
    })
  });
}

export class PrivacyAccessEvaluator {
  static evaluate({
    authenticated = false,
    basePermission = false,
    scopeAllowed = false,
    actorUserId = null,
    playerId = null,
    teamSeasonId = null,
    module = null,
    sensitivity = "STANDARD",
    action = PLAYER360_PRIVACY_ACTION.READ,
    purpose = PLAYER360_PRIVACY_PURPOSE.SPORT_PERFORMANCE,
    subjectRelation = PLAYER360_SUBJECT_RELATION.NONE,
    processingAuthorization = null,
    accessGrant = null,
    now = new Date()
  } = {}) {
    if (!authenticated) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_NOT_AUTHENTICATED);
    }
    if (!basePermission) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_BASE_PERMISSION);
    }
    if (!scopeAllowed) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_SCOPE);
    }

    const normalizedAction = normalizeUpper(action);
    if (!ACTIONS.has(normalizedAction)) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_ACTION);
    }

    const normalizedPurpose = normalizeUpper(purpose);
    if (!PURPOSES.has(normalizedPurpose)) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_PURPOSE);
    }

    const normalizedSensitivity = normalizeUpper(sensitivity);
    if (normalizedSensitivity === "STANDARD") {
      return decision(true, PLAYER360_ABAC_REASON.ALLOW_STANDARD_RBAC);
    }
    if (normalizedSensitivity === "PRIVATE_SPORTING") {
      return decision(true, PLAYER360_ABAC_REASON.ALLOW_PRIVATE_SPORTING_RBAC, {
        audit: normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
          || normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS
      });
    }

    if (normalizedSensitivity !== PLAYER360_PRIVACY_CONFIG.restrictedSensitivity) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_PROCESSING_AUTHORIZATION);
    }

    const normalizedModule = normalizeLower(module);
    if (!PLAYER360_PRIVACY_CONFIG.restrictedModules.includes(normalizedModule)) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_PROCESSING_AUTHORIZATION);
    }

    if (
      normalizedPurpose === PLAYER360_PRIVACY_PURPOSE.RESEARCH
      && !PLAYER360_PRIVACY_CONFIG.researchEnabled
    ) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_PURPOSE);
    }
    if (!PLAYER360_PRIVACY_CONFIG.allowedRestrictedPurposes.includes(normalizedPurpose)) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_PURPOSE);
    }

    const context = {
      actorUserId,
      playerId,
      teamSeasonId,
      module: normalizedModule,
      action: normalizedAction,
      purpose: normalizedPurpose
    };

    if (!processingAuthorizationMatches(processingAuthorization, context, now)) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_PROCESSING_AUTHORIZATION, {
        audit: true
      });
    }

    const specialCondition = String(
      processingAuthorization.special_category_condition
      ?? processingAuthorization.specialCategoryCondition
      ?? ""
    ).trim();
    if (!specialCondition) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_SPECIAL_CATEGORY_CONDITION, {
        audit: true
      });
    }

    if (
      normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS
      && PLAYER360_PRIVACY_CONFIG.aiProcessingRequiresExplicitAuthorization
      && !Boolean(
        processingAuthorization.ai_processing_allowed
        ?? processingAuthorization.aiProcessingAllowed
      )
    ) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_AI_PROCESSING_NOT_AUTHORIZED, {
        audit: true,
        noClientProviderSecrets: true,
        humanReview: true
      });
    }

    const relation = RELATIONS.has(normalizeUpper(subjectRelation))
      ? normalizeUpper(subjectRelation)
      : PLAYER360_SUBJECT_RELATION.NONE;

    const grantRequired =
      relation === PLAYER360_SUBJECT_RELATION.STAFF
      || relation === PLAYER360_SUBJECT_RELATION.NONE
      || normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
      || normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS;

    if (grantRequired && !grantMatches(accessGrant, context, now)) {
      return decision(
        false,
        normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
          ? PLAYER360_ABAC_REASON.DENY_EXPORT_NOT_AUTHORIZED
          : PLAYER360_ABAC_REASON.DENY_EXPLICIT_GRANT,
        {
          audit: true,
          noClientProviderSecrets: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
          humanReview: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
          explicitExportGrant: normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
        }
      );
    }

    if (relation === PLAYER360_SUBJECT_RELATION.SELF) {
      if (normalizedPurpose !== PLAYER360_PRIVACY_PURPOSE.PLAYER_SELF_SERVICE) {
        return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_PURPOSE, {
          audit: true
        });
      }
      return decision(true, PLAYER360_ABAC_REASON.ALLOW_RESTRICTED_SELF, {
        audit: true,
        noClientProviderSecrets: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
        humanReview: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
        explicitExportGrant: normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
      });
    }

    if (relation === PLAYER360_SUBJECT_RELATION.GUARDIAN) {
      if (normalizedPurpose !== PLAYER360_PRIVACY_PURPOSE.FAMILY_SUPPORT) {
        return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_PURPOSE, {
          audit: true
        });
      }
      const representativeId =
        processingAuthorization.representative_user_id
        ?? processingAuthorization.representativeUserId
        ?? null;
      if (
        representativeId
        && String(representativeId) !== String(actorUserId || "")
        && !grantMatches(accessGrant, context, now)
      ) {
        return decision(false, PLAYER360_ABAC_REASON.DENY_EXPLICIT_GRANT, {
          audit: true
        });
      }

      return decision(true, PLAYER360_ABAC_REASON.ALLOW_RESTRICTED_GUARDIAN, {
        audit: true,
        noClientProviderSecrets: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
        humanReview: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
        explicitExportGrant: normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
      });
    }

    if (
      ![
        PLAYER360_PRIVACY_PURPOSE.SPORT_PERFORMANCE,
        PLAYER360_PRIVACY_PURPOSE.OPERATIONS
      ].includes(normalizedPurpose)
    ) {
      return decision(false, PLAYER360_ABAC_REASON.DENY_UNSUPPORTED_PURPOSE, {
        audit: true
      });
    }

    if (grantMatches(accessGrant, context, now)) {
      return decision(true, PLAYER360_ABAC_REASON.ALLOW_RESTRICTED_EXPLICIT_GRANT, {
        audit: true,
        noClientProviderSecrets: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
        humanReview: normalizedAction === PLAYER360_PRIVACY_ACTION.AI_PROCESS,
        explicitExportGrant: normalizedAction === PLAYER360_PRIVACY_ACTION.EXPORT
      });
    }

    return decision(false, PLAYER360_ABAC_REASON.DENY_EXPLICIT_GRANT, {
      audit: true
    });
  }
}

export default PrivacyAccessEvaluator;
