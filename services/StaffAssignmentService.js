/**
 * @fileoverview Adaptador de responsables deportivos contra el modelo v3 canónico.
 *
 * - HEAD_COACH usa team_season_staff_assignments y RPCs v3.
 * - COORDINATOR mantiene temporalmente clubs.coordinator_name.
 * - No se vuelve a escribir seasons.coach_name.
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
  constructor(supabaseClient, contextStore = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.contextStore = contextStore || null;
  }

  _normalizeSeasonName(value = "") {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})\s*[-\/]\s*(\d{4})$/);
    return match ? match[1] + "/" + match[2] : raw;
  }

  async _resolveTeamSeason({ teamId, seasonName }) {
    if (!teamId || !seasonName) {
      throw new Error("Equipo y temporada son obligatorios para resolver el staff.");
    }

    const normalizedSeasonName = this._normalizeSeasonName(seasonName);
    const contexts = this.contextStore?.getSeasons?.(teamId) || [];
    const localMatch = contexts.find((context) => {
      const label = this._normalizeSeasonName(context?.name || context?.code || "");
      return label === normalizedSeasonName;
    });

    if (localMatch) {
      const teamSeasonId = localMatch.team_season_id
        || localMatch.teamSeasonId
        || (localMatch.source === "v3" ? localMatch.id : null);

      if (teamSeasonId) {
        return {
          teamSeasonId: String(teamSeasonId),
          seasonName: normalizedSeasonName
        };
      }
    }

    const { data: catalogRows, error: catalogError } = await this.supabase
      .from("season_catalog")
      .select("id,name,code");

    if (catalogError) throw catalogError;

    const globalSeason = (catalogRows || []).find((row) => {
      const name = this._normalizeSeasonName(row.name || "");
      const code = this._normalizeSeasonName(String(row.code || "").replaceAll("_", "/"));
      return name === normalizedSeasonName || code === normalizedSeasonName;
    });

    if (!globalSeason) {
      throw new Error("No se ha encontrado la temporada global " + normalizedSeasonName + ".");
    }

    const { data: teamSeason, error: teamSeasonError } = await this.supabase
      .from("team_seasons")
      .select("id,team_id,season_id,status")
      .eq("team_id", teamId)
      .eq("season_id", globalSeason.id)
      .maybeSingle();

    if (teamSeasonError) throw teamSeasonError;
    if (!teamSeason) {
      throw new Error("El equipo no está vinculado a la temporada seleccionada.");
    }

    return {
      teamSeasonId: String(teamSeason.id),
      seasonName: this._normalizeSeasonName(globalSeason.name || normalizedSeasonName)
    };
  }

  async _findActiveAssignment(teamSeasonId, staffRole) {
    const { data, error } = await this.supabase
      .from("team_season_staff_assignments")
      .select("id,team_season_id,staff_role,user_id,external_name,status")
      .eq("team_season_id", teamSeasonId)
      .eq("staff_role", String(staffRole || "").toUpperCase())
      .eq("status", "ACTIVE");

    if (error) throw error;
    return (data || [])[0] || null;
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
      const scope = await this._resolveTeamSeason({ teamId, seasonName });
      const current = await this._findActiveAssignment(
        scope.teamSeasonId,
        StaffRole.HEAD_COACH
      );

      if (!normalizedName) {
        if (current?.id) {
          const { error } = await this.supabase.rpc(
            "iq_v3_remove_team_season_staff",
            { p_assignment_id: current.id }
          );
          if (error) throw error;
        }

        return {
          id: current?.id || ("head-coach:" + scope.teamSeasonId),
          team_season_id: scope.teamSeasonId,
          team_id: String(teamId),
          club_id: clubId,
          season_name: scope.seasonName,
          staff_role: StaffRole.HEAD_COACH,
          staff_name: "",
          external_name: null,
          status: "INACTIVE",
          removed: true
        };
      }

      const { data, error } = await this.supabase.rpc(
        "iq_v3_assign_team_season_staff",
        {
          p_team_season_id: scope.teamSeasonId,
          p_staff_role: StaffRole.HEAD_COACH,
          p_user_id: null,
          p_external_name: normalizedName
        }
      );

      if (error) throw error;

      return {
        ...(data || {}),
        id: data?.id || current?.id || ("head-coach:" + scope.teamSeasonId),
        team_season_id: scope.teamSeasonId,
        team_id: String(teamId),
        club_id: clubId,
        season_name: scope.seasonName,
        staff_role: StaffRole.HEAD_COACH,
        staff_name: normalizedName,
        external_name: normalizedName,
        status: data?.status || "ACTIVE"
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

      const scope = await this._resolveTeamSeason({ teamId, seasonName });
      const current = await this._findActiveAssignment(
        scope.teamSeasonId,
        StaffRole.HEAD_COACH
      );

      if (!current?.id) return true;

      const { error } = await this.supabase.rpc(
        "iq_v3_remove_team_season_staff",
        { p_assignment_id: current.id }
      );

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
