/**
 * @fileoverview Narrow persistence boundary for game-minute recovery.
 * @description Never writes normal box-score fields or play-by-play. All writes
 * go through the V63 SECURITY DEFINER RPC, which revalidates authorization,
 * game state and the 5-player team-minute invariant.
 */
import { expectedTeamMinutes, validateDirectMinutes, buildMinutesFromSegments } from "../../domain/games/GameMinutesRecovery.js";

const requireGameId = gameId => {
  const id = String(gameId || "").trim();
  if (!id) throw new Error("GameMinutesRecoveryService: gameId obligatorio.");
  return id;
};

export class GameMinutesRecoveryService {
  constructor(supabase) {
    this.supabase = supabase?.supabase || supabase?.default || supabase;
  }

  _requireClient() {
    if (!this.supabase?.rpc) throw new Error("No hay conexión disponible para recuperar el minutaje.");
  }

  async saveDirect({ game, entries, note = null } = {}) {
    this._requireClient();
    const gameId = requireGameId(game?.id);
    const validation = validateDirectMinutes(entries, game);
    if (!validation.valid) {
      const sign = validation.difference > 0 ? "faltan" : "sobran";
      throw new Error(`El total debe ser ${validation.expected} min; ${sign} ${Math.abs(validation.difference)} min.`);
    }
    const { data, error } = await this.supabase.rpc("iq_v63_save_game_minutes_recovery", {
      p_game_id: gameId,
      p_mode: "DIRECT",
      p_minutes: validation.entries,
      p_lineups: null,
      p_note: note || null
    });
    if (error) throw new Error(error.message || "No se pudo guardar el minutaje.");
    return data;
  }

  async saveSegments({ game, segments, playerIds, note = null } = {}) {
    this._requireClient();
    const gameId = requireGameId(game?.id);
    const recovery = buildMinutesFromSegments({ segments, playerIds, game });
    const { data, error } = await this.supabase.rpc("iq_v63_save_game_minutes_recovery", {
      p_game_id: gameId,
      p_mode: "LINEUPS",
      p_minutes: null,
      p_lineups: recovery.lineups,
      p_note: note || null
    });
    if (error) throw new Error(error.message || "No se pudo guardar la reconstrucción por quintetos.");
    return { ...data, clientPreview: recovery };
  }

  expected(game) {
    return expectedTeamMinutes(game);
  }
}

export default GameMinutesRecoveryService;
