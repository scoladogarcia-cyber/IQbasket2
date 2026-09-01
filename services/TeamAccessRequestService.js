/**
 * @fileoverview Servicio de solicitudes de acceso a equipos.
 * @description Persistencia multiusuario mediante RPCs seguras de Supabase.
 */
export class TeamAccessRequestService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
  }

  async listTeamDirectory() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.rpc("iq_list_team_directory");
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async listRequests() {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from("team_access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      ...r,
      userEmail: r.requester_email,
      teamId: r.team_id,
      teamName: r.team_name || r.team?.name || "Equipo",
      status: String(r.status || "PENDIENTE").toUpperCase(),
      date: r.created_at ? new Date(r.created_at).toLocaleDateString() : ""
    }));
  }

  async requestAccess(teamId) {
    if (!this.supabase || !teamId) throw new Error("Equipo no especificado.");
    const { data, error } = await this.supabase.rpc("iq_request_team_access", {
      target_team_id: teamId
    });
    if (error) throw error;
    return data;
  }

  async reviewRequest(requestId, approve) {
    if (!this.supabase || !requestId) throw new Error("Solicitud no especificada.");
    const { data, error } = await this.supabase.rpc("iq_review_team_access", {
      request_id: requestId,
      approve_request: Boolean(approve)
    });
    if (error) throw error;
    return data;
  }
}

export default TeamAccessRequestService;
