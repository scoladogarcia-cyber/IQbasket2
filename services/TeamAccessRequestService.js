/**
 * @fileoverview Servicio de solicitudes de acceso a equipos.
 *
 * Compatibilidad con el esquema Supabase realmente auditado:
 * - solicitudes: public.team_join_requests
 * - usuarios: public.user_profiles
 * - equipos: public.teams
 *
 * La aprobación definitiva se moverá a una función transaccional v3 para que
 * aprobar solicitud + conceder membresía sea una única operación atómica.
 */

const DEFAULT_REQUESTED_ROLE = "VISOR";

export class TeamAccessRequestService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async _getCurrentProfile() {
    if (!this.supabase) return null;

    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    if (authError || !authData?.user?.id) return null;

    const { data, error } = await this.supabase
      .from("user_profiles")
      .select("id,email,role,global_role,status,assigned_team_ids")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async _resolveTeamSeasonId(teamId, explicitTeamSeasonId = null) {
    if (!this.supabase || !teamId) return null;
    if (explicitTeamSeasonId) return explicitTeamSeasonId;

    const { data, error } = await this.supabase
      .from("team_seasons")
      .select("id,team_id,status,created_at")
      .eq("team_id", teamId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) return null;
    if (data.length > 1) {
      throw new Error("Hay más de una temporada activa para este equipo; selecciona la temporada antes de solicitar acceso.");
    }

    return data[0].id;
  }

  async listTeamDirectory() {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from("teams")
      .select("id,club_id,name,category,competition,color,logo_url")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async listRequests() {
    if (!this.supabase) return [];

    const profile = await this._getCurrentProfile();
    if (!profile) return [];

    let query = this.supabase
      .from("team_join_requests")
      .select("id,user_id,team_id,team_season_id,requested_role,status,notes,created_at")
      .order("created_at", { ascending: false });

    const role = String(profile.role || "").toUpperCase();
    if (role !== "SUPERADMIN" && role !== "ADMIN") {
      query = query.eq("user_id", profile.id);
    } else if (role === "ADMIN") {
      const teamIds = Array.isArray(profile.assigned_team_ids)
        ? profile.assigned_team_ids.map(String).filter(Boolean)
        : [];

      if (teamIds.length === 0) return [];
      query = query.in("team_id", teamIds);
    }

    const { data: requests, error } = await query;
    if (error) throw error;
    if (!Array.isArray(requests) || requests.length === 0) return [];

    const teamIds = [...new Set(requests.map(r => r.team_id).filter(Boolean))];
    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];

    const [teamsRes, usersRes] = await Promise.all([
      teamIds.length > 0
        ? this.supabase.from("teams").select("id,name").in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? this.supabase.from("user_profiles").select("id,email,first_name,last_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (teamsRes.error) throw teamsRes.error;
    if (usersRes.error) throw usersRes.error;

    const teamMap = new Map((teamsRes.data || []).map(t => [String(t.id), t]));
    const userMap = new Map((usersRes.data || []).map(u => [String(u.id), u]));

    return requests.map((r) => {
      const team = teamMap.get(String(r.team_id));
      const user = userMap.get(String(r.user_id));
      const normalizedStatus = String(r.status || "pending").toUpperCase();

      return {
        ...r,
        userEmail: user?.email || "",
        userName: [user?.first_name, user?.last_name].filter(Boolean).join(" "),
        teamId: r.team_id,
        teamName: team?.name || "Equipo",
        requestedRole: r.requested_role || DEFAULT_REQUESTED_ROLE,
        status: normalizedStatus === "PENDING" ? "PENDIENTE" : normalizedStatus,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString() : ""
      };
    });
  }

  async requestAccess(teamId, requestedRole = DEFAULT_REQUESTED_ROLE, teamSeasonId = null) {
    if (!this.supabase || !teamId) throw new Error("Equipo no especificado.");

    const profile = await this._getCurrentProfile();
    if (!profile?.id) throw new Error("Usuario no autenticado.");

    const resolvedTeamSeasonId = await this._resolveTeamSeasonId(teamId, teamSeasonId);
    if (!resolvedTeamSeasonId) {
      throw new Error("No existe un contexto equipo-temporada activo para esta solicitud.");
    }

    const { data: existing, error: existingError } = await this.supabase
      .from("team_join_requests")
      .select("id,status,team_season_id")
      .eq("user_id", profile.id)
      .eq("team_season_id", resolvedTeamSeasonId)
      .in("status", ["pending", "PENDING", "pendiente", "PENDIENTE"])
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.length) return existing[0];

    const { data, error } = await this.supabase
      .from("team_join_requests")
      .insert([{
        user_id: profile.id,
        team_id: teamId,
        team_season_id: resolvedTeamSeasonId,
        requested_role: requestedRole || DEFAULT_REQUESTED_ROLE,
        status: "pending"
      }])
      .select("id,user_id,team_id,requested_role,status,notes,created_at")
      .single();

    if (error) throw error;
    return data;
  }

  async reviewRequest(requestId, approve) {
    if (!this.supabase || !requestId) {
      throw new Error("Solicitud no especificada.");
    }

    // Rechazar es una única escritura sobre la propia solicitud y no concede
    // privilegios, por lo que puede ejecutarse con el esquema actual.
    if (!approve) {
      const { data, error } = await this.supabase
        .from("team_join_requests")
        .update({ status: "rejected" })
        .eq("id", requestId)
        .select("id,user_id,team_id,requested_role,status,notes,created_at")
        .single();

      if (error) throw error;
      return data;
    }

    // Aprobar implica dos efectos que deben ser atómicos:
    // 1) marcar la solicitud aprobada;
    // 2) conceder el alcance/membresía correspondiente.
    // Hasta disponer del RPC v3 no se permite una aprobación parcial.
    throw new Error(
      "La aprobación queda temporalmente bloqueada hasta desplegar la operación transaccional v3. La solicitud puede mantenerse pendiente o rechazarse sin riesgo."
    );
  }
}

export default TeamAccessRequestService;
