/**
 * @fileoverview Calculador de Dominio: AdvancedTeamStatsCalculator (Estadísticas Avanzadas de Equipo).
 * @description Implementa todas las fórmulas de analítica colectiva del catálogo oficial
 * (`Diccionario_estadisticas_baloncesto_jugador_equipo.xlsx`) para equipos, rivales y quintetos.
 * 
 * Incluye los módulos analíticos de:
 * 1. Ritmo y Posesiones (POSS simple y conjunta, Pace / Ritmo reglamentario).
 * 2. Eficiencia y Ratings (OER/ORtg, DER/DRtg, Net Rating, PPP - Puntos por Posesión).
 * 3. Four Factors de Dean Oliver completos (Propios vs Rival: eFG%, TOV%, ORB%, DRB%, FTr).
 * 4. Eficiencia de Tiro de Equipo (2P%, 3P%, FG%, FT%, 3PAr, % Canastas Asistidas, % Pts de TL).
 * 5. Creación y Manejo Colectivo (AST/TOV, AST%, AST/100 poss, TOV/100 poss).
 * 6. Defensa Colectiva (STL%, BLK%, Tasa de Faltas / Foul Rate).
 * 7. Rendimiento de Quintetos / Lineups (Lineup ORtg, Lineup DRtg, Lineup Net Rating, Lineup +/-).
 * 8. Sistemas Tácticos y Situacionales (PPP en Fondos BLOB, Bandas SLOB, Tras Tiempo Muerto ATO).
 * 
 * Reglas de diseño:
 * - Funciones puras e inmutables.
 * - Control defensivo estricto contra divisiones por cero (retorna 0 si denominador <= 0).
 * - Soporte indistinto para propiedades en camelCase y snake_case.
 */

export class AdvancedTeamStatsCalculator {
  // =========================================================================
  // 1. RITMO, POSESIONES Y TIEMPO (PACE & POSSESSIONS)
  // =========================================================================

  /**
   * Posesiones Estimadas Básicas de un Equipo (Fórmula estándar Dean Oliver).
   * Fórmula del catálogo: FGA + 0.44×FTA + TOV − ORB
   * 
   * @param {Object} stats - Estadísticas de tiro, rebote y pérdidas del equipo.
   * @returns {number} Posesiones estimadas con 1 decimal.
   */
  static calculateTeamPossessions(stats = {}) {
    const fg2a = Number(stats.fg2Attempted ?? stats.fg2_attempted ?? 0);
    const fg3a = Number(stats.fg3Attempted ?? stats.fg3_attempted ?? 0);
    const fga = Number(stats.fga ?? (fg2a + fg3a));
    const fta = Number(stats.ftAttempted ?? stats.ft_attempted ?? stats.fta ?? 0);
    const tov = Number(stats.turnovers ?? stats.tov ?? 0);
    const orb = Number(stats.offReb ?? stats.off_reb ?? stats.rebounds_offensive ?? 0);

    const poss = fga + (0.44 * fta) + tov - orb;
    return Number(Math.max(0, poss).toFixed(1));
  }

  /**
   * Posesiones Estimadas Conjuntas (Fórmula bilateral más precisa del catálogo).
   * Fórmula del catálogo: 0.5 × [(FGA_eq + 0.44×FTA_eq − ORB_eq + TOV_eq) + (FGA_riv + 0.44×FTA_riv − ORB_riv + TOV_riv)]
   * 
   * @param {Object} teamStats - Estadísticas del equipo.
   * @param {Object} oppStats - Estadísticas del rival.
   * @returns {number} Posesiones conjuntas estimadas con 1 decimal.
   */
  static calculateJointPossessions(teamStats = {}, oppStats = {}) {
    const possTeam = this.calculateTeamPossessions(teamStats);
    const possOpp = this.calculateTeamPossessions(oppStats);
    const joint = 0.5 * (possTeam + possOpp);
    return Number(Math.max(0, joint).toFixed(1));
  }

