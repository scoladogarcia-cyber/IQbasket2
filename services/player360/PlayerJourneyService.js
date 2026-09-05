/**
 * @fileoverview Thin client for the player-only micro-challenge boundary.
 * @description The browser never reads or writes journey tables directly.
 * Backend RPCs remain authoritative for self-scope, weekly limits and lifecycle.
 */

function requiredUuid(value, label) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`PlayerJourneyService: ${label} inválido.`);
  }
  return text;
}

export class PlayerJourneyService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  _assertReady() {
    if (!this.supabase?.rpc) throw new Error("PlayerJourneyService: backend no disponible.");
  }

  async snapshot({ teamSeasonId, playerId }) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v12_player_journey_snapshot", {
      p_team_season_id: requiredUuid(teamSeasonId, "teamSeasonId"),
      p_player_id: requiredUuid(playerId, "playerId")
    });
    if (error) throw new Error(error.message || "No se pudo cargar Mi camino.");
    return data || {};
  }

  async start({ teamSeasonId, playerId, challengeCode }) {
    this._assertReady();
    const code = String(challengeCode || "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) {
      throw new Error("PlayerJourneyService: challengeCode inválido.");
    }
    const { data, error } = await this.supabase.rpc("iq_v12_player_journey_start", {
      p_team_season_id: requiredUuid(teamSeasonId, "teamSeasonId"),
      p_player_id: requiredUuid(playerId, "playerId"),
      p_challenge_code: code
    });
    if (error) throw new Error(error.message || "No se pudo iniciar el micro-reto.");
    return data || {};
  }

  async complete(challengeId) {
    this._assertReady();
    const { data, error } = await this.supabase.rpc("iq_v12_player_journey_complete", {
      p_challenge_id: requiredUuid(challengeId, "challengeId")
    });
    if (error) throw new Error(error.message || "No se pudo completar el micro-reto.");
    return data || {};
  }
}

export default PlayerJourneyService;
