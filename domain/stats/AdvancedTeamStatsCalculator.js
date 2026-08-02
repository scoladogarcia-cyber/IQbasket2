/**
 * @fileoverview Calculador de Métricas Avanzadas Colectivas de Equipo y Four Factors.
 * @description Implementa el cálculo de Posesiones de Equipo, Ratings Ofensivo/Defensivo
 * y los Four Factors de Dean Oliver (eFG%, TOV%, ORB%, FTr).
 */

export class AdvancedTeamStatsCalculator {
  /**
   * Posesiones Estimadas de Equipo (Team Possessions).
   * Utiliza la fórmula estándar FIBA / NBA de Dean Oliver.
   * 
   * Fórmula del diccionario: FGA + 0.44 * FTA + TOV - ORB
   * 
   * @param {Object} stats - Estadísticas colectivas del equipo.
   * @returns {number} Número estimado de posesiones de juego.
   */
  static calculateTeamPossessions(stats = {}) {
    const fg2Attempted = Number(stats.fg2Attempted || stats.fg2_attempted || 0);
    const fg3Attempted = Number(stats.fg3Attempted || stats.fg3_attempted || 0);
    const fga = fg2Attempted + fg3Attempted;
    const fta = Number(stats.ftAttempted || stats.ft_attempted || 0);
    const tov = Number(stats.turnovers || 0);
    const orb = Number(stats.offReb || stats.off_reb || stats.rebounds_offensive || 0);

    const poss = fga + (0.44 * fta) + tov - orb;
    return Number(Math.max(1, poss).toFixed(1));
  }

  /**
   * Rating Ofensivo (ORTG - Offensive Rating).
   * Mide la eficiencia anotadora calculando cuántos puntos anota el equipo cada 100 posesiones.
   * 
   * Fórmula del diccionario: (Puntos Anotados / Posesiones) * 100
   * 
   * @param {number} pts - Puntos totales a favor del equipo.
   * @param {number} possessions - Posesiones jugadas.
   * @returns {number} Puntos por 100 posesiones.
   */
  static calculateOffensiveRating(pts = 0, possessions = 1) {
    const poss = Number(possessions);
    if (!poss || poss <= 0) return 0;
    return Number(((Number(pts) / poss) * 100).toFixed(1));
  }

  /**
   * Rating Defensivo (DRTG - Defensive Rating).
   * Mide la solidez defensiva calculando cuántos puntos recibe el equipo cada 100 posesiones.
   * 
   * Fórmula del diccionario: (Puntos del Rival / Posesiones) * 100
   * 
   * @param {number} opponentPts - Puntos encajados (anotados por el rival).
   * @param {number} possessions - Posesiones jugadas.
   * @returns {number} Puntos concedidos por 100 posesiones.
   */
  static calculateDefensiveRating(opponentPts = 0, possessions = 1) {
    const poss = Number(possessions);
    if (!poss || poss <= 0) return 0;
    return Number(((Number(opponentPts) / poss) * 100).toFixed(1));
  }

  /**
   * Net Rating (Diferencial Neto por 100 Posesiones).
   * Mide la dominancia global del equipo sobre el rival.
   * 
   * Fórmula: ORTG - DRTG
   */
  static calculateNetRating(ortg = 0, drtg = 0) {
    return Number((Number(ortg) - Number(drtg)).toFixed(1));
  }

  /**
   * FOUR FACTORS (Los cuatro factores de victoria de Dean Oliver):
   * 1. eFG% (Shooting): Eficiencia de tiro ajustada.
   * 2. TOV% (Turnover Rate): Porcentaje de posesiones perdidas.
   * 3. ORB% (Rebounding): Porcentaje de rebotes ofensivos capturados respecto a los disponibles.
   * 4. FTr (Free Throw Rate): Capacidad de ir al tiro libre respecto a los tiros de campo intentados.
   * 
   * @param {Object} teamStats - Estadísticas del equipo.
   * @param {Object} opponentStats - Estadísticas del rival.
   * @returns {Object} { eFG, TOVPct, ORBPct, FTr }
   */
  static calculateFourFactors(teamStats = {}, opponentStats = {}) {
    const fga = Number((teamStats.fg2Attempted || teamStats.fg2_attempted || 0) + (teamStats.fg3Attempted || teamStats.fg3_attempted || 0));
    const fgm = Number((teamStats.fg2Made || teamStats.fg2_made || 0) + (teamStats.fg3Made || teamStats.fg3_made || 0));
    const fta = Number(teamStats.ftAttempted || teamStats.ft_attempted || 0);
    const ftm = Number(teamStats.ftMade || teamStats.ft_made || 0);
    const tov = Number(teamStats.turnovers || 0);
    const orb = Number(teamStats.offReb || teamStats.off_reb || teamStats.rebounds_offensive || 0);
    const oppDrb = Number(opponentStats.defReb || opponentStats.def_reb || opponentStats.rebounds_defensive || 0);

    // Factor 1: eFG%
    const efg = fga > 0 ? ((fgm + 0.5 * Number(teamStats.fg3Made || teamStats.fg3_made || 0)) / fga) * 100 : 0;

    // Factor 2: TOV% -> TOV / (FGA + 0.44*FTA + TOV)
    const possDenom = fga + (0.44 * fta) + tov;
    const tovPct = possDenom > 0 ? (tov / possDenom) * 100 : 0;

    // Factor 3: ORB% -> ORB / (ORB + DRB_Rival)
    const orbDenom = orb + oppDrb;
    const orbPct = orbDenom > 0 ? (orb / orbDenom) * 100 : 0;

    // Factor 4: FTr -> FTM / FGA
    const ftr = fga > 0 ? (ftm / fga) : 0;

    return {
      eFG: Number(efg.toFixed(1)),
      TOVPct: Number(tovPct.toFixed(1)),
      ORBPct: Number(orbPct.toFixed(1)),
      FTr: Number(ftr.toFixed(3))
    };
  }
}