/**
 * @fileoverview V30 staff boundary for Family/player relationships.
 * @description Invitations, inherited active links and revocation remain behind scoped RPCs.
 */
function clientOf(candidate) {
  return candidate?.supabase || candidate?.default || candidate || null;
}

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

export class FamilyStaffV30Service {
  constructor(supabaseClient = null) {
    this.supabase = clientOf(supabaseClient);
  }

  _client() {
    if (!this.supabase?.rpc) throw new Error("Backend no disponible para Familias.");
    return this.supabase;
  }

  async createInvitation({ teamSeasonId, playerId, email, relationshipDuration = "INDEFINITE" }) {
    const { data, error } = await this._client().rpc("iq_v30_create_family_link_invitation", {
      p_team_season_id: required(teamSeasonId, "Equipo-temporada"),
      p_player_id: required(playerId, "Jugador"),
      p_invite_email: required(email, "Email").toLowerCase(),
      p_relationship_duration: relationshipDuration || "INDEFINITE",
      p_code_expires_hours: 168
    });
    if (error) throw new Error(error.message || "No se pudo crear la invitación.");
    return data || {};
  }

  async listLinks(teamSeasonId) {
    const { data, error } = await this._client().rpc("iq_v30_list_team_family_links", {
      p_team_season_id: required(teamSeasonId, "Equipo-temporada")
    });
    if (error) throw new Error(error.message || "No se pudieron cargar los vínculos familiares.");
    return Array.isArray(data) ? data : [];
  }

  async revokeLink({ teamSeasonId, relationshipId, reason = null }) {
    const { data, error } = await this._client().rpc("iq_v30_revoke_family_link", {
      p_team_season_id: required(teamSeasonId, "Equipo-temporada"),
      p_relationship_id: required(relationshipId, "Vínculo"),
      p_reason: reason ? String(reason).trim().slice(0, 1000) : null
    });
    if (error) throw new Error(error.message || "No se pudo revocar el vínculo.");
    return data || {};
  }

  async findFamilyProfile({ teamSeasonId, email }) {
    const { data, error } = await this._client().rpc("iq_v29_find_family_profile", {
      p_team_season_id: required(teamSeasonId, "Equipo-temporada"),
      p_email: required(email, "Email").toLowerCase()
    });
    if (error) throw new Error(error.message || "No se pudo localizar la cuenta Family.");
    return data || null;
  }
}

export default FamilyStaffV30Service;
