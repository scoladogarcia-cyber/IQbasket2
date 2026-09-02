/**
 * @fileoverview Gestión v3 de temporadas globales, vínculos equipo-temporada y staff.
 * @description Encapsula lectura y futuras escrituras RPC para evitar que la vista
 * conozca detalles de Supabase o escriba directamente en tablas sensibles.
 */

export class SeasonManagementService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async getCapabilities() {
    if (!this.supabase) return { ready: false, reason: "NO_DATABASE" };

    const { data, error } = await this.supabase.rpc("iq_v3_season_admin_capabilities");
    if (error) {
      return { ready: false, reason: "BACKEND_NOT_APPLIED" };
    }

    return {
      ready: Boolean(data?.ready ?? data?.season_management_ready ?? false),
      ...(data || {})
    };
  }

  async loadOverview() {
    if (!this.supabase) {
      return {
        capabilities: { ready: false, reason: "NO_DATABASE" },
        seasons: [],
        teamSeasons: [],
        teams: [],
        staffAssignments: [],
        legacySeasons: [],
        usersById: new Map()
      };
    }

    const [
      capabilities,
      seasonsRes,
      teamSeasonsRes,
      teamsRes,
      legacyRes
    ] = await Promise.all([
      this.getCapabilities(),
      this.supabase
        .from("season_catalog")
        .select("id,code,name,start_date,end_date,status,is_test,created_at,updated_at")
        .order("start_date", { ascending: false }),
      this.supabase
        .from("team_seasons")
        .select("id,team_id,season_id,legacy_season_id,status,data_status,created_at,updated_at"),
      this.supabase
        .from("teams")
        .select("id,club_id,name,category,competition,coach_name"),
      this.supabase
        .from("seasons")
        .select("id,team_id,name,coach_name,start_date,end_date")
    ]);

    const firstError = [
      seasonsRes.error,
      teamSeasonsRes.error,
      teamsRes.error,
      legacyRes.error
    ].find(Boolean);

    if (firstError) throw firstError;

    // La tabla canónica de staff aparece en Fase 3A. Su ausencia no debe impedir
    // visualizar season_catalog y team_seasons ya existentes desde Fase 1.
    let staffAssignments = [];
    try {
      const staffRes = await this.supabase
        .from("team_season_staff_assignments")
        .select("id,team_season_id,staff_role,user_id,external_name,status,created_at,updated_at")
        .eq("status", "ACTIVE");

      if (staffRes.error) {
        const missingTable = /team_season_staff_assignments|does not exist|schema cache/i
          .test(String(staffRes.error.message || ""));
        if (!missingTable) throw staffRes.error;
      } else {
        staffAssignments = staffRes.data || [];
      }
    } catch (error) {
      const missingTable = /team_season_staff_assignments|does not exist|schema cache/i
        .test(String(error?.message || error || ""));
      if (!missingTable) throw error;
    }
    const userIds = [...new Set(
      staffAssignments.map(row => row.user_id).filter(Boolean).map(String)
    )];

    const usersById = new Map();
    if (userIds.length > 0) {
      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("id,email,first_name,last_name")
        .in("id", userIds);

      if (!error) {
        (data || []).forEach(user => usersById.set(String(user.id), user));
      }
    }

    return {
      capabilities,
      seasons: seasonsRes.data || [],
      teamSeasons: teamSeasonsRes.data || [],
      teams: teamsRes.data || [],
      staffAssignments,
      legacySeasons: legacyRes.data || [],
      usersById
    };
  }

  async createGlobalSeason({ code, name, startDate = null, endDate = null }) {
    const { data, error } = await this.supabase.rpc("iq_v3_create_global_season", {
      p_code: code,
      p_name: name,
      p_start_date: startDate,
      p_end_date: endDate
    });
    if (error) throw error;
    return data;
  }

  async updateGlobalSeason({ seasonId, code, name, startDate = null, endDate = null, status = "ACTIVE" }) {
    const { data, error } = await this.supabase.rpc("iq_v3_update_global_season", {
      p_season_id: seasonId,
      p_code: code,
      p_name: name,
      p_start_date: startDate,
      p_end_date: endDate,
      p_status: status
    });
    if (error) throw error;
    return data;
  }

  async linkTeamSeason({ teamId, seasonId }) {
    const { data, error } = await this.supabase.rpc("iq_v3_link_team_season", {
      p_team_id: teamId,
      p_season_id: seasonId
    });
    if (error) throw error;
    return data;
  }

  async setTeamSeasonStatus({ teamSeasonId, status }) {
    const { data, error } = await this.supabase.rpc("iq_v3_set_team_season_status", {
      p_team_season_id: teamSeasonId,
      p_status: status
    });
    if (error) throw error;
    return data;
  }

  async assignStaff({
    teamSeasonId,
    staffRole,
    userId = null,
    externalName = null
  }) {
    const { data, error } = await this.supabase.rpc("iq_v3_assign_team_season_staff", {
      p_team_season_id: teamSeasonId,
      p_staff_role: staffRole,
      p_user_id: userId,
      p_external_name: externalName
    });
    if (error) throw error;
    return data;
  }

  async removeStaff({ assignmentId }) {
    const { data, error } = await this.supabase.rpc("iq_v3_remove_team_season_staff", {
      p_assignment_id: assignmentId
    });
    if (error) throw error;
    return data;
  }
}

export default SeasonManagementService;
