/**
 * Pure team-season analytics calculator.
 * Uses the canonical StatsAggregator so formulas remain centralized.
 */

import { StatsAggregator } from "../stats/StatsAggregator.js";
import { ANALYTICS_CONFIG } from "../../config/analytics.config.js";

export class TeamSeasonAnalyticsCalculator {
  static calculate({
    teamSeasonId,
    gamesReport = [],
    calculationVersion = ANALYTICS_CONFIG.calculationVersion,
    sourceRevision = null
  } = {}) {
    if (!teamSeasonId) {
      throw new Error("TeamSeasonAnalyticsCalculator: teamSeasonId es obligatorio.");
    }

    const aggregate = StatsAggregator.aggregateTeamSeasonStats(gamesReport);
    if (!aggregate) return null;

    const record = aggregate.record || {};
    const points = aggregate.points || {};
    const seasonReport = aggregate.seasonReport || {};
    const fourFactors = seasonReport.fourFactors || {};

    return {
      team_season_id: String(teamSeasonId),
      calculation_version: calculationVersion,
      source_revision: sourceRevision,
      games_played: Number(record.gamesPlayed || 0),
      wins: Number(record.wins || 0),
      losses: Number(record.losses || 0),
      points_for: Number(points.totalFor || 0),
      points_against: Number(points.totalAgainst || 0),
      pace: Number(seasonReport.pace || 0),
      offensive_rating: Number(seasonReport.offensiveRating || 0),
      defensive_rating: Number(seasonReport.defensiveRating || 0),
      net_rating: Number(seasonReport.netRating || 0),
      efg_pct: Number(fourFactors.team?.eFG || 0),
      metrics: {
        record,
        points,
        seasonReport
      },
      calculated_at: new Date().toISOString()
    };
  }
}

export default TeamSeasonAnalyticsCalculator;
