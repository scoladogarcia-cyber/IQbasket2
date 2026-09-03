/**
 * @fileoverview Gestión v3 de temporadas globales, vínculos equipo-temporada y staff.
 * @description Encapsula lectura y futuras escrituras RPC para evitar que la vista
 * conozca detalles de Supabase o escriba directamente en tablas sensibles.
 */

export class SeasonManagementService {
  constructor(supabaseClient, contextStore = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.contextStore = contextStore;
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

  async _loadGlobalSeasonCatalog() {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from("season_catalog")
      .select("id,code,name,start_date,end_date,status,is_test")
      .order("start_date", { ascending: false });

    if (error) {
      console.warn("[SeasonManagement] No se pudo leer season_catalog:", error.message);
      return [];
    }

    return data || [];
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

    const capabilities = await this.getCapabilities();
    const globalCatalog = await this._loadGlobalSeasonCatalog();

    // Fuente canónica: exactamente el mismo SeasonContextService que usa DataStore.
    // Evita que Configuración tenga una segunda lógica de lectura de temporadas.
    if (this.contextStore?.getAllTeamSeasonContexts) {
      const contexts = await this.contextStore.getAllTeamSeasonContexts({ status: "ACTIVE" });

      if (contexts.length > 0) {
        const seasonsMap = new Map();
        const teamSeasons = [];

        contexts.forEach(context => {
          const globalSeasonId = context.global_season_id || context.globalSeasonId;
          const teamSeasonId = context.team_season_id || context.teamSeasonId;
          const teamId = context.team_id || context.teamId;

          if (globalSeasonId && !seasonsMap.has(String(globalSeasonId))) {
            seasonsMap.set(String(globalSeasonId), {
              id: globalSeasonId,
              code: context.code || context.name || "",
              name: context.name || context.code || "",
              start_date: context.start_date || null,
              end_date: context.end_date || null,
              status: context.status || "ACTIVE",
              is_test: false
            });
          }

          if (teamSeasonId && teamId && globalSeasonId) {
            teamSeasons.push({
              id: teamSeasonId,
              team_id: teamId,
              season_id: globalSeasonId,
              legacy_season_id: context.legacy_season_id || context.legacySeasonId || null,
              status: context.status || "ACTIVE",
              data_status: context.data_status || "ACTIVE"
            });
          }
        });

        const teams = (this.contextStore.getTeams?.() || []).map(team => ({
          id: team.id,
          club_id: team.club_id || team.clubId || null,
          name: team.name,
          category: team.category || "",
          competition: team.competition || ""
        }));

        const legacySeasons = this.contextStore.legacySeasons || [];

        let staffAssignments = [];
        try {
          const staffRes = await this.supabase
            .from("team_season_staff_assignments")
            .select("id,team_season_id,staff_role,user_id,external_name,status,created_at,updated_at")
            .eq("status", "ACTIVE");

          if (!staffRes.error) staffAssignments = staffRes.data || [];
        } catch {
          staffAssignments = [];
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

        const mergedSeasons = new Map(
          globalCatalog.map(season => [String(season.id), season])
        );
        [...seasonsMap.values()].forEach(season => {
          if (!mergedSeasons.has(String(season.id))) {
            mergedSeasons.set(String(season.id), season);
          }
        });

        return {
          capabilities,
          seasons: [...mergedSeasons.values()].sort((a, b) => {
            const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
            const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
            return bDate - aDate;
          }),
          teamSeasons,
          teams,
          staffAssignments,
          legacySeasons,
          usersById
        };
      }
    }

    // Fallback directo únicamente si el contexto central no devuelve nada.
    const [seasonsRes, teamSeasonsRes] = await Promise.all([
      this.supabase
        .from("season_catalog")
        .select("id,code,name,start_date,end_date,status,is_test")
        .order("start_date", { ascending: false }),
      this.supabase
        .from("team_seasons")
        .select("id,team_id,season_id,legacy_season_id,status,data_status")
    ]);

    const canonicalError = [seasonsRes.error, teamSeasonsRes.error].find(Boolean);
    if (canonicalError) throw canonicalError;

    return {
      capabilities,
      seasons: seasonsRes.data || [],
      teamSeasons: teamSeasonsRes.data || [],
      teams: this.contextStore?.getTeams?.() || [],
      staffAssignments: [],
      legacySeasons: this.contextStore?.legacySeasons || [],
      usersById: new Map()
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
