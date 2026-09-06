/**
 * @fileoverview RPC boundary for per-game capture delegation.
 * @description Keeps delegation, minimal game snapshots and scoped capture writes
 * behind V21 RPCs. The browser never reads delegation/audit tables directly.
 */

import { Permission } from "../../security/permissions.js";

export const DELEGATABLE_GAME_PERMISSIONS = Object.freeze([
  Permission.RECORD_LIVE_GAME,
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
  return new Error(error?.message || fallback);
}

export class GameCaptureDelegationService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
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
    const { data, error } = await this.supabase.rpc("iq_v21_game_capture_snapshot", {
      p_game_id: requireUuid(gameId, "gameId")
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
    events = null
  }) {
    this._requireClient();
    const { data, error } = await this.supabase.rpc("iq_v21_save_game_capture", {
      p_game_id: requireUuid(gameId, "gameId"),
      p_team_score: teamScore,
      p_opponent_score: opponentScore,
      p_starter_ids: Array.isArray(starterIds) ? starterIds.map(id => requireUuid(id, "starterId")) : null,
      p_stats: Array.isArray(stats) ? stats : null,
      p_periods: Array.isArray(periods) ? periods : null,
      p_events: Array.isArray(events) ? events : null
    });
    if (error) throw rpcError(error, "No se pudo guardar la captura del partido.");
    return data || null;
  }
}

export default GameCaptureDelegationService;
