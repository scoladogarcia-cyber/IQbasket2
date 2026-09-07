/**
 * @fileoverview Privacy-safe team/comparison boundary for Family users.
 * @description The backend masks other-player identity before data reaches the browser.
 */
function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

export class FamilyTeamSnapshotService {
  constructor(supabaseClient = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async getSnapshot({ playerId, teamSeasonId = null }) {
    if (!this.supabase?.rpc) throw new Error("Backend no disponible para la vista de equipo Family.");
    const { data, error } = await this.supabase.rpc("iq_v30_family_team_snapshot", {
      p_player_id: required(playerId, "Jugador"),
      p_team_season_id: teamSeasonId || null
    });
    if (error) throw new Error(error.message || "No se pudo cargar el equipo.");
    return data || null;
  }
}

export default FamilyTeamSnapshotService;