  /**
   * Ritmo de Juego (Pace).
   * Estima el número de posesiones que disputaría el equipo en el tiempo reglamentario completo.
   * Fórmula del catálogo: POSS × Minutos_Reglamentarios / MIN_reales_partido
   * 
   * @param {number} possessions - Posesiones estimadas (preferiblemente conjuntas).
   * @param {number} [actualMinutes=40] - Minutos totales jugados (incluidas prórrogas, ej. 45 o 50).
   * @param {number} [regulationMinutes=40] - Duración reglamentaria estándar (40 min FIBA, 48 min NBA).
   * @returns {number} Ritmo de juego (posesiones normalizadas) con 1 decimal.
   */
  static calculatePace(possessions = 0, actualMinutes = 40, regulationMinutes = 40) {
    const minReales = Number(actualMinutes || 40);
    const poss = Number(possessions || 0);
    if (minReales <= 0 || poss <= 0) return 0;

    const pace = (poss * Number(regulationMinutes || 40)) / minReales;
    return Number(pace.toFixed(1));
  }

  // =========================================================================
  // 2. EFICIENCIA Y RATINGS (OFFENSIVE, DEFENSIVE & NET RATING)
  // =========================================================================

  /**
   * Puntos por Posesión (PPP - Points per Possession).
   * Fórmula del catálogo: PTS / POSS
   * 
   * @param {number} pts - Puntos anotados.
   * @param {number} possessions - Posesiones disputadas.
   * @returns {number} PPP con 2 decimales.
   */
  static calculatePPP(pts = 0, possessions = 0) {
    const poss = Number(possessions || 0);
    if (poss <= 0) return 0;
    return Number((Number(pts || 0) / poss).toFixed(2));
  }

  /**
   * Rating Ofensivo (ORtg / OER - Offensive Rating).
   * Puntos anotados por cada 100 posesiones de juego.
   * Fórmula del catálogo: 100 × PTS / POSS
   * 
   * @param {number} pts - Puntos a favor.
   * @param {number} possessions - Posesiones jugadas.
   * @returns {number} ORtg con 1 decimal.
   */
  static calculateOffensiveRating(pts = 0, possessions = 0) {
    const poss = Number(possessions || 0);
    if (poss <= 0) return 0;
    return Number(((Number(pts || 0) / poss) * 100).toFixed(1));
  }

  /**
   * Rating Defensivo (DRtg / DER - Defensive Rating).
   * Puntos encajados (anotados por el rival) por cada 100 posesiones de juego.
   * Fórmula del catálogo: 100 × Opp_PTS / POSS
   * 
   * @param {number} opponentPts - Puntos en contra.
   * @param {number} possessions - Posesiones jugadas.
   * @returns {number} DRtg con 1 decimal.
   */
  static calculateDefensiveRating(opponentPts = 0, possessions = 0) {
    const poss = Number(possessions || 0);
    if (poss <= 0) return 0;
    return Number(((Number(opponentPts || 0) / poss) * 100).toFixed(1));
  }

  /**
   * Rating Neto (Net Rating).
   * Diferencial de eficiencia por cada 100 posesiones. Mide el dominio real ajustado al ritmo.
   * Fórmula del catálogo: ORtg − DRtg
   * 
   * @param {number} ortg - Rating Ofensivo.
   * @param {number} drtg - Rating Defensivo.
   * @returns {number} Net Rating con 1 decimal.
   */
  static calculateNetRating(ortg = 0, drtg = 0) {
    return Number((Number(ortg || 0) - Number(drtg || 0)).toFixed(1));
  }

  // =========================================================================
  // 3. FOUR FACTORS DE DEAN OLIVER (PROPIOS Y RIVAL)
  // =========================================================================

