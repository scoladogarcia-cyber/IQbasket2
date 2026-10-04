/**
 * @fileoverview RPC boundary for per-game capture delegation.
 * @description Keeps delegation, minimal game snapshots and scoped capture writes
 * behind V21/V28 RPCs. V28 adds the live single-writer lease without changing
 * the underlying delegation model.
 */

import { Permission } from "../../security/permissions.js";
import { GameLiveSessionService } from "./GameLiveSessionService.js";

export const DELEGATABLE_GAME_PERMISSIONS = Object.freeze([
  Permission.RECORD_LIVE_GAME,
  Permission.RECORD_QUICK_GAME,
  Permission.EDIT_BOXSCORE,
  Permission.PREPARE_GAME,
  Permission.START_GAME,
  Permission.FINISH_GAME
]);

const DELEGATABLE_PERMISSION_SET = new Set(DELEGATABLE_GAME_PERMISSIONS);

function requireUuid(value, label) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`GameCaptureDelegationService: ${label} inválido.`);
  }
  return text;
}

function normalizeCapabilities(capabilities = []) {
  const values = [...new Set((Array.isArray(capabilities) ? capabilities : [capabilities])
    .map(value => String(value || "").trim().toUpperCase())
    .filter(Boolean))];

  if (values.some(value => !DELEGATABLE_PERMISSION_SET.has(value))) {
    throw new Error("GameCaptureDelegationService: capacidad no delegable.");
  }
  return values;
}

function rpcError(error, fallback) {
  const raw = String(error?.message || "");
  if (raw.includes("GAME_LIVE_LEASE_REQUIRED") || raw.includes("GAME_LIVE_LEASE_INVALID")) {
    return new Error("Necesitas poseer el turno de escritura de este partido en vivo para guardar cambios.");
  }
  return new Error(raw || fallback);
}

function isMissingRpc(error, rpcName) {
  return Boolean(
    error
    && (
      error.code === "PGRST202"
      || String(error.message || "").includes(rpcName)
    )
  );
}

