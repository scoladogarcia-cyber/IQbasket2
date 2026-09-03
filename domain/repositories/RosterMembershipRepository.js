/**
 * Repository for historical player roster memberships (v3).
 * Player identity remains in players; jersey/position/team-season live here.
 */
import { DATABASE_CONFIG } from "../../config/database.config.js";

export class RosterMembershipRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.ROSTER_MEMBERSHIPS;
  }

  async listByTeamSeason(teamSeasonId, { status = null } = {}) {
    if (!teamSeasonId) return [];
    const criteria = { team_season_id: teamSeasonId };
    if (status) criteria.status = status;
    return this.db.query(this.collection, criteria);
  }

  async listByPlayer(playerId) {
    if (!playerId) return [];
    return this.db.query(this.collection, { player_id: playerId }, {
      orderBy: "joined_at",
      ascending: true
    });
  }

  async get(playerId, teamSeasonId) {
    if (!playerId || !teamSeasonId) return null;
    const rows = await this.db.query(
      this.collection,
      { player_id: playerId, team_season_id: teamSeasonId },
      { limit: 1 }
    );
    return rows[0] || null;
  }

  async save(membership) {
    if (!membership?.player_id || !membership?.team_season_id) {
      throw new Error("RosterMembershipRepository: player_id y team_season_id son obligatorios.");
    }
    return this.db.upsert(
      this.collection,
      membership,
      "player_id,team_season_id"
    );
  }
}

export default RosterMembershipRepository;
