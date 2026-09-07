/**
 * Backend boundary for JUGADOR teammate identity presentation preferences.
 */
function clientOf(candidate) {
  return candidate?.supabase || candidate?.default || candidate || null;
}

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

function normalize(data = {}) {
  return {
    userId: data.user_id || null,
    email: data.email || null,
    teamSeasonId: data.team_season_id || null,
    linkedPlayerId: data.linked_player_id || null,
    showOtherPlayerNames: data.show_other_player_names !== false,
    showOtherPlayerJerseys: data.show_other_player_jerseys !== false
  };
}

export class PlayerIdentityPreferenceService {
  constructor(supabaseClient = null) {
    this.supabase = clientOf(supabaseClient);
  }

  _client() {
    if (!this.supabase?.rpc) throw new Error("Backend no disponible para preferencias de Jugador.");
    return this.supabase;
  }

  async getAdminConfig({ email, teamSeasonId }) {
    const { data, error } = await this._client().rpc("iq_v34_get_player_profile_config", {
      p_email: required(email, "Email del jugador"),
      p_team_season_id: required(teamSeasonId, "Equipo-temporada")
    });
    if (error) throw new Error(error.message || "No se pudo cargar la configuración del jugador.");
    return normalize(data || {});
  }

  async saveAdminConfig({ email, teamSeasonId, showOtherPlayerNames, showOtherPlayerJerseys }) {
    const { data, error } = await this._client().rpc("iq_v34_save_player_profile_config", {
      p_email: required(email, "Email del jugador"),
      p_team_season_id: required(teamSeasonId, "Equipo-temporada"),
      p_show_other_player_names: Boolean(showOtherPlayerNames),
      p_show_other_player_jerseys: Boolean(showOtherPlayerJerseys)
    });
    if (error) throw new Error(error.message || "No se pudo guardar la configuración del jugador.");
    return normalize(data || {});
  }

  async getMyConfig({ teamSeasonId = null } = {}) {
    const { data, error } = await this._client().rpc("iq_v34_my_player_identity_preferences", {
      p_team_season_id: teamSeasonId || null
    });
    if (error) throw error;
    return normalize(data || {});
  }
}

export default PlayerIdentityPreferenceService;