  /**
   * Calcula los Four Factors completos de Dean Oliver (Propios y Concedidos al Rival).
   * Factores:
   * 1. eFG% (Efectividad de Tiro): (FGM + 0.5×3PM) / FGA
   * 2. TOV% (Control de Pérdidas): TOV / (FGA + 0.44×FTA + TOV)
   * 3. Rebote Ofensivo / Defensivo: ORB% = ORB / (ORB + Opp_DRB), DRB% = DRB / (DRB + Opp_ORB)
   * 4. FTr (Frecuencia de Tiro Libre): FTA / FGA (convención principal del catálogo)
   * 
   * @param {Object} teamStats - Estadísticas del equipo propio.
   * @param {Object} oppStats - Estadísticas del rival.
   * @returns {Object} { team: { eFG, tovPct, orbPct, drbPct, ftr }, opponent: { eFG, tovPct, orbPct, drbPct, ftr } }
   */
  static calculateFourFactors(teamStats = {}, oppStats = {}) {
    // Totales de Tiro de Campo Equipo
    const tFg2a = Number(teamStats.fg2Attempted ?? teamStats.fg2_attempted ?? 0);
    const tFg3a = Number(teamStats.fg3Attempted ?? teamStats.fg3_attempted ?? 0);
    const tFga = Number(teamStats.fga ?? (tFg2a + tFg3a));
    const tFg2m = Number(teamStats.fg2Made ?? teamStats.fg2_made ?? 0);
    const tFg3m = Number(teamStats.fg3Made ?? teamStats.fg3_made ?? 0);
    const tFgm = Number(teamStats.fgm ?? (tFg2m + tFg3m));
    const tFta = Number(teamStats.ftAttempted ?? teamStats.ft_attempted ?? teamStats.fta ?? 0);
    const tTov = Number(teamStats.turnovers ?? teamStats.tov ?? 0);
    const tOrb = Number(teamStats.offReb ?? teamStats.off_reb ?? 0);
    const tDrb = Number(teamStats.defReb ?? teamStats.def_reb ?? 0);

    // Totales de Tiro de Campo Rival
    const oFg2a = Number(oppStats.fg2Attempted ?? oppStats.fg2_attempted ?? 0);
    const oFg3a = Number(oppStats.fg3Attempted ?? oppStats.fg3_attempted ?? 0);
    const oFga = Number(oppStats.fga ?? (oFg2a + oFg3a));
    const oFg2m = Number(oppStats.fg2Made ?? oppStats.fg2_made ?? 0);
    const oFg3m = Number(oppStats.fg3Made ?? oppStats.fg3_made ?? 0);
    const oFgm = Number(oppStats.fgm ?? (oFg2m + oFg3m));
    const oFta = Number(oppStats.ftAttempted ?? oppStats.ft_attempted ?? oppStats.fta ?? 0);
    const oTov = Number(oppStats.turnovers ?? oppStats.tov ?? 0);
    const oOrb = Number(oppStats.offReb ?? oppStats.off_reb ?? 0);
    const oDrb = Number(oppStats.defReb ?? oppStats.def_reb ?? 0);

    // 1. eFG% (Team & Opponent)
    const teamEFG = tFga > 0 ? ((tFgm + (0.5 * tFg3m)) / tFga) * 100 : 0;
    const oppEFG = oFga > 0 ? ((oFgm + (0.5 * oFg3m)) / oFga) * 100 : 0;

    // 2. TOV% (Team & Opponent)
    const teamPlays = tFga + (0.44 * tFta) + tTov;
    const oppPlays = oFga + (0.44 * oFta) + oTov;
    const teamTovPct = teamPlays > 0 ? (tTov / teamPlays) * 100 : 0;
    const oppTovPct = oppPlays > 0 ? (oTov / oppPlays) * 100 : 0;

    // 3. Rebounding % (ORB% & DRB%)
    const orbAvailTeam = tOrb + oDrb;
    const orbAvailOpp = oOrb + tDrb;
    const teamOrbPct = orbAvailTeam > 0 ? (tOrb / orbAvailTeam) * 100 : 0;
    const teamDrbPct = orbAvailOpp > 0 ? (tDrb / orbAvailOpp) * 100 : 0;
    const oppOrbPct = orbAvailOpp > 0 ? (oOrb / orbAvailOpp) * 100 : 0;
    const oppDrbPct = orbAvailTeam > 0 ? (oDrb / orbAvailTeam) * 100 : 0;

    // 4. Free Throw Rate (FTr: FTA / FGA)
    const teamFTr = tFga > 0 ? tFta / tFga : 0;
    const oppFTr = oFga > 0 ? oFta / oFga : 0;

    return {
      team: {
        eFG: Number(teamEFG.toFixed(1)),
        tovPct: Number(teamTovPct.toFixed(1)),
        orbPct: Number(teamOrbPct.toFixed(1)),
        drbPct: Number(teamDrbPct.toFixed(1)),
        ftr: Number(teamFTr.toFixed(3))
      },
      opponent: {
        eFG: Number(oppEFG.toFixed(1)),
        tovPct: Number(oppTovPct.toFixed(1)),
        orbPct: Number(oppOrbPct.toFixed(1)),
        drbPct: Number(oppDrbPct.toFixed(1)),
        ftr: Number(oppFTr.toFixed(3))
      }
    };
  }