export class GameCaptureDelegationService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.liveSessionService = new GameLiveSessionService(this.supabase);
  }

  _requireClient() {
    if (!this.supabase?.rpc) {
      throw new Error("GameCaptureDelegationService: backend no disponible.");
    }
  }

  async getMyDelegations() {
    this._requireClient();
    const { data, error } = await this.supabase.rpc("iq_v21_my_game_capture_delegations");
    if (error) {
      if (error.code === "PGRST202" || /iq_v21_my_game_capture_delegations/i.test(error.message || "")) {
        return [];
      }
      throw rpcError(error, "No se pudieron cargar tus delegaciones de partido.");
    }
    return Array.isArray(data) ? data : [];
  }

  async getSnapshot(gameId) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const v59Rpc = "iq_v59_game_capture_snapshot";
    const v59 = await this.supabase.rpc(v59Rpc, { p_game_id: id });
    if (!v59.error) return v59.data || null;
    if (!isMissingRpc(v59.error, v59Rpc)) {
      throw rpcError(v59.error, "No se pudo cargar el registro ordenado del partido.");
    }

    const { data, error } = await this.supabase.rpc("iq_v21_game_capture_snapshot", {
      p_game_id: id
    });
    if (error) throw rpcError(error, "No se pudo cargar el partido delegado.");
    return data || null;
  }

  async list(gameId) {
    this._requireClient();
    const { data, error } = await this.supabase.rpc("iq_v21_list_game_capture_delegations", {
      p_game_id: requireUuid(gameId, "gameId")
    });
    if (error) throw rpcError(error, "No se pudieron cargar las delegaciones del partido.");
    return Array.isArray(data) ? data : [];
  }

  async grant({ gameId, email, capabilities, validUntil, validFrom = null, note = null }) {
    this._requireClient();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("GameCaptureDelegationService: email inválido.");
    }
    const normalizedCapabilities = normalizeCapabilities(capabilities);
    if (normalizedCapabilities.length === 0) {
      throw new Error("GameCaptureDelegationService: selecciona al menos una capacidad.");
    }
    const { data, error } = await this.supabase.rpc("iq_v21_grant_game_capture_delegation", {
      p_game_id: requireUuid(gameId, "gameId"),
      p_delegate_email: normalizedEmail,
      p_capabilities: normalizedCapabilities,
      p_valid_until: validUntil,
      p_valid_from: validFrom || null,
      p_note: note ? String(note).trim().slice(0, 1000) : null
    });
    if (error) throw rpcError(error, "No se pudo conceder la delegación.");
    return Array.isArray(data) ? data : [];
  }

  async revoke({ delegationId, reason = null }) {
    this._requireClient();
    const { data, error } = await this.supabase.rpc("iq_v21_revoke_game_capture_delegation", {
      p_delegation_id: requireUuid(delegationId, "delegationId"),
      p_reason: reason ? String(reason).trim().slice(0, 1000) : null
    });
    if (error) throw rpcError(error, "No se pudo revocar la delegación.");
    return Array.isArray(data) ? data : [];
  }

  async saveCapture({
    gameId,
    teamScore = null,
    opponentScore = null,
    starterIds = null,
    stats = null,
    periods = null,
    events = null,
    leaseToken = null,
    clientOperationId = null,
    baseRevision = null
  }) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const normalizedStarters = Array.isArray(starterIds)
      ? starterIds.map(playerId => requireUuid(playerId, "starterId"))
      : null;
    const baseArgs = {
      p_game_id: id,
      p_team_score: teamScore,
      p_opponent_score: opponentScore,
      p_starter_ids: normalizedStarters,
      p_stats: Array.isArray(stats) ? stats : null,
      p_periods: Array.isArray(periods) ? periods : null,
      p_events: Array.isArray(events) ? events : null
    };
    const token = String(
      leaseToken || this.liveSessionService.getStoredToken(id) || ""
    ).trim() || null;

    // V58 adds idempotent offline operations and optimistic capture revision.
    // Older deployments still fall back to V28/V21 without changing callers.
    if (clientOperationId) {
      const v58Rpc = "iq_v58_save_game_capture";
      const v58Result = await this.supabase.rpc(v58Rpc, {
        ...baseArgs,
        p_lease_token: token,
        p_client_operation_id: clientOperationId,
        p_base_revision: Number.isFinite(Number(baseRevision)) ? Number(baseRevision) : null
      });
      if (!v58Result.error) return v58Result.data || null;
      if (!isMissingRpc(v58Result.error, v58Rpc)) {
        throw rpcError(v58Result.error, "No se pudo sincronizar la captura offline del partido.");
      }
    }

    const v28Rpc = "iq_v28_save_game_capture";
    const v28Result = await this.supabase.rpc(v28Rpc, {
      ...baseArgs,
      p_lease_token: token
    });

    if (!v28Result.error) return v28Result.data || null;
    if (!isMissingRpc(v28Result.error, v28Rpc)) {
      throw rpcError(v28Result.error, "No se pudo guardar la captura del partido.");
    }

    const { data, error } = await this.supabase.rpc("iq_v21_save_game_capture", baseArgs);
    if (error) throw rpcError(error, "No se pudo guardar la captura del partido.");
    return data || null;
  }
  async editEvent({ gameId, eventId, newPlayerId = null, newActionType, reason = null } = {}) {
    this._requireClient();
    const normalizedAction = String(newActionType || "").trim().toLowerCase();
    if (!normalizedAction) throw new Error("Selecciona un tipo de jugada.");
    const { data, error } = await this.supabase.rpc("iq_v59_edit_game_event", {
      p_game_id: requireUuid(gameId, "gameId"),
      p_event_id: requireUuid(eventId, "eventId"),
      p_new_player_id: newPlayerId ? requireUuid(newPlayerId, "newPlayerId") : null,
      p_new_action_type: normalizedAction,
      p_reason: reason ? String(reason).trim().slice(0, 500) : null
    });
    if (error) throw rpcError(error, "No se pudo editar la jugada.");
    return data || null;
  }

  async reassignEventPlayer({ gameId, eventId, newPlayerId, reason = null } = {}) {
    this._requireClient();
    const { data, error } = await this.supabase.rpc("iq_v58_reassign_game_event_player", {
      p_game_id: requireUuid(gameId, "gameId"),
      p_event_id: requireUuid(eventId, "eventId"),
      p_new_player_id: requireUuid(newPlayerId, "newPlayerId"),
      p_reason: reason ? String(reason).trim().slice(0, 500) : null
    });
    if (error) throw rpcError(error, "No se pudo cambiar el jugador de la jugada.");
    return data || null;
  }

  async getCaptureSyncStatus(gameId) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const rpc = "iq_v58_game_capture_sync_status";
    const { data, error } = await this.supabase.rpc(rpc, { p_game_id: id });
    if (error) {
      if (isMissingRpc(error, rpc)) return { capture_revision: null, legacy: true };
      throw rpcError(error, "No se pudo consultar la revisión de sincronización.");
    }
    return data || { capture_revision: 0 };
  }

}

export default GameCaptureDelegationService;
