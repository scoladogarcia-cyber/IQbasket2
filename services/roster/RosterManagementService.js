/**
 * @fileoverview Gestión temporal de plantilla por equipo-temporada.
 * @description roster_memberships identifica participación en la temporada y
 * roster_membership_stints define los intervalos efectivos de elegibilidad.
 */

function toIsoDate(value = null) {
  if (!value) return null;
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

  _isDateInsideStint(stint, effectiveDate) {
    const date = toIsoDate(effectiveDate) || todayIso();
    const from = toIsoDate(stint?.valid_from);
    const until = toIsoDate(stint?.valid_until);
    if (!from) return false;
    return from <= date && (!until || until >= date);
  }

  _applyMembership(player, membership = null, stints = [], inherited = false) {
    const currentDate = todayIso();
    const activeNow = stints.length > 0
      ? stints.some(stint => this._isDateInsideStint(stint, currentDate))
      : ["ACTIVE", "ACTIVO"].includes(String(membership?.status || "").toUpperCase());

    return {
      ...player,
      rosterMembershipId: membership?.id || null,
      rosterStatus: membership?.status || (inherited ? "INHERITED" : null),
      rosterInherited: inherited,
      rosterActiveNow: activeNow,
      rosterStints: stints,
      rosterFirstFrom: stints.length
        ? [...stints].map(stint => toIsoDate(stint.valid_from)).filter(Boolean).sort()[0] || null
        : toIsoDate(membership?.joined_at),
      rosterLastUntil: stints.length
        ? [...stints].map(stint => toIsoDate(stint.valid_until)).filter(Boolean).sort().at(-1) || null
        : toIsoDate(membership?.left_at),
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
    const capabilities = await this.getCapabilities();

    const fallbackPlayers = this.dataStore?.getTeamPlayers?.(teamId)
      || this.dataStore?.getPlayers?.(teamId)
      || [];

    if (!teamSeasonId || !this.supabase || !capabilities.ready) {
      return {
        capabilities,
        context,
        teamSeasonId,
        persisted: false,
        memberships: [],
        stints: [],
        activePlayers: fallbackPlayers.map(player => this._applyMembership(player, null, [], true)),
        seasonParticipants: fallbackPlayers.map(player => this._applyMembership(player, null, [], true)),
        availablePlayers: []
      };
    }

    const { data: membershipsData, error: membershipsError } = await this.supabase
      .from("roster_memberships")
      .select("id,player_id,team_season_id,jersey,primary_position,secondary_positions,status,joined_at,left_at")
      .eq("team_season_id", teamSeasonId);

    if (membershipsError) throw membershipsError;

    const memberships = membershipsData || [];
    if (memberships.length === 0) {
      return {
        capabilities,
        context,
        teamSeasonId,
        persisted: false,
        memberships,
        stints: [],
        activePlayers: fallbackPlayers.map(player => this._applyMembership(player, null, [], true)),
        seasonParticipants: fallbackPlayers.map(player => this._applyMembership(player, null, [], true)),
        availablePlayers: []
      };
    }

    const membershipIds = memberships.map(row => row.id).filter(Boolean);
    let stints = [];

    if (membershipIds.length > 0) {
      const { data: stintData, error: stintError } = await this.supabase
        .from("roster_membership_stints")
        .select("id,roster_membership_id,valid_from,valid_until,source,notes")
        .in("roster_membership_id", membershipIds);

      if (stintError) throw stintError;
      stints = stintData || [];
    }

    const playerIds = memberships.map(row => row.player_id).filter(Boolean);
    const directory = new Map(
      (this.dataStore?.getPlayerDirectory?.() || fallbackPlayers)
        .map(player => [String(player.id), player])
    );

    const missingIds = playerIds.filter(id => !directory.has(String(id)));
    if (missingIds.length > 0) {
      const { data: missingPlayers, error } = await this.supabase
        .from("players")
        .select("*")
        .in("id", missingIds);

      if (!error) {
        (missingPlayers || []).forEach(player => directory.set(String(player.id), player));
      }
    }

    const stintsByMembership = new Map();
    stints.forEach(stint => {
      const key = String(stint.roster_membership_id);
      if (!stintsByMembership.has(key)) stintsByMembership.set(key, []);
      stintsByMembership.get(key).push(stint);
    });

    const membershipByPlayer = new Map(
      memberships.map(row => [String(row.player_id), row])
    );

    const seasonParticipants = [];
    memberships.forEach(membership => {
      const player = directory.get(String(membership.player_id));
      if (!player) return;
      const playerStints = stintsByMembership.get(String(membership.id)) || [];
      seasonParticipants.push(this._applyMembership(player, membership, playerStints, false));
    });

    const activePlayers = seasonParticipants.filter(player => player.rosterActiveNow);

    const activeIds = new Set(activePlayers.map(player => String(player.id)));
    const participantIds = new Set(seasonParticipants.map(player => String(player.id)));

    const availablePlayers = [
      ...seasonParticipants.filter(player => !activeIds.has(String(player.id))),
      ...fallbackPlayers
        .filter(player => !participantIds.has(String(player.id)))
        .map(player => this._applyMembership(player, null, [], false))
    ];

    return {
      capabilities,
      context,
      teamSeasonId,
      persisted: true,
      memberships,
      stints,
      membershipByPlayer,
      activePlayers,
      seasonParticipants,
      availablePlayers
    };
  }

  async createPlayer({
    teamSeasonId,
    firstName,
    lastName,
    jersey,
    primaryPosition,
    effectiveDate = null
  }) {
    const { data, error } = await this.supabase.rpc("iq_v3_create_player_for_roster", {
      p_team_season_id: teamSeasonId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_jersey: jersey,
      p_primary_position: primaryPosition,
      p_effective_date: effectiveDate
    });
    if (error) throw error;
    return data;
  }

  async setMember({
    teamSeasonId,
    playerId,
    status = "ACTIVE",
    jersey = null,
    primaryPosition = null,
    effectiveDate = null
  }) {
    const { data, error } = await this.supabase.rpc("iq_v3_set_roster_member", {
      p_team_season_id: teamSeasonId,
      p_player_id: playerId,
      p_status: status,
      p_jersey: jersey,
      p_primary_position: primaryPosition,
      p_effective_date: effectiveDate
    });
    if (error) throw error;
    return data;
  }

  async removePlayer({
    teamSeasonId,
    playerId,
    lastEligibleDate = null
  }) {
    return this.setMember({
      teamSeasonId,
      playerId,
      status: "INACTIVE",
      effectiveDate: lastEligibleDate
    });
  }

  async reactivatePlayer({
    teamSeasonId,
    playerId,
    jersey = null,
    primaryPosition = null,
    firstEligibleDate = null
  }) {
    return this.setMember({
      teamSeasonId,
      playerId,
      status: "ACTIVE",
      jersey,
      primaryPosition,
      effectiveDate: firstEligibleDate
    });
  }
}

export default RosterManagementService;
