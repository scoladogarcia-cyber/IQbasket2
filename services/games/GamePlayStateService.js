/**
 * @fileoverview Thin RPC client for canonical game sporting lifecycle.
 * @description Keeps transition authorization/audit on the backend.
 */

function uuid(value, label) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`GamePlayStateService: ${label} inválido.`);
  }
  return text;
}

export class GamePlayStateService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _ready() {
    if (!this.supabase?.rpc) throw new Error("GamePlayStateService: backend no disponible.");
  }

  async snapshot(gameId) {
    this._ready();
    const { data, error } = await this.supabase.rpc("iq_v13_game_play_state_snapshot", {
      p_game_id: uuid(gameId, "gameId")
    });
    if (error) throw new Error(error.message || "No se pudo leer el estado del partido.");
    return data || {};
  }

  async transition({ gameId, targetState, reason = null }) {
    this._ready();
    const target = String(targetState || "").trim().toUpperCase();
    if (!/^(SCHEDULED|READY|LIVE|FINISHED|CANCELLED)$/.test(target)) {
      throw new Error("GamePlayStateService: estado destino inválido.");
    }
    const { data, error } = await this.supabase.rpc("iq_v13_set_game_play_state", {
      p_game_id: uuid(gameId, "gameId"),
      p_target_state: target,
      p_reason: reason ? String(reason).trim() : null
    });
    if (error) throw new Error(error.message || "No se pudo cambiar el estado del partido.");
    return data || {};
  }
}

export default GamePlayStateService;
