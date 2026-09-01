/**
 * Pure player-season analytics calculator.
 * It delegates formulas to the existing canonical StatsAggregator and only
 * transforms the result into a persistence-friendly snapshot.
 */

import { StatsAggregator } from "../stats/StatsAggregator.js";
import { ANALYTICS_CONFIG } from "../../config/analytics.config.js";

export class PlayerSeasonAnalyticsCalculator {
  static calculate({
    playerId,
    teamSeasonId,
    playerGameStats = [],
    teamSeasonTotals = {},
    opponentSeasonTotals = {},
    calculationVersion = ANALYTICS_CONFIG.calculationVersion,
    sourceRevision = null
  } = {}) {
    if (!playerId || !teamSeasonId) {
      throw new Error("PlayerSeasonAnalyticsCalculator: playerId y teamSeasonId son obligatorios.");
    }

    const aggregate = StatsAggregator.aggregatePlayerSeasonStats(
      playerGameStats,
      teamSeasonTotals,
      opponentSeasonTotals
    );

    if (!aggregate) return null;

    const totals = aggregate.totals || {};
    const perGame = aggregate.perGame || {};
    const advanced = aggregate.advanced || {};

    return {
      team_season_id: String(teamSeasonId),
      player_id: String(playerId),
      calculation_version: calculationVersion,
      source_revision: sourceRevision,
      games_played: Number(totals.gp || 0),
      minutes: Number(totals.minutes || 0),
      points: Number(totals.points || 0),
      ppg: Number(perGame.ppg || 0),
      rpg: Number(perGame.rpg || 0),
      apg: Number(perGame.apg || 0),
      pir: Number(perGame.pirPg || 0),
      true_shooting_pct: Number(advanced.ts || 0),
      efg_pct: Number(advanced.eFG || 0),
      usage_pct: Number(advanced.usageRate || 0),
      offensive_rating: Number(advanced.individualORtg || 0),
      defensive_rating: null,
      net_rating: null,
      metrics: {
        totals,
        perGame,
        advanced
      },
      calculated_at: new Date().toISOString()
    };
  }
}

export default PlayerSeasonAnalyticsCalculator;
