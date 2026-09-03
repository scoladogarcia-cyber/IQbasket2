/**
 * @fileoverview Compatibilidad de responsables deportivos contra el esquema Supabase real.
 *
 * El esquema auditado NO contiene `staff_assignments`.
 * Hasta que el modelo v3 esté migrado:
 * - HEAD_COACH se persiste en `seasons.coach_name` (por equipo + temporada).
 * - COORDINATOR se persiste en `clubs.coordinator_name` (ámbito de club actual).
 * - El resto de funciones se reservarán para memberships v3.
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
    staffName
  }) {
    if (!this.supabase) throw new Error("Supabase no configurado.");

    const normalizedRole = String(role || "").toUpperCase();
    const normalizedName = String(staffName || "").trim() || null;

    if (normalizedRole === StaffRole.HEAD_COACH) {
      if (!teamId || !seasonName) {
        throw new Error("Equipo y temporada son obligatorios para asignar entrenador.");
      }

      const { data: season, error: seasonError } = await this.supabase
        .from("seasons")
        .select("id,team_id,name,coach_name")
        .eq("team_id", teamId)
        .eq("name", String(seasonName).trim())
        .maybeSingle();

      if (seasonError) throw seasonError;
      if (!season) throw new Error("No se ha encontrado la temporada del equipo.");

      const { data, error } = await this.supabase
        .from("seasons")
        .update({ coach_name: normalizedName })
        .eq("id", season.id)
        .select("id,team_id,name,coach_name")
        .single();

      if (error) throw error;

      return {
        id: data.id,
        team_id: data.team_id,
        club_id: null,
        season_name: data.name,
        staff_role: StaffRole.HEAD_COACH,
        staff_name: data.coach_name
      };
    }

    if (normalizedRole === StaffRole.COORDINATOR) {
      if (!clubId) {
        throw new Error("Club obligatorio para asignar coordinador.");
      }

      const { data, error } = await this.supabase
        .from("clubs")
        .update({ coordinator_name: normalizedName })
        .eq("id", clubId)
        .select("id,coordinator_name")
        .single();

      if (error) throw error;

      return {
        id: `coordinator:${data.id}`,
        club_id: data.id,
        team_id: null,
        season_name: String(seasonName || ""),
        staff_role: StaffRole.COORDINATOR,
        staff_name: data.coordinator_name
      };
    }

    throw new Error(
      "Esta función de staff requiere el modelo v3 por equipo-temporada y todavía no se guarda en producción."
    );
  }

  async removeAssignment({ clubId = null, teamId = null, seasonName, role }) {
    if (!this.supabase) throw new Error("Supabase no configurado.");

    const normalizedRole = String(role || "").toUpperCase();

    if (normalizedRole === StaffRole.HEAD_COACH) {
      if (!teamId || !seasonName) return false;

      const { error } = await this.supabase
        .from("seasons")
        .update({ coach_name: null })
        .eq("team_id", teamId)
        .eq("name", String(seasonName).trim());

      if (error) throw error;
      return true;
    }

    if (normalizedRole === StaffRole.COORDINATOR) {
      if (!clubId) return false;

      const { error } = await this.supabase
        .from("clubs")
        .update({ coordinator_name: null })
        .eq("id", clubId);

      if (error) throw error;
      return true;
    }

    throw new Error("La eliminación de esta función se habilitará con memberships v3.");
  }
}

export default StaffAssignmentService;
