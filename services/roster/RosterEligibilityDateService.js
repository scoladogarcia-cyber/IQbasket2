/**
 * @fileoverview Boundary for correcting one season-specific roster eligibility start.
 * The backend RPC owns authorization, season bounds and historical safety checks.
 */
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export class RosterEligibilityDateService {
  constructor(client) {
    this.client = client?.supabase || client?.default || client;
  }

  /** @returns {Promise<object>} Updated membership; raises on permission or validation failure. */
  async updateStart({ teamSeasonId, playerId, newStart }) {
    if (!this.client) throw new Error("No hay conexión con la base de datos.");
    if (!teamSeasonId || !playerId || !validDate(newStart)) {
      throw new Error("Selecciona un jugador, su temporada y una fecha válida.");
    }
    const { data, error } = await this.client.rpc("iq_v3_update_roster_start", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_new_start: newStart
    });
    if (error) throw error;
    if (!data?.id) throw new Error("El servidor no confirmó el cambio de elegibilidad.");
    return data;
  }
}

export default RosterEligibilityDateService;
