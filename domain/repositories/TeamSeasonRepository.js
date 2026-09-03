/**
 * Repository for the team + global-season context (v3).
 * Keeps business queries independent from Supabase.
 */
import { DATABASE_CONFIG } from "../../config/database.config.js";

export class TeamSeasonRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.TEAM_SEASONS;
  }

  async listByTeam(teamId, { status = null } = {}) {
    if (!teamId) return [];
    const criteria = { team_id: teamId };
    if (status) criteria.status = status;
    return this.db.query(this.collection, criteria, {
      orderBy: "created_at",
      ascending: false
    });
  }

  async listBySeason(seasonId, { status = null } = {}) {
    if (!seasonId) return [];
    const criteria = { season_id: seasonId };
    if (status) criteria.status = status;
    return this.db.query(this.collection, criteria);
  }

  async getById(id) {
    if (!id) return null;
    return this.db.getById(this.collection, id);
  }

  async getByTeamAndSeason(teamId, seasonId) {
    if (!teamId || !seasonId) return null;
    const rows = await this.db.query(
      this.collection,
      { team_id: teamId, season_id: seasonId },
      { limit: 1 }
    );
    return rows[0] || null;
  }

  async save(scope) {
    if (!scope?.team_id || !scope?.season_id) {
      throw new Error("TeamSeasonRepository: team_id y season_id son obligatorios.");
    }
    return this.db.upsert(this.collection, scope, "team_id,season_id");
  }
}

export default TeamSeasonRepository;
