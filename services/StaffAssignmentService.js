/**
 * @fileoverview Servicio de asignaciones temporales de staff.
 * @description Gestiona roles de staff por temporada sin acoplarlos a teams/clubs.
 */

export const StaffRole = Object.freeze({
  HEAD_COACH: "HEAD_COACH",
  COORDINATOR: "COORDINATOR",
  ASSISTANT_COACH: "ASSISTANT_COACH",
  PHYSICAL_TRAINER: "PHYSICAL_TRAINER",
  TEAM_MANAGER: "TEAM_MANAGER",
  SPORTS_DIRECTOR: "SPORTS_DIRECTOR"
});

export class StaffAssignmentService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async upsertAssignment({
    clubId = null,
    teamId = null,
    seasonName,
    role,
    staffName,
    userProfileId = null
  }) {
    if (!this.supabase) throw new Error("Supabase no configurado.");
    if (!seasonName || !role) throw new Error("Temporada y rol son obligatorios.");
    if (!clubId && !teamId) throw new Error("Debe especificarse club o equipo.");

    const payload = {
      club_id: clubId || null,
      team_id: teamId || null,
      season_name: String(seasonName).trim(),
      staff_role: role,
      staff_name: String(staffName || "").trim() || null,
      user_profile_id: userProfileId || null
    };

    const { data, error } = await this.supabase
      .from("staff_assignments")
      .upsert(payload, {
        onConflict: "scope_key,season_name,staff_role"
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeAssignment({ clubId = null, teamId = null, seasonName, role }) {
    if (!this.supabase) throw new Error("Supabase no configurado.");
    let query = this.supabase
      .from("staff_assignments")
      .delete()
      .eq("season_name", String(seasonName).trim())
      .eq("staff_role", role);

    query = teamId ? query.eq("team_id", teamId) : query.eq("club_id", clubId).is("team_id", null);
    const { error } = await query;
    if (error) throw error;
    return true;
  }
}

export default StaffAssignmentService;
