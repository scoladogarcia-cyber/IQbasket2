/**
 * @fileoverview Client boundary for the authoritative V28 live-game writer lease.
 * @description Owns RPC calls and tab-scoped lease-token storage. Authorization
 * remains entirely server-side; sessionStorage only preserves the current tab's
 * opaque token across route re-renders/reloads.
 */

const TOKEN_KEY_PREFIX = "iqbasket.gameLiveLease.";

function requireUuid(value, label) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`GameLiveSessionService: ${label} inválido.`);
  }
  return text;
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

function userMessage(error, fallback) {
  const raw = String(error?.message || "");
  if (raw.includes("GAME_LIVE_LEASE_HELD")) {
    return new Error("Otro usuario ya tiene el turno de escritura de este partido en vivo.");
  }
  if (raw.includes("GAME_LIVE_LEASE_REQUIRED") || raw.includes("GAME_LIVE_LEASE_INVALID") || raw.includes("GAME_LIVE_LEASE_NOT_HELD")) {
    return new Error("Tu turno de escritura en vivo ya no es válido. Vuelve a adquirirlo o acepta un handoff.");
  }
  if (raw.includes("GAME_LIVE_LEASE_FORCE_DENIED")) {
    return new Error("No tienes permiso para forzar la toma del turno de escritura.");
  }
  if (raw.includes("GAME_LIVE_HANDOFF_INVALID_OR_EXPIRED")) {
    return new Error("El código de traspaso no es válido o ya ha caducado.");
  }
  if (raw.includes("GAME_LIVE_HANDOFF_SELF_NOT_ALLOWED")) {
    return new Error("El traspaso debe aceptarlo otro usuario autorizado.");
  }
  if (raw.includes("GAME_LIVE_LEASE_STATE_INVALID")) {
    return new Error("El turno de escritura sólo puede adquirirse cuando el partido está preparado o en vivo.");
  }
  return new Error(raw || fallback);
}

function sessionStorageSafe() {
  try {
    return globalThis?.sessionStorage || null;
  } catch {
    return null;
  }
}

export class GameLiveSessionService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _requireClient() {
    if (!this.supabase?.rpc) {
      throw new Error("GameLiveSessionService: backend no disponible.");
    }
  }

  _tokenKey(gameId) {
    return `${TOKEN_KEY_PREFIX}${requireUuid(gameId, "gameId")}`;
  }

  getStoredToken(gameId) {
    const storage = sessionStorageSafe();
    if (!storage) return null;
    try {
      return storage.getItem(this._tokenKey(gameId)) || null;
    } catch {
      return null;
    }
  }

  storeToken(gameId, token) {
    const normalized = String(token || "").trim();
    if (!normalized) return;
    const storage = sessionStorageSafe();
    if (!storage) return;
    try {
      storage.setItem(this._tokenKey(gameId), normalized);
    } catch {
      // Storage is a convenience only. Backend ownership remains authoritative.
    }
  }

  clearToken(gameId) {
    const storage = sessionStorageSafe();
    if (!storage) return;
    try {
      storage.removeItem(this._tokenKey(gameId));
    } catch {
      // Ignore unavailable/blocked storage.
    }
  }

  async getStatus(gameId) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const rpcName = "iq_v28_game_live_session_status";
    const { data, error } = await this.supabase.rpc(rpcName, { p_game_id: id });
    if (error) {
      if (isMissingRpc(error, rpcName)) return { supported: false, game_id: id, active: false };
      throw userMessage(error, "No se pudo consultar el turno de escritura en vivo.");
    }
    return { supported: true, ...(data || {}) };
  }

  async acquire({ gameId, force = false }) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const rpcName = "iq_v28_acquire_game_live_session";
    const { data, error } = await this.supabase.rpc(rpcName, {
      p_game_id: id,
      p_force: Boolean(force)
    });
    if (error) {
      if (isMissingRpc(error, rpcName)) return { supported: false, game_id: id, active: false };
      throw userMessage(error, "No se pudo adquirir el turno de escritura en vivo.");
    }
    const result = { supported: true, ...(data || {}) };
    if (result.lease_token) this.storeToken(id, result.lease_token);
    return result;
  }

  async heartbeat({ gameId, leaseToken = null }) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const token = String(leaseToken || this.getStoredToken(id) || "").trim();
    if (!token) throw new Error("No hay un turno de escritura activo en esta pestaña.");
    const rpcName = "iq_v28_heartbeat_game_live_session";
    const { data, error } = await this.supabase.rpc(rpcName, {
      p_game_id: id,
      p_lease_token: token
    });
    if (error) {
      if (isMissingRpc(error, rpcName)) return { supported: false, game_id: id, active: false };
      this.clearToken(id);
      throw userMessage(error, "No se pudo renovar el turno de escritura en vivo.");
    }
    return { supported: true, lease_token: token, ...(data || {}) };
  }

  async release({ gameId, leaseToken = null, reason = null }) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const token = String(leaseToken || this.getStoredToken(id) || "").trim();
    if (!token) return { supported: true, game_id: id, active: false, released: false };
    const rpcName = "iq_v28_release_game_live_session";
    const { data, error } = await this.supabase.rpc(rpcName, {
      p_game_id: id,
      p_lease_token: token,
      p_reason: reason ? String(reason).trim().slice(0, 500) : null
    });
    if (error) {
      if (isMissingRpc(error, rpcName)) {
        this.clearToken(id);
        return { supported: false, game_id: id, active: false };
      }
      throw userMessage(error, "No se pudo liberar el turno de escritura en vivo.");
    }
    this.clearToken(id);
    return { supported: true, ...(data || {}) };
  }

  async createHandoff({ gameId, leaseToken = null }) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const token = String(leaseToken || this.getStoredToken(id) || "").trim();
    if (!token) throw new Error("No puedes transferir un turno de escritura que no posees.");
    const rpcName = "iq_v28_create_game_live_handoff";
    const { data, error } = await this.supabase.rpc(rpcName, {
      p_game_id: id,
      p_lease_token: token
    });
    if (error) {
      if (isMissingRpc(error, rpcName)) return { supported: false, game_id: id };
      throw userMessage(error, "No se pudo crear el traspaso del turno de escritura.");
    }
    return { supported: true, ...(data || {}) };
  }

  async acceptHandoff({ gameId, handoffToken }) {
    this._requireClient();
    const id = requireUuid(gameId, "gameId");
    const token = String(handoffToken || "").trim();
    if (!token) throw new Error("Introduce un código de traspaso válido.");
    const rpcName = "iq_v28_accept_game_live_handoff";
    const { data, error } = await this.supabase.rpc(rpcName, {
      p_game_id: id,
      p_handoff_token: token
    });
    if (error) {
      if (isMissingRpc(error, rpcName)) return { supported: false, game_id: id };
      throw userMessage(error, "No se pudo aceptar el traspaso del turno de escritura.");
    }
    const result = { supported: true, ...(data || {}) };
    if (result.lease_token) this.storeToken(id, result.lease_token);
    return result;
  }
}

export default GameLiveSessionService;