  // =========================================================================
  // 4. CREACIÓN Y CONTROL DE BALÓN COLECTIVO
  // =========================================================================

  /**
   * Ratio Asistencia / Pérdida de Equipo (AST/TOV).
   * Fórmula del catálogo: AST / TOV
   * 
   * @param {number} assists - Asistencias totales.
   * @param {number} turnovers - Pérdidas totales.
   * @returns {number} Ratio con 2 decimales.
   */
  static calculateAstTovRatio(assists = 0, turnovers = 0) {
    const tov = Number(turnovers || 0);
    const ast = Number(assists || 0);
    if (tov <= 0) return ast;
    return Number((ast / tov).toFixed(2));
  }

  /**
   * Porcentaje de Asistencias de Equipo (AST%).
   * Proporción de canastas de campo del equipo que fueron precedidas por un pase de canasta.
   * Fórmula del catálogo: AST / FGM × 100
   * 
   * @param {number} assists - Asistencias del equipo.
   * @param {number} fgm - Tiros de campo convertidos (2PM + 3PM).
   * @returns {number} Porcentaje con 1 decimal.
   */
  static calculateAssistPercentage(assists = 0, fgm = 0) {
    const totalFgm = Number(fgm || 0);
    if (totalFgm <= 0) return 0;
    return Number(((Number(assists || 0) / totalFgm) * 100).toFixed(1));
  }

  /**
   * Asistencias por 100 Posesiones.
   * Fórmula del catálogo: 100 × AST / POSS
   * 
   * @param {number} assists - Asistencias.
   * @param {number} possessions - Posesiones.
   * @returns {number} Valor con 1 decimal.
   */
  static calculateAssistsPer100Possessions(assists = 0, possessions = 0) {
    const poss = Number(possessions || 0);
    if (poss <= 0) return 0;
    return Number(((Number(assists || 0) / poss) * 100).toFixed(1));
  }

  /**
   * Pérdidas por 100 Posesiones.
   * Fórmula del catálogo: 100 × TOV / POSS
   * 
   * @param {number} turnovers - Pérdidas.
   * @param {number} possessions - Posesiones.
   * @returns {number} Valor con 1 decimal.
   */
  static calculateTurnoversPer100Possessions(turnovers = 0, possessions = 0) {
    const poss = Number(possessions || 0);
    if (poss <= 0) return 0;
    return Number(((Number(turnovers || 0) / poss) * 100).toFixed(1));
  }

  // =========================================================================
  // 5. DEFENSA COLECTIVA AVANZADA
  // =========================================================================

  /**
   * Porcentaje de Robos de Equipo (STL%).
   * Proporción de posesiones del rival finalizadas en recuperación propia.
   * Fórmula del catálogo: STL / Opp_POSS × 100
   * 
   * @param {number} steals - Robos del equipo.
   * @param {number} oppPossessions - Posesiones del rival.
   * @returns {number} Porcentaje con 1 decimal.
   */
  static calculateStealPercentage(steals = 0, oppPossessions = 0) {
    const poss = Number(oppPossessions || 0);
    if (poss <= 0) return 0;
    return Number(((Number(steals || 0) / poss) * 100).toFixed(1));
  }

