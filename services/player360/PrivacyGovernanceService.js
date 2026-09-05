/**
 * @fileoverview Servicio de gobierno de privacidad de Player 360.
 * @description Encapsula el acceso al Privacy Center. Nunca consulta las
 * tablas sensibles directamente: toda lectura/mutación pasa por RPCs con
 * validación contextual en backend.
 */

import {
  isSupportedAuthorizationType,
  requiresGuardianRepresentative
} from "../../domain/privacy/PrivacyReadinessPolicy.js";

function assertClient(client) {
  if (!client || typeof client.rpc !== "function") {
    throw new Error("PrivacyGovernanceService: cliente de datos no disponible.");
  }
}

function required(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`PrivacyGovernanceService: ${label} es obligatorio.`);
  }
  return value;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStringArray(value, transform = value => value) {
  return normalizeArray(value)
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .map(transform);
}

export class PrivacyGovernanceService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    assertClient(this.supabase);
  }

  async _rpc(name, params = {}) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc(name, params);
    if (error) throw error;
    return data;
  }

  async getCapabilities(teamSeasonId) {
    required(teamSeasonId, "teamSeasonId");
    return (await this._rpc("iq_v4e_privacy_capabilities", {
      p_team_season_id: teamSeasonId
    })) || {};
  }

  async getSnapshot({ teamSeasonId, playerId = null } = {}) {
    required(teamSeasonId, "teamSeasonId");
    const data = await this._rpc("iq_v4f_privacy_center_snapshot", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId || null
    });
    return {
      ...(data || {}),
      players: normalizeArray(data?.players),
      relationships: normalizeArray(data?.relationships),
      counts: data?.counts || {}
    };
  }

  async listAuthorizations({ teamSeasonId, playerId = null } = {}) {
    required(teamSeasonId, "teamSeasonId");
    const data = await this._rpc("iq_v4f_list_privacy_authorizations", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId || null
    });
    return normalizeArray(data);
  }

  async listSensitiveAccess({ teamSeasonId, playerId = null } = {}) {
    required(teamSeasonId, "teamSeasonId");
    const data = await this._rpc("iq_v4f_list_sensitive_access", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId || null
    });
    return {
      requests: normalizeArray(data?.requests),
      grants: normalizeArray(data?.grants)
    };
  }

  async listAudit({ teamSeasonId, playerId = null, limit = 100 } = {}) {
    required(teamSeasonId, "teamSeasonId");
    const data = await this._rpc("iq_v4f_list_privacy_audit", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId || null,
      p_limit: Math.max(1, Math.min(Number(limit) || 100, 500))
    });
    return normalizeArray(data);
  }

  async recordRelationship({
    teamSeasonId,
    userId,
    playerId,
    relationshipType,
    validUntil = null,
    verificationSource = null
  } = {}) {
    required(teamSeasonId, "teamSeasonId");
    required(userId, "userId");
    required(playerId, "playerId");
    required(relationshipType, "relationshipType");

    return this._rpc("iq_v4e_record_subject_relationship", {
      p_team_season_id: teamSeasonId,
      p_user_id: userId,
      p_player_id: playerId,
      p_relationship_type: String(relationshipType).toUpperCase(),
      p_valid_until: validUntil,
      p_verification_source: verificationSource || null
    });
  }

  async revokeRelationship({ teamSeasonId, relationshipId, reason } = {}) {
    required(teamSeasonId, "teamSeasonId");
    required(relationshipId, "relationshipId");
    required(reason, "reason");
    return Boolean(await this._rpc("iq_v4e_revoke_subject_relationship", {
      p_team_season_id: teamSeasonId,
      p_relationship_id: relationshipId,
      p_reason: String(reason).trim()
    }));
  }

  async recordAuthorization({
    teamSeasonId,
    playerId,
    modules,
    purposes,
    authorizationType,
    legalBasisCode,
    specialCategoryConditionCode,
    aiProcessingAllowed = false,
    representativeUserId = null,
    validUntil = null,
    evidenceReference = null
  } = {}) {
    required(teamSeasonId, "teamSeasonId");
    required(playerId, "playerId");
    required(authorizationType, "authorizationType");
    required(legalBasisCode, "legalBasisCode");
    required(specialCategoryConditionCode, "specialCategoryConditionCode");

    const normalizedAuthorizationType = String(authorizationType).trim().toUpperCase();
    if (!isSupportedAuthorizationType(normalizedAuthorizationType)) {
      throw new Error("PrivacyGovernanceService: tipo de autorización no soportado.");
    }
    if (requiresGuardianRepresentative(normalizedAuthorizationType) && !representativeUserId) {
      throw new Error("PrivacyGovernanceService: representativeUserId es obligatorio para GUARDIAN_CONSENT.");
    }

    const normalizedModules = normalizeStringArray(modules, value => value.toLowerCase());
    const normalizedPurposes = normalizeStringArray(purposes, value => value.toUpperCase());
    if (!normalizedModules.length) throw new Error("PrivacyGovernanceService: indica al menos un módulo.");
    if (!normalizedPurposes.length) throw new Error("PrivacyGovernanceService: indica al menos una finalidad.");

    return this._rpc("iq_v4e_record_processing_authorization", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_modules: normalizedModules,
      p_purposes: normalizedPurposes,
      p_authorization_type: normalizedAuthorizationType,
      p_legal_basis_code: String(legalBasisCode).trim(),
      p_special_category_condition_code: String(specialCategoryConditionCode).trim(),
      p_ai_processing_allowed: Boolean(aiProcessingAllowed),
      p_representative_user_id: representativeUserId || null,
      p_valid_until: validUntil,
      p_evidence_reference: evidenceReference || null
    });
  }

  async revokeAuthorization({ authorizationId, reason } = {}) {
    required(authorizationId, "authorizationId");
    required(reason, "reason");
    return Boolean(await this._rpc("iq_v4e_revoke_processing_authorization", {
      p_authorization_id: authorizationId,
      p_reason: String(reason).trim()
    }));
  }

  async grantSensitiveAccess({
    teamSeasonId,
    userId,
    playerId,
    modules,
    actions,
    purposes,
    validUntil,
    reason,
    requestId = null
  } = {}) {
    required(teamSeasonId, "teamSeasonId");
    required(userId, "userId");
    required(playerId, "playerId");
    required(validUntil, "validUntil");
    required(reason, "reason");

    const normalizedModules = normalizeStringArray(modules, value => value.toLowerCase());
    const normalizedActions = normalizeStringArray(actions, value => value.toUpperCase());
    const normalizedPurposes = normalizeStringArray(purposes, value => value.toUpperCase());
    if (!normalizedModules.length || !normalizedActions.length || !normalizedPurposes.length) {
      throw new Error("PrivacyGovernanceService: módulos, acciones y finalidades son obligatorios.");
    }

    return this._rpc("iq_v4e_grant_sensitive_access", {
      p_team_season_id: teamSeasonId,
      p_user_id: userId,
      p_player_id: playerId,
      p_modules: normalizedModules,
      p_actions: normalizedActions,
      p_purposes: normalizedPurposes,
      p_valid_until: validUntil,
      p_reason: String(reason).trim(),
      p_request_id: requestId || null
    });
  }

  /**
   * Rechaza una solicitud pendiente mediante el RPC auditado de Phase 4F.
   * La autorización contextual se vuelve a comprobar en PostgreSQL.
   */
  async rejectSensitiveAccessRequest({ requestId, reason } = {}) {
    required(requestId, "requestId");
    required(reason, "reason");
    return Boolean(await this._rpc("iq_v4f_reject_sensitive_access_request", {
      p_request_id: requestId,
      p_reason: String(reason).trim()
    }));
  }

  async revokeSensitiveGrant({ grantId, reason } = {}) {
    required(grantId, "grantId");
    required(reason, "reason");
    return Boolean(await this._rpc("iq_v4e_revoke_sensitive_access_grant", {
      p_grant_id: grantId,
      p_reason: String(reason).trim()
    }));
  }
}

export default PrivacyGovernanceService;
