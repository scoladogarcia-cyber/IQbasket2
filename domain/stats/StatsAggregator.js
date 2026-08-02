/**
 * @fileoverview Orquestador y Procesador Automático de Estadísticas de Partido.
 * @description Recibe las estadísticas brutas anotadas en un partido, ejecuta en cascada 
 * todas las fórmulas del diccionario y devuelve las listas y totales calculados listos
 * para guardarse en Supabase/LocalStorage.
 */

import { BoxScoreCalculator } from "./BoxScoreCalculator.js";
import { AdvancedPlayerStatsCalculator } from "./AdvancedPlayerStatsCalculator.js";
import { AdvancedTeamStatsCalculator } from "./AdvancedTeamStatsCalculator.js";

export class StatsAggregator {
  /**
   * Recalcula automáticamente todas las métricas de un partido para jugadores y equipos.
   * 
   * @param {Array<Object>} playersRawStats - Lista con las estadísticas brutas de los jugadores.
   * @param {Object} teamRawStats - Objeto con los acumulados crudos del equipo.
   * @param {Object} opponentRawStats - Objeto con los acumulados crudos del rival.
   * @returns {Object} Objeto que incluye { playerStatsList, teamStats, opponentPossessions }
   */
  static processGameStats(playersRawStats = [], teamRawStats = {}, opponentRawStats = {}) {
    // 1. Posesiones totales de nuestro equipo y del rival
    const teamPoss = AdvancedTeamStatsCalculator.calculateTeamPossessions(teamRawStats);
    const oppPoss = AdvancedTeamStatsCalculator.calculateTeamPossessions(opponentRawStats);

    // 2. Procesa cada jugador aplicando las fórmulas del diccionario
    const processedPlayers = playersRawStats.map((p) => {
      // Puntos
      const points = BoxScoreCalculator.calculatePoints(
        p.fg2Made || p.fg2_made,
        p.fg3Made || p.fg3_made,
        p.ftMade || p.ft_made
      );

      // Porcentajes de acierto de tiro
      const fg2Pct = BoxScoreCalculator.calculatePercentage(p.fg2Made || p.fg2_made, p.fg2Attempted || p.fg2_attempted);
      const fg3Pct = BoxScoreCalculator.calculatePercentage(p.fg3Made || p.fg3_made, p.fg3Attempted || p.fg3_attempted);
      const ftPct = BoxScoreCalculator.calculatePercentage(p.ftMade || p.ft_made, p.ftAttempted || p.ft_attempted);

      const playerWithPts = { ...p, points };

      // Métricas individuales calculadas
      const pir = BoxScoreCalculator.calculatePIR(playerWithPts);
      const gameScore = BoxScoreCalculator.calculateGameScore(playerWithPts);
      const efg = AdvancedPlayerStatsCalculator.calculateEFG(
        p.fg2Made || p.fg2_made,
        p.fg3Made || p.fg3_made,
        p.fg2Attempted || p.fg2_attempted,
        p.fg3Attempted || p.fg3_attempted
      );
      const ts = AdvancedPlayerStatsCalculator.calculateTS(
        points,
        p.fg2Attempted || p.fg2_attempted,
        p.fg3Attempted || p.fg3_attempted,
        p.ftAttempted || p.ft_attempted
      );
      const astTov = AdvancedPlayerStatsCalculator.calculateAstTovRatio(p.assists, p.turnovers);
      const usg = AdvancedPlayerStatsCalculator.calculateUsageRate(playerWithPts, teamRawStats, p.minutes || 0);

      return {
        ...playerWithPts,
        points,
        fg2_pct: fg2Pct,
        fg3_pct: fg3Pct,
        ft_pct: ftPct,
        evaluation: pir,
        game_score: gameScore,
        efg,
        ts,
        ast_tov_ratio: astTov,
        usg
      };
    });

    // 3. Procesa métricas avanzadas colectivas de equipo
    const teamPoints = BoxScoreCalculator.calculatePoints(
      teamRawStats.fg2Made || teamRawStats.fg2_made,
      teamRawStats.fg3Made || teamRawStats.fg3_made,
      teamRawStats.ftMade || teamRawStats.ft_made
    );
    const oppPoints = BoxScoreCalculator.calculatePoints(
      opponentRawStats.fg2Made || opponentRawStats.fg2_made,
      opponentRawStats.fg3Made || opponentRawStats.fg3_made,
      opponentRawStats.ftMade || opponentRawStats.ft_made
    );

    const ortg = AdvancedTeamStatsCalculator.calculateOffensiveRating(teamPoints, teamPoss);
    const drtg = AdvancedTeamStatsCalculator.calculateDefensiveRating(oppPoints, teamPoss);
    const netRating = AdvancedTeamStatsCalculator.calculateNetRating(ortg, drtg);
    const fourFactors = AdvancedTeamStatsCalculator.calculateFourFactors(teamRawStats, opponentRawStats);

    const processedTeam = {
      ...teamRawStats,
      points: teamPoints,
      possessions: teamPoss,
      ortg,
      drtg,
      net_rating: netRating,
      four_factors: fourFactors
    };

    return {
      playerStatsList: processedPlayers,
      teamStats: processedTeam,
      opponentPossessions: oppPoss
    };
  }
}