  /**
   * Porcentaje de Tapones de Equipo (BLK%).
   * Proporción de tiros de 2 del rival taponados.
   * Fórmula del catálogo: BLK / Opp_2PA × 100
   * 
   * @param {number} blocks - Tapones a favor.
   * @param {number} opp2PA - Tiros de 2 intentados por el rival.
   * @returns {number} Porcentaje con 1 decimal.
   */
  static calculateBlockPercentage(blocks = 0, opp2PA = 0) {
    const att = Number(opp2PA || 0);
    if (att <= 0) return 0;
    return Number(((Number(blocks || 0) / att) * 100).toFixed(1));
  }

  /**
   * Tasa de Faltas Cometidas (Foul Rate).
   * Faltas personales cometidas por cada 100 posesiones del rival.
   * Fórmula del catálogo: 100 × PF / Opp_POSS
   * 
   * @param {number} fouls - Faltas personales del equipo.
   * @param {number} oppPossessions - Posesiones del rival.
   * @returns {number} Tasa con 1 decimal.
   */
  static calculateFoulRate(fouls = 0, oppPossessions = 0) {
    const poss = Number(oppPossessions || 0);
    if (poss <= 0) return 0;
    return Number(((Number(fouls || 0) / poss) * 100).toFixed(1));
  }

  // =========================================================================
  // 6. EFICIENCIA EN SISTEMAS Y TÁCTICA (BLOB, SLOB, ATO)
  // =========================================================================

  /**
   * Puntos por Posesión tras Saque de Fondo (BLOB PPP - Baseline Out of Bounds).
   * Fórmula del catálogo: PTS tras fondo / Posesiones de fondo
   * 
   * @param {number} pts - Puntos anotados tras saque de fondo.
   * @param {number} executions - Número de saques de fondo ejecutados.
   * @returns {number} PPP con 2 decimales.
   */
  static calculateBlobPPP(pts = 0, executions = 0) {
    const ex = Number(executions || 0);
    if (ex <= 0) return 0;
    return Number((Number(pts || 0) / ex).toFixed(2));
  }

  /**
   * Puntos por Posesión tras Saque de Banda (SLOB PPP - Sideline Out of Bounds).
   * Fórmula del catálogo: PTS tras banda / Posesiones de banda
   * 
   * @param {number} pts - Puntos anotados tras saque de banda.
   * @param {number} executions - Número de saques de banda ejecutados.
   * @returns {number} PPP con 2 decimales.
   */
  static calculateSlobPPP(pts = 0, executions = 0) {
    const ex = Number(executions || 0);
    if (ex <= 0) return 0;
    return Number((Number(pts || 0) / ex).toFixed(2));
  }

  /**
   * Puntos por Posesión tras Tiempo Muerto (ATO PPP - After Time Out).
   * Evalúa la eficacia táctica de las jugadas preparadas por el entrenador en los parones.
   * Fórmula del catálogo: PTS tras ATO / Posesiones tras ATO
   * 
   * @param {number} pts - Puntos anotados tras tiempo muerto.
   * @param {number} executions - Posesiones jugadas tras tiempo muerto.
   * @returns {number} PPP con 2 decimales.
   */
  static calculateAtoPPP(pts = 0, executions = 0) {
    const ex = Number(executions || 0);
    if (ex <= 0) return 0;
    return Number((Number(pts || 0) / ex).toFixed(2));
  }

  // =========================================================================
  // 7. RENDIMIENTO DE QUINTETOS (LINEUPS ANALYSIS)
  // =========================================================================

