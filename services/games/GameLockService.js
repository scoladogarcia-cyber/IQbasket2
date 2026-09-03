/**
 * @fileoverview Servicio de ciclo de vida de bloqueo de partidos.
 * @description Encapsula permisos y RPCs para solicitar, cerrar, reabrir y resolver
 * solicitudes de cierre. La base de datos sigue siendo la autoridad final.
 */

import { Permission } from "../../security/PermissionService.js";

function gameContext(game = {}) {
  return {
    teamId: game.team_id || game.teamId || null,
    seasonId: game.season_id || game.seasonId || null,
    teamSeasonId: game.team_season_id || game.teamSeasonId || null
  };
}

export class GameLockService {
  constructor(supabase, authController) {
    this.supabase = supabase || null;
    this.auth = authController || null;
  }

  static isLocked(game = {}) {
    return String(game.edit_state || game.editState || "OPEN").toUpperCase() === "LOCKED";
  }

  canLock(game = {}) {
    return Boolean(this.auth?.canPreview?.(Permission.LOCK_GAME, gameContext(game)));
  }

  canReopen(game = {}) {
    return Boolean(this.auth?.canPreview?.(Permission.REOPEN_GAME, gameContext(game)));
  }

  canReviewRequests(game = {}) {
    return Boolean(
      this.auth?.canPreview?.(Permission.REVIEW_GAME_LOCK_REQUESTS, gameContext(game))
    );
  }

  canRequestLock(game = {}) {
    return Boolean(
      this.auth?.canPreview?.(Permission.REQUEST_GAME_LOCK, gameContext(game))
    );
  }

  async listPendingRequests(gameIds = []) {
    if (!this.supabase) return [];

    let query = this.supabase
      .from("game_lock_requests")
      .select("id,game_id,requested_by,requested_by_role,request_reason,status,created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    const ids = [...new Set((gameIds || []).map(String).filter(Boolean))];
    if (ids.length > 0) query = query.in("game_id", ids);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async requestLock(gameId, reason = null) {
    if (!this.supabase) throw new Error("Base de datos no disponible.");
    const { data, error } = await this.supabase.rpc("iq_v5_request_game_lock", {
      p_game_id: gameId,
      p_reason: reason || null
    });
    if (error) throw error;
    return data;
  }

  async setLocked(gameId, locked, reason = null) {
    if (!this.supabase) throw new Error("Base de datos no disponible.");
    const { data, error } = await this.supabase.rpc("iq_v5_set_game_edit_state", {
      p_game_id: gameId,
      p_target_state: locked ? "LOCKED" : "OPEN",
      p_reason: reason || null
    });
    if (error) throw error;
    return data;
  }

  async resolveRequest(requestId, decision, note = null) {
    if (!this.supabase) throw new Error("Base de datos no disponible.");
    const normalized = String(decision || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(normalized)) {
      throw new Error("Resolución de solicitud no válida.");
    }

    const { data, error } = await this.supabase.rpc("iq_v5_resolve_game_lock_request", {
      p_request_id: requestId,
      p_decision: normalized,
      p_resolution_note: note || null
    });
    if (error) throw error;
    return data;
  }
}

export default GameLockService;
