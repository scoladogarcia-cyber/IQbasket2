/**
 * @fileoverview V43 extension of the authoritative live-game lease client.
 * @description Adds explicit same-user recovery when Safari loses the tab-scoped
 * token. Recovery is server-authoritative and rotates the previous token, so a
 * second tab never becomes a concurrent writer.
 */

import { GameLiveSessionService } from "./GameLiveSessionService.js";

function requireGameId(value) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("GameLiveSessionV43Service: gameId inválido.");
  }
  return text;
}

function recoveryError(error) {
  const raw = String(error?.message || "");
  if (raw.includes("GAME_LIVE_LEASE_RECOVERY_NOT_MINE")) {
    return new Error("Este turno pertenece a otro usuario autorizado.");
  }
  if (raw.includes("GAME_LIVE_LEASE_STATE_INVALID")) {
    return new Error("El turno sólo puede recuperarse con el partido preparado o en vivo.");
  }
  if (raw.includes("GAME_LIVE_LEASE_RECOVERY_DENIED")) {
    return new Error("No tienes permiso para recuperar este turno de escritura.");
  }
  return new Error(raw || "No se pudo recuperar tu turno de escritura.");
}

export class GameLiveSessionV43Service extends GameLiveSessionService {
  async recoverOwn({ gameId }) {
    this._requireClient();
    const id = requireGameId(gameId);
    const rpcName = "iq_v43_recover_own_game_live_session";
    const { data, error } = await this.supabase.rpc(rpcName, { p_game_id: id });
    if (error) throw recoveryError(error);

    const result = { supported: true, ...(data || {}) };
    if (!result.lease_token) {
      throw new Error("El servidor no devolvió un nuevo token de escritura.");
    }
    this.storeToken(id, result.lease_token);
    return result;
  }
}

export default GameLiveSessionV43Service;