  /**
   * Calcula las métricas avanzadas de una combinación de 5 jugadores (Quinteto / Lineup).
   * Cruza puntos a favor, puntos en contra y posesiones disputadas por ese quinteto exacto.
   * 
   * @param {Object} lineupData - Datos acumulados del quinteto.
   * @param {number} lineupData.ptsFor - Puntos a favor anotados por el quinteto.
   * @param {number} lineupData.ptsAgainst - Puntos en contra recibidos por el quinteto.
   * @param {number} [lineupData.possessions=0] - Posesiones jugadas por el quinteto.
   * @param {number} [lineupData.secondsPlayed=0] - Tiempo jugado en segundos compartidos.
   * @returns {Object} { minutes, plusMinus, offensiveRating, defensiveRating, netRating, ppp }
   */
  static calculateLineupMetrics({ ptsFor = 0, ptsAgainst = 0, possessions = 0, secondsPlayed = 0 } = {}) {
    const pFor = Number(ptsFor || 0);
    const pAgainst = Number(ptsAgainst || 0);
    const poss = Number(possessions || 0);
    const sec = Number(secondsPlayed || 0);

    const ortg = this.calculateOffensiveRating(pFor, poss);
    const drtg = this.calculateDefensiveRating(pAgainst, poss);
    const netRtg = this.calculateNetRating(ortg, drtg);
    const ppp = this.calculatePPP(pFor, poss);

    return {
      minutesSeconds: sec,
      minutes: Number((sec / 60).toFixed(2)),
      plusMinus: pFor - pAgainst,
      possessions: poss,
      offensiveRating: ortg,
      defensiveRating: drtg,
      netRating: netRtg,
      ppp
    };
  }

  // =========================================================================
  // 8. OBJETO CONSOLIDADO DE ESTADÍSTICAS AVANZADAS DE EQUIPO
  // =========================================================================

  /**
   * Genera el informe analítico completo del equipo para un partido o temporada.
   * 
   * @param {Object} teamStats - Estadísticas acumuladas del equipo.
   * @param {Object} oppStats - Estadísticas acumuladas del rival.
   * @param {number} [actualMinutes=40] - Minutos totales disputados.
   * @returns {Object} Informe avanzado consolidado de equipo.
   */
  static generateAdvancedTeamReport(teamStats = {}, oppStats = {}, actualMinutes = 40) {
    const teamPts = Number(teamStats.points ?? teamStats.pts ?? 0);
    const oppPts = Number(oppStats.points ?? oppStats.pts ?? 0);

    const teamPoss = this.calculateTeamPossessions(teamStats);
    const jointPoss = this.calculateJointPossessions(teamStats, oppStats);
    const pace = this.calculatePace(jointPoss, actualMinutes, 40);

    const ortg = this.calculateOffensiveRating(teamPts, jointPoss);
    const drtg = this.calculateDefensiveRating(oppPts, jointPoss);
    const netRtg = this.calculateNetRating(ortg, drtg);
    const fourFactors = this.calculateFourFactors(teamStats, oppStats);

    const teamAst = Number(teamStats.assists ?? teamStats.ast ?? 0);
    const teamTov = Number(teamStats.turnovers ?? teamStats.tov ?? 0);
    const teamStl = Number(teamStats.steals ?? teamStats.stl ?? 0);
    const teamBlk = Number(teamStats.blocksMade ?? teamStats.blocks_made ?? teamStats.blk ?? 0);
    const teamPf = Number(teamStats.foulsCommitted ?? teamStats.fouls_committed ?? teamStats.pf ?? 0);
    const opp2pa = Number(oppStats.fg2Attempted ?? oppStats.fg2_attempted ?? 0);

    return {
      teamScore: teamPts,
      opponentScore: oppPts,
      pointDifferential: teamPts - oppPts,
      possessions: jointPoss,
      teamPossessionsOnly: teamPoss,
      pace,
      ppp: this.calculatePPP(teamPts, jointPoss),
      offensiveRating: ortg,
      defensiveRating: drtg,
      netRating: netRtg,
      fourFactors,
      astTovRatio: this.calculateAstTovRatio(teamAst, teamTov),
      assistPercentage: this.calculateAssistPercentage(teamAst, teamStats.fgMade ?? teamStats.fgm ?? 0),
      assistsPer100Poss: this.calculateAssistsPer100Possessions(teamAst, jointPoss),
      turnoversPer100Poss: this.calculateTurnoversPer100Possessions(teamTov, jointPoss),
      stealPercentage: this.calculateStealPercentage(teamStl, jointPoss),
      blockPercentage: this.calculateBlockPercentage(teamBlk, opp2pa),
      foulRate: this.calculateFoulRate(teamPf, jointPoss)
    };
  }
}