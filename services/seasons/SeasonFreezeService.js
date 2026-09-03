/**
 * @fileoverview Ciclo de vida de cierre y reapertura de equipo-temporada.
 * @description Encapsula permisos y RPC V6. La UI nunca escribe directamente
 * team_seasons, partidos, plantilla ni auditoría.
 */

import { Permission } from "../../security/PermissionService.js";

function scopeContext(scope = {}) {
  return {
    teamId: scope.team_id || scope.teamId || null,
    seasonId: scope.season_id || scope.seasonId || null,
    teamSeasonId: scope.id || scope.team_season_id || scope.teamSeasonId || null
  };
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toUpperCase();
}

export class SeasonFreezeService {
  constructor(supabaseClient, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
  }

  static isFrozen(scope = {}) {
    return normalizeStatus(scope.data_status || scope.dataStatus || "ACTIVE") === "FROZEN";
  }

  async getCapabilities() {
    if (!this.supabase) return { ready: false, reason: "NO_DATABASE" };
    const { data, error } = await this.supabase.rpc("iq_v6_team_season_freeze_capabilities");
    if (error) return { ready: false, reason: "BACKEND_NOT_APPLIED" };
    return {
      ready: Boolean(data?.ready ?? data?.team_season_freeze),
      ...(data || {})
    };
  }

  canFreeze(scope = {}) {
    return !SeasonFreezeService.isFrozen(scope)
      && Boolean(this.auth?.canPreview?.(Permission.FREEZE_TEAM_SEASON, scopeContext(scope)));
  }

  canReopen(scope = {}) {
    return SeasonFreezeService.isFrozen(scope)
      && Boolean(this.auth?.canPreview?.(Permission.REOPEN_TEAM_SEASON, scopeContext(scope)));
  }

  canRequestFreeze(scope = {}) {
    return !SeasonFreezeService.isFrozen(scope)
      && Boolean(this.auth?.canPreview?.(
        Permission.REQUEST_TEAM_SEASON_FREEZE,
        scopeContext(scope)
      ));
  }

  canReviewRequests(scope = {}) {
    return Boolean(this.auth?.canPreview?.(
      Permission.REVIEW_TEAM_SEASON_FREEZE_REQUESTS,
      scopeContext(scope)
    ));
  }

  async listRequests(teamSeasonIds = [], { status = null } = {}) {
    if (!this.supabase) return [];

    let query = this.supabase
      .from("team_season_freeze_requests")
      .select("id,team_season_id,requested_by,requested_by_role,request_reason,status,created_at,resolved_at,resolved_by,resolution_note")
      .order("created_at", { ascending: false });

    const ids = [...new Set((teamSeasonIds || []).map(String).filter(Boolean))];
    if (ids.length > 0) query = query.in("team_season_id", ids);

    const normalized = status ? normalizeStatus(status) : null;
    if (normalized) query = query.eq("status", normalized);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async requestFreeze(teamSeasonId, reason = null) {
    if (!this.supabase) throw new Error("Base de datos no disponible.");
    const { data, error } = await this.supabase.rpc("iq_v6_request_team_season_freeze", {
      p_team_season_id: teamSeasonId,
      p_reason: reason || null
    });
    if (error) throw error;
    return data;
  }

  async setFrozen(teamSeasonId, frozen, reason = null) {
    if (!this.supabase) throw new Error("Base de datos no disponible.");
    const { data, error } = await this.supabase.rpc("iq_v6_set_team_season_data_state", {
      p_team_season_id: teamSeasonId,
      p_target_state: frozen ? "FROZEN" : "ACTIVE",
      p_reason: reason || null
    });
    if (error) throw error;
    return data;
  }

  async resolveRequest(requestId, decision, note = null) {
    if (!this.supabase) throw new Error("Base de datos no disponible.");
    const normalized = normalizeStatus(decision);
    if (!["APPROVED", "REJECTED"].includes(normalized)) {
      throw new Error("Resolución de cierre de temporada no válida.");
    }

    const { data, error } = await this.supabase.rpc(
      "iq_v6_resolve_team_season_freeze_request",
      {
        p_request_id: requestId,
        p_decision: normalized,
        p_resolution_note: note || null
      }
    );
    if (error) throw error;
    return data;
  }
}

export default SeasonFreezeService;
