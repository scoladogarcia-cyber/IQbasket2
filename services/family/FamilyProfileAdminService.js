/**
 * @fileoverview Administrative boundary for Family profile configuration.
 * @description Reads through V26 and progressively saves through V34 so every
 * verified linked child receives the basic Family Free baseline. Direct table
 * reads/writes remain forbidden here.
 */

function clientOf(candidate) {
  return candidate?.supabase || candidate?.default || candidate || null;
}

function assertUuidish(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

function normalizeConfig(data = {}) {
  return {
    userId: data.user_id || data.userId || null,
    teamSeasonId: data.team_season_id || data.teamSeasonId || null,
    playerIds: Array.isArray(data.player_ids) ? data.player_ids.map(String) : [],
    showOtherPlayerNames: data.show_other_player_names !== false,
    showOtherPlayerJerseys: data.show_other_player_jerseys !== false
  };
}

function missingRpc(error, rpcName) {
  const message = String(error?.message || "");
  return error?.code === "PGRST202" || message.includes(rpcName);
}

export class FamilyProfileAdminService {
  constructor(supabaseClient = null) {
    this.supabase = clientOf(supabaseClient);
  }

  _client() {
    if (!this.supabase) throw new Error("Backend no disponible para gestionar el perfil Family.");
    return this.supabase;
  }

  async getConfig({ userId, teamSeasonId }) {
    const client = this._client();
    const { data, error } = await client.rpc("iq_v26_get_family_profile_config", {
      p_user_id: assertUuidish(userId, "Usuario Family"),
      p_team_season_id: assertUuidish(teamSeasonId, "Equipo-temporada")
    });
    if (error) throw new Error(error.message || "No se pudo cargar el perfil Family.");
    return normalizeConfig(data || {});
  }

  async saveConfig({
    userId,
    teamSeasonId,
    playerIds = [],
    showOtherPlayerNames = true,
    showOtherPlayerJerseys = true
  }) {
    const client = this._client();
    const params = {
      p_user_id: assertUuidish(userId, "Usuario Family"),
      p_team_season_id: assertUuidish(teamSeasonId, "Equipo-temporada"),
      p_player_ids: [...new Set((playerIds || []).filter(Boolean).map(String))],
      p_show_other_player_names: Boolean(showOtherPlayerNames),
      p_show_other_player_jerseys: Boolean(showOtherPlayerJerseys)
    };

    let response = await client.rpc("iq_v34_save_family_profile_config", params);
    if (response.error && missingRpc(response.error, "iq_v34_save_family_profile_config")) {
      response = await client.rpc("iq_v26_save_family_profile_config", params);
    }
    if (response.error) throw new Error(response.error.message || "No se pudo guardar el perfil Family.");
    return normalizeConfig(response.data || {});
  }
}

export default FamilyProfileAdminService;
