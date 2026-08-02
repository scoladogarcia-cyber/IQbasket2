/**
 * @fileoverview Calculador de Box Score tradicional y métricas básicas de baloncesto.
 * @description Procesa los datos brutos anotados en acta o pantalla (puntos, porcentajes de tiro,
 * valoración FIBA/ACB y la métrica Game Score de Hollinger).
 */

export class BoxScoreCalculator {
  /**
   * Calcula el total de puntos anotados por un jugador o equipo.
   * Fórmula del diccionario: 2 * 2PM + 3 * 3PM + FTM
   * 
   * @param {number} [fg2Made=0] - Tiros de 2 puntos anotados (2PM).
   * @param {number} [fg3Made=0] - Triples anotados (3PM).
   * @param {number} [ftMade=0] - Tiros libres anotados (FTM).
   * @returns {number} Puntos totales anotados (PTS).
   */
  static calculatePoints(fg2Made = 0, fg3Made = 0, ftMade = 0) {
    return (Number(fg2Made) * 2) + (Number(fg3Made) * 3) + Number(ftMade);
  }

  /**
   * Calcula el porcentaje de acierto de tiro (2P%, 3P%, FG%, FT%).
   * Fórmula del diccionario: (Anotados / Intentados) * 100
   * 
   * @param {number} [made=0] - Tiros convertidos.
   * @param {number} [attempted=0] - Tiros intentados.
   * @returns {number} Porcentaje de acierto redondeado a 1 decimal (ej: 45.5).
   */
  static calculatePercentage(made = 0, attempted = 0) {
    const att = Number(attempted);
    if (!att || att === 0) return 0;
    return Number(((Number(made) / att) * 100).toFixed(1));
  }

  /**
   * Calcula la Valoración ACB / Euroliga (PIR - Performance Index Rating).
   * Evalúa la contribución estadística global acumulando acciones positivas y restando errores.
   * 
   * Fórmula oficial del diccionario:
   * (PTS + TRB + AST + STL + BLK + FD) - (Missed FG + Missed FT + TOV + BLKA + PF)
   * 
   * @param {Object} stats - Objeto de estadísticas individuales del jugador.
   * @returns {number} Valoración total (PIR / VAL). Puede ser negativa.
   */
  static calculatePIR(stats = {}) {
    const fg2Attempted = Number(stats.fg2Attempted || stats.fg2_attempted || 0);
    const fg2Made = Number(stats.fg2Made || stats.fg2_made || 0);
    const fg3Attempted = Number(stats.fg3Attempted || stats.fg3_attempted || 0);
    const fg3Made = Number(stats.fg3Made || stats.fg3_made || 0);
    const ftAttempted = Number(stats.ftAttempted || stats.ft_attempted || 0);
    const ftMade = Number(stats.ftMade || stats.ft_made || 0);

    // Tiros de campo y libres fallados
    const missedFG = (fg2Attempted - fg2Made) + (fg3Attempted - fg3Made);
    const missedFT = ftAttempted - ftMade;

    // Suma de factores positivos
    const positiveFactors = Number(stats.points || 0) + 
                            Number(stats.offReb || stats.off_reb || stats.rebounds_offensive || 0) + 
                            Number(stats.defReb || stats.def_reb || stats.rebounds_defensive || 0) + 
                            Number(stats.assists || 0) + 
                            Number(stats.steals || 0) + 
                            Number(stats.blocksMade || stats.blocks_made || 0) + 
                            Number(stats.foulsDrawn || stats.fouls_drawn || 0);

    // Suma de factores negativos (errores y penalizaciones)
    const negativeFactors = missedFG + missedFT + 
                            Number(stats.turnovers || 0) + 
                            Number(stats.blocksReceived || stats.blocks_received || 0) + 
                            Number(stats.foulsCommitted || stats.fouls_committed || 0);

    return positiveFactors - negativeFactors;
  }

  /**
   * Calcula el Game Score (Métrica de impacto directo creada por John Hollinger).
   * Da una estimación ponderada similar a los puntos producidos en un partido.
   * Un valor de 10 es un partido medio aceptable; 40+ es una actuación estelar.
   * 
   * Fórmula del diccionario:
   * PTS + 0.4*FGM - 0.7*FGA - 0.4*(FTA - FTM) + 0.7*ORB + 0.3*DRB + STL + 0.7*AST + 0.7*BLK - 0.4*PF - TOV
   * 
   * @param {Object} stats - Objeto con estadísticas del partido.
   * @returns {number} Valor de Game Score con 1 decimal.
   */
  static calculateGameScore(stats = {}) {
    const fg2Made = Number(stats.fg2Made || stats.fg2_made || 0);
    const fg3Made = Number(stats.fg3Made || stats.fg3_made || 0);
    const fg2Attempted = Number(stats.fg2Attempted || stats.fg2_attempted || 0);
    const fg3Attempted = Number(stats.fg3Attempted || stats.fg3_attempted || 0);
    const ftMade = Number(stats.ftMade || stats.ft_made || 0);
    const ftAttempted = Number(stats.ftAttempted || stats.ft_attempted || 0);

    const fgm = fg2Made + fg3Made;
    const fga = fg2Attempted + fg3Attempted;

    const gameScore = Number(stats.points || 0) +
      (0.4 * fgm) -
      (0.7 * fga) -
      (0.4 * (ftAttempted - ftMade)) +
      (0.7 * Number(stats.offReb || stats.off_reb || stats.rebounds_offensive || 0)) +
      (0.3 * Number(stats.defReb || stats.def_reb || stats.rebounds_defensive || 0)) +
      Number(stats.steals || 0) +
      (0.7 * Number(stats.assists || 0)) +
      (0.7 * Number(stats.blocksMade || stats.blocks_made || 0)) -
      (0.4 * Number(stats.foulsCommitted || stats.fouls_committed || 0)) -
      Number(stats.turnovers || 0);

    return Number(gameScore.toFixed(1));
  }
}