/**
 * @fileoverview Gestión de plantilla histórica por equipo-temporada.
 * @description Usa roster_memberships como fuente canónica y RPCs seguros para cambios.
 */

export class RosterManagementService {
  constructor(supabaseClient, dataStore) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.dataStore = dataStore;
  }

  async getCapabilities() {
    if (!this.supabase) return { ready: false, reason: "NO_DATABASE" };

    const { data, error } = await this.supabase.rpc("iq_v3_roster_admin_capabilities");
    if (error) return { ready: false, reason: "BACKEND_NOT_APPLIED" };

    return {
      ready: Boolean(data?.ready),
      ...(data || {})
    };
  }

  _applyMembership(player, membership = null, inherited = false) {
    return {
      ...player,
      rosterMembershipId: membership?.id || null,
      rosterStatus: membership?.status || (inherited ? "INHERITED" : null),
      rosterInherited: inherited,
      jersey: membership?.jersey ?? player.jersey ?? player.number ?? null,
      number: membership?.jersey ?? player.number ?? player.jersey ?? null,
      primary_position:
        membership?.primary_position
        || player.primary_position
        || player.position
        || "Jugador",
      position:
        membership?.primary_position
        || player.position
        || player.primary_position
        || "Jugador"
    };
  }

  async loadForTeam(teamId) {
    const context = this.dataStore?.getActiveSeasonContext?.(teamId) || null;
    const teamSeasonId = context?.team_season_id || context?.teamSeasonId || null;
    const allTeamPlayers = this.dataStore?.getTeamPlayers?.(teamId)
      || this.dataStore?.getPlayers?.(teamId)
      || [];
    const capabilities = await this.getCapabilities();

    if (!teamSeasonId || !this.supabase || !capabilities.ready) {
      return {
        capabilities,
        context,
        teamSeasonId,
        persisted: false,
        memberships: [],
        activePlayers: allTeamPlayers.map(player => this._applyMembership(player, null, true)),
        availablePlayers: []
      };
    }

    const { data, error } = await this.supabase
      .from("roster_memberships")
      .select("id,player_id,team_season_id,jersey,primary_position,secondary_positions,status,joined_at,left_at")
      .eq("team_season_id", teamSeasonId);

    if (error) throw error;

    const memberships = data || [];
    if (memberships.length === 0) {
      return {
        capabilities,
        context,
        teamSeasonId,
        persisted: false,
        memberships,
        activePlayers: allTeamPlayers.map(player => this._applyMembership(player, null, true)),
        availablePlayers: []
      };
    }

    const membershipsByPlayer = new Map(
      memberships.map(row => [String(row.player_id), row])
    );

    const activePlayers = [];
    const availablePlayers = [];

    allTeamPlayers.forEach(player => {
      const membership = membershipsByPlayer.get(String(player.id)) || null;
      const active = membership && String(membership.status || "ACTIVE").toUpperCase() === "ACTIVE";

      if (active) activePlayers.push(this._applyMembership(player, membership, false));
      else availablePlayers.push(this._applyMembership(player, membership, false));
    });

    return {
      capabilities,
      context,
      teamSeasonId,
      persisted: true,
      memberships,
      activePlayers,
      availablePlayers
    };
  }

  async createPlayer({ teamSeasonId, firstName, lastName, jersey, primaryPosition }) {
    const { data, error } = await this.supabase.rpc("iq_v3_create_player_for_roster", {
      p_team_season_id: teamSeasonId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_jersey: jersey,
      p_primary_position: primaryPosition
    });
    if (error) throw error;
    return data;
  }

  async setMember({
    teamSeasonId,
    playerId,
    status = "ACTIVE",
    jersey = null,
    primaryPosition = null
  }) {
    const { data, error } = await this.supabase.rpc("iq_v3_set_roster_member", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_status: status,
      p_jersey: jersey,
      p_primary_position: primaryPosition
    });
    if (error) throw error;
    return data;
  }

  async removePlayer({ teamSeasonId, playerId }) {
    return this.setMember({
      teamSeasonId,
      playerId,
      status: "INACTIVE"
    });
  }

  async reactivatePlayer({ teamSeasonId, playerId, jersey = null, primaryPosition = null }) {
    return this.setMember({
      teamSeasonId,
      playerId,
      status: "ACTIVE",
      jersey,
      primaryPosition
    });
  }
}

export default RosterManagementService;
