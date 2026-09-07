/**
 * @fileoverview Staff-facing Family onboarding boundary.
 * @description Keeps trainer invitation creation and administrative Family lookup
 * behind dedicated RPCs. Direct guardian assignment remains delegated to the
 * existing V26 FamilyProfileAdminService.
 */

function clientOf(candidate) {
  return candidate?.supabase || candidate?.default || candidate || null;
}

function required(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

export class FamilyStaffService {
  constructor(supabaseClient = null) {
    this.supabase = clientOf(supabaseClient);
  }

  _client() {
    if (!this.supabase) throw new Error("Backend no disponible para gestionar familias.");
    return this.supabase;
  }

  /**
   * Creates a short-lived, player-scoped invitation code.
   * Backend V29 validates team-season role, active roster membership and email.
   */
  async createInvitation({ teamSeasonId, playerId, email, expiresHours = 168 }) {
    const { data, error } = await this._client().rpc("iq_v29_create_family_link_invitation", {
      p_team_season_id: required(teamSeasonId, "Equipo-temporada"),
      p_player_id: required(playerId, "Jugador"),
      p_invite_email: required(email, "Email de la familia"),
      p_expires_hours: Number(expiresHours || 168)
    });
    if (error) throw new Error(error.message || "No se pudo crear la invitación Family.");
    return data || {};
  }

  /**
   * Resolves an existing Family account for direct Admin/Superadmin assignment.
   * The RPC intentionally returns only identity fields needed by this workflow.
   */
  async findFamilyProfile({ teamSeasonId, email }) {
    const { data, error } = await this._client().rpc("iq_v29_find_family_profile", {
      p_team_season_id: required(teamSeasonId, "Equipo-temporada"),
      p_email: required(email, "Email de la familia")
    });
    if (error) throw new Error(error.message || "No se pudo localizar la cuenta Family.");
    return data || null;
  }
}

export default FamilyStaffService;