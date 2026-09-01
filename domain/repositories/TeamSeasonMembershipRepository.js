/**
 * Repository for contextual user roles/access by team-season (v3).
 * Global security role stays in user_profiles.global_role.
 */
import { DATABASE_CONFIG } from "../../config/database.config.js";

export class TeamSeasonMembershipRepository {
  constructor(dbAdapter) {
    this.db = dbAdapter;
    this.collection = DATABASE_CONFIG.collections.TEAM_SEASON_MEMBERSHIPS;
  }

  async listByUser(userId, { status = "ACTIVE" } = {}) {
    if (!userId) return [];
    const criteria = { user_id: userId };
    if (status) criteria.status = status;
    return this.db.query(this.collection, criteria);
  }

  async listByTeamSeason(teamSeasonId, { status = "ACTIVE" } = {}) {
    if (!teamSeasonId) return [];
    const criteria = { team_season_id: teamSeasonId };
    if (status) criteria.status = status;
    return this.db.query(this.collection, criteria);
  }

  async listByUserAndScope(userId, teamSeasonId) {
    if (!userId || !teamSeasonId) return [];
    return this.db.query(this.collection, {
      user_id: userId,
      team_season_id: teamSeasonId
    });
  }

  async save(membership) {
    if (!membership?.user_id || !membership?.team_season_id || !membership?.function_role) {
      throw new Error(
        "TeamSeasonMembershipRepository: user_id, team_season_id y function_role son obligatorios."
      );
    }

    return this.db.upsert(
      this.collection,
      membership,
      "user_id,team_season_id,function_role"
    );
  }
}

export default TeamSeasonMembershipRepository;
