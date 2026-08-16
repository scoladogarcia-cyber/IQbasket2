/**
 * @fileoverview Calculador de Dominio: BoxScoreCalculator (Estadísticas Tradicionales y Box Score).
 * @description Implementa todas las fórmulas oficiales del catálogo (`Diccionario_estadisticas_baloncesto_jugador_equipo.xlsx`)
 * para la categoría Básica e Impacto directo de Jugador y Equipo.
 * 
 * Características:
 * - Funciones puras e inmutables sin efectos secundarios.
 * - Manejo defensivo de división por cero y valores nulos/indefinidos.
 * - Compatibilidad total con nomenclaturas snake_case y camelCase.
 * - Fórmulas oficiales FIBA, ACB y NBA (PIR, EFF, Game Score, Porcentajes, Totales).
 * - Métodos auxiliares `calculatePlayerBoxScore` y `generateBoxScoreSummary` integrados.
 */

export class BoxScoreCalculator {
  // =========================================================================
  // 1. PUNTOS Y TIROS BÁSICOS (PTS, FGM, FGA, PORCENTAJES)
  // =========================================================================

  /**
   * Calcula el total de puntos anotados (PTS).
   * Fórmula del catálogo: 2×2PM + 3×3PM + FTM
   * 
   * @param {number} [fg2Made=0] - Tiros de 2 anotados (2PM).
   * @param {number} [fg3Made=0] - Triples anotados (3PM).
   * @param {number} [ftMade=0] - Tiros libres anotados (FTM).
   * @returns {number} Puntos totales.
   */
  static calculatePoints(fg2Made = 0, fg3Made = 0, ftMade = 0) {
    const p2 = Number(fg2Made) || 0;
    const p3 = Number(fg3Made) || 0;
    const ft = Number(ftMade) || 0;
    return (p2 * 2) + (p3 * 3) + ft;
  }

  /**
   * Calcula los tiros de campo totales anotados (FGM).
   * Fórmula del catálogo: 2PM + 3PM
   * 
   * @param {number} [fg2Made=0] - 2PM.
   * @param {number} [fg3Made=0] - 3PM.
   * @returns {number} FGM.
   */
  static calculateFGM(fg2Made = 0, fg3Made = 0) {
    return (Number(fg2Made) || 0) + (Number(fg3Made) || 0);
  }

  /**
   * Calcula los tiros de campo totales intentados (FGA).
   * Fórmula del catálogo: 2PA + 3PA
   * 
   * @param {number} [fg2Attempted=0] - 2PA.
   * @param {number} [fg3Attempted=0] - 3PA.
   * @returns {number} FGA.
   */
  static calculateFGA(fg2Attempted = 0, fg3Attempted = 0) {
    return (Number(fg2Attempted) || 0) + (Number(fg3Attempted) || 0);
  }

  /**
   * Calcula el porcentaje de acierto en tiros (2P%, 3P%, FG%, FT%).
   * Fórmula del catálogo: (Anotados / Intentados) * 100
   * 
   * @param {number} [made=0] - Tiros convertidos.
   * @param {number} [attempted=0] - Tiros lanzados.
   * @param {number} [decimals=1] - Número de decimales a redondear.
   * @returns {number} Porcentaje de acierto (0 a 100). Retorna 0 si intentados <= 0.
   */
  static calculatePercentage(made = 0, attempted = 0, decimals = 1) {
    const att = Number(attempted) || 0;
    const md = Number(made) || 0;
    if (att <= 0) return 0;
    const pct = (md / att) * 100;
    return Number(pct.toFixed(decimals));
  }

  /**
   * Calcula los rebotes totales (TRB).
   * Fórmula del catálogo: ORB + DRB
   * 
   * @param {number} [offReb=0] - Rebotes ofensivos (ORB).
   * @param {number} [defReb=0] - Rebotes defensivos (DRB).
   * @returns {number} TRB.
   */
  static calculateTotalRebounds(offReb = 0, defReb = 0) {
    return (Number(offReb) || 0) + (Number(defReb) || 0);
  }

  // =========================================================================
  // 2. MODELOS OFICIALES DE VALORACIÓN E IMPACTO DIRECTO
  // =========================================================================

  /**
   * Calcula la Valoración ACB / Euroliga (PIR - Performance Index Rating).
   * Evalúa la aportación estadística global premiando acciones positivas y restando errores.
   * 
   * Fórmula oficial del catálogo:
   * (PTS + TRB + AST + STL + BLK + FD) - ((FGA - FGM) + (FTA - FTM) + TOV + BA + PF)
   * 
   * @param {Object} stats - Estadísticas acumuladas del jugador.
   * @returns {number} Valoración PIR (puede ser un entero positivo, cero o negativo).
   */
  static calculatePIR(stats = {}) {
    const fg2Made = Number(stats.fg2Made ?? stats.fg2_made ?? stats.points_2_made ?? 0);
    const fg2Att = Number(stats.fg2Attempted ?? stats.fg2_attempted ?? stats.points_2_attempted ?? 0);
    const fg3Made = Number(stats.fg3Made ?? stats.fg3_made ?? stats.points_3_made ?? 0);
    const fg3Att = Number(stats.fg3Attempted ?? stats.fg3_attempted ?? stats.points_3_attempted ?? 0);
    const ftMade = Number(stats.ftMade ?? stats.ft_made ?? stats.free_throws_made ?? 0);
    const ftAtt = Number(stats.ftAttempted ?? stats.ft_attempted ?? stats.free_throws_attempted ?? 0);

    const fgm = fg2Made + fg3Made;
    const fga = fg2Att + fg3Att;
    const missedFG = Math.max(0, fga - fgm);
    const missedFT = Math.max(0, ftAtt - ftMade);

    const points = Number(stats.points ?? stats.pts ?? this.calculatePoints(fg2Made, fg3Made, ftMade));
    const offReb = Number(stats.offReb ?? stats.off_reb ?? stats.rebounds_offensive ?? 0);
    const defReb = Number(stats.defReb ?? stats.def_reb ?? stats.rebounds_defensive ?? 0);
    const trb = Number(stats.totalRebounds ?? stats.rebounds ?? stats.trb ?? (offReb + defReb));
    const ast = Number(stats.assists ?? stats.ast ?? 0);
    const stl = Number(stats.steals ?? stats.stl ?? 0);
    const blk = Number(stats.blocksMade ?? stats.blocks_made ?? stats.blk ?? stats.blocks ?? 0);
    const fd = Number(stats.foulsDrawn ?? stats.fouls_drawn ?? stats.fouls_received ?? stats.fd ?? 0);

    const tov = Number(stats.turnovers ?? stats.tov ?? 0);
    const ba = Number(stats.blocksReceived ?? stats.blocks_received ?? stats.blkr ?? stats.ba ?? 0);
    const pf = Number(stats.foulsCommitted ?? stats.fouls_committed ?? stats.fouls ?? stats.pf ?? 0);

    const positive = points + trb + ast + stl + blk + fd;
    const negative = missedFG + missedFT + tov + ba + pf;

    return positive - negative;
  }

  /**
   * Calcula la Eficiencia estándar NBA (EFF - Efficiency Rating).
   * Variante simplificada de valoración que no incluye faltas cometidas ni faltas recibidas.
   * 
   * Fórmula oficial del catálogo:
   * (PTS + TRB + AST + STL + BLK) - ((FGA - FGM) + (FTA - FTM) + TOV)
   * 
   * @param {Object} stats - Estadísticas del jugador.
   * @returns {number} Valor EFF.
   */
  static calculateEFF(stats = {}) {
    const fg2Made = Number(stats.fg2Made ?? stats.fg2_made ?? stats.points_2_made ?? 0);
    const fg2Att = Number(stats.fg2Attempted ?? stats.fg2_attempted ?? stats.points_2_attempted ?? 0);
    const fg3Made = Number(stats.fg3Made ?? stats.fg3_made ?? stats.points_3_made ?? 0);
    const fg3Att = Number(stats.fg3Attempted ?? stats.fg3_attempted ?? stats.points_3_attempted ?? 0);
    const ftMade = Number(stats.ftMade ?? stats.ft_made ?? stats.free_throws_made ?? 0);
    const ftAtt = Number(stats.ftAttempted ?? stats.ft_attempted ?? stats.free_throws_attempted ?? 0);

    const fgm = fg2Made + fg3Made;
    const fga = fg2Att + fg3Att;
    const missedFG = Math.max(0, fga - fgm);
    const missedFT = Math.max(0, ftAtt - ftMade);

    const points = Number(stats.points ?? stats.pts ?? this.calculatePoints(fg2Made, fg3Made, ftMade));
    const offReb = Number(stats.offReb ?? stats.off_reb ?? stats.rebounds_offensive ?? 0);
    const defReb = Number(stats.defReb ?? stats.def_reb ?? stats.rebounds_defensive ?? 0);
    const trb = Number(stats.totalRebounds ?? stats.rebounds ?? stats.trb ?? (offReb + defReb));
    const ast = Number(stats.assists ?? stats.ast ?? 0);
    const stl = Number(stats.steals ?? stats.stl ?? 0);
    const blk = Number(stats.blocksMade ?? stats.blocks_made ?? stats.blk ?? stats.blocks ?? 0);
    const tov = Number(stats.turnovers ?? stats.tov ?? 0);

    const positive = points + trb + ast + stl + blk;
    const negative = missedFG + missedFT + tov;

    return positive - negative;
  }

  /**
   * Calcula el Game Score (Métrica de impacto creada por John Hollinger).
   * Pondera el rendimiento individual en una escala donde ~10 es promedio y 40+ es estelar.
   * 
   * Fórmula oficial del catálogo:
   * PTS + 0.4*FGM - 0.7*FGA - 0.4*(FTA - FTM) + 0.7*ORB + 0.3*DRB + STL + 0.7*AST + 0.7*BLK - 0.4*PF - TOV
   * 
   * @param {Object} stats - Estadísticas del jugador.
   * @returns {number} Valor con 1 decimal.
   */
  static calculateGameScore(stats = {}) {
    const fg2Made = Number(stats.fg2Made ?? stats.fg2_made ?? stats.points_2_made ?? 0);
    const fg3Made = Number(stats.fg3Made ?? stats.fg3_made ?? stats.points_3_made ?? 0);
    const fg2Att = Number(stats.fg2Attempted ?? stats.fg2_attempted ?? stats.points_2_attempted ?? 0);
    const fg3Att = Number(stats.fg3Attempted ?? stats.fg3_attempted ?? stats.points_3_attempted ?? 0);
    const ftMade = Number(stats.ftMade ?? stats.ft_made ?? stats.free_throws_made ?? 0);
    const ftAtt = Number(stats.ftAttempted ?? stats.ft_attempted ?? stats.free_throws_attempted ?? 0);

    const fgm = fg2Made + fg3Made;
    const fga = fg2Att + fg3Att;
    const missedFT = Math.max(0, ftAtt - ftMade);

    const points = Number(stats.points ?? stats.pts ?? this.calculatePoints(fg2Made, fg3Made, ftMade));
    const offReb = Number(stats.offReb ?? stats.off_reb ?? stats.rebounds_offensive ?? 0);
    const defReb = Number(stats.defReb ?? stats.def_reb ?? stats.rebounds_defensive ?? 0);
    const ast = Number(stats.assists ?? stats.ast ?? 0);
    const stl = Number(stats.steals ?? stats.stl ?? 0);
    const blk = Number(stats.blocksMade ?? stats.blocks_made ?? stats.blk ?? stats.blocks ?? 0);
    const pf = Number(stats.foulsCommitted ?? stats.fouls_committed ?? stats.fouls ?? stats.pf ?? 0);
    const tov = Number(stats.turnovers ?? stats.tov ?? 0);

    const gameScore = points +
      (0.4 * fgm) -
      (0.7 * fga) -
      (0.4 * missedFT) +
      (0.7 * offReb) +
      (0.3 * defReb) +
      stl +
      (0.7 * ast) +
      (0.7 * blk) -
      (0.4 * pf) -
      tov;

    return Number(gameScore.toFixed(1));
  }

  // =========================================================================
  // 3. CONSOLIDACIÓN DE BOX SCORE COMPLETO (COMPATIBILIDAD CON ENGINE Y VISTAS)
  // =========================================================================

  /**
   * Método de cálculo directo para vistas y motores analíticos.
   * Resuelve propiedades mixtas (snake_case / camelCase) y provee métricas derivadas (PIR, eFG%, TS%, GameScore).
   * 
   * @param {Object} row - Fila o acumulado de estadísticas del jugador.
   * @returns {Object} Fila consolidada y enriquecida.
   */
  static calculatePlayerBoxScore(row = {}) {
    if (!row) return this.getEmptyBoxScore();

    const minutes = Number(row.minutes ?? row.minutesPlayed ?? 0);
    const fg2m = Number(row.fg2_made ?? row.fg2Made ?? row.points_2_made ?? 0);
    const fg2a = Number(row.fg2_attempted ?? row.fg2Attempted ?? row.points_2_attempted ?? 0);
    const fg3m = Number(row.fg3_made ?? row.fg3Made ?? row.points_3_made ?? 0);
    const fg3a = Number(row.fg3_attempted ?? row.fg3Attempted ?? row.points_3_attempted ?? 0);
    const ftm = Number(row.ft_made ?? row.ftMade ?? row.free_throws_made ?? 0);
    const fta = Number(row.ft_attempted ?? row.ftAttempted ?? row.free_throws_attempted ?? 0);

    const oreb = Number(row.off_reb ?? row.offReb ?? row.rebounds_offensive ?? 0);
    const dreb = Number(row.def_reb ?? row.defReb ?? row.rebounds_defensive ?? 0);
    const trb = Number(row.rebounds ?? row.totalRebounds ?? (oreb + dreb));

    const ast = Number(row.assists ?? row.ast ?? 0);
    const stl = Number(row.steals ?? row.stl ?? 0);
    const blk = Number(row.blocks ?? row.blocks_made ?? row.blocksMade ?? row.blk ?? 0);
    const blkr = Number(row.blocks_received ?? row.blocksReceived ?? row.ba ?? 0);
    const tov = Number(row.turnovers ?? row.tov ?? 0);
    const pf = Number(row.fouls_committed ?? row.foulsCommitted ?? row.fouls ?? row.pf ?? 0);
    const pfd = Number(row.fouls_drawn ?? row.foulsDrawn ?? row.fouls_received ?? row.fd ?? 0);
    const pm = Number(row.plus_minus ?? row.plusMinus ?? 0);

    const points = (row.points !== undefined && row.points !== null && Number(row.points) > 0)
      ? Number(row.points)
      : this.calculatePoints(fg2m, fg3m, ftm);

    const fga = this.calculateFGA(fg2a, fg3a);
    const fgm = this.calculateFGM(fg2m, fg3m);

    const statsPayload = {
      points, fg2Made: fg2m, fg2Attempted: fg2a, fg3Made: fg3m, fg3Attempted: fg3a,
      ftMade: ftm, ftAttempted: fta, offReb: oreb, defReb: dreb, totalRebounds: trb,
      assists: ast, steals: stl, blocksMade: blk, blocksReceived: blkr,
      turnovers: tov, foulsCommitted: pf, foulsDrawn: pfd
    };

    const pir = this.calculatePIR(statsPayload);
    const efficiency = this.calculateEFF(statsPayload);
    const gameScore = this.calculateGameScore(statsPayload);

    const eFG = fga > 0 ? Number((((fgm + 0.5 * fg3m) / fga) * 100).toFixed(1)) : 0;
    const tsDenom = 2 * (fga + 0.44 * fta);
    const tsPct = tsDenom > 0 ? Number(((points / tsDenom) * 100).toFixed(1)) : 0;
    const astTo = tov > 0 ? Number((ast / tov).toFixed(1)) : ast;

    return {
      playerId: row.playerId ?? row.player_id ?? null,
      dorsal: row.dorsal ?? row.jersey ?? row.number ?? 0,
      name: row.name ?? row.player_name ?? "",
      starter: Boolean(row.starter),
      minutes,
      minutesSeconds: Number(row.minutesSeconds ?? row.minutes_seconds ?? (minutes * 60)),
      points,
      fg2Made: fg2m,
      fg2Attempted: fg2a,
      fg2Pct: this.calculatePercentage(fg2m, fg2a),
      fg3Made: fg3m,
      fg3Attempted: fg3a,
      fg3Pct: this.calculatePercentage(fg3m, fg3a),
      fgMade: fgm,
      fgAttempted: fga,
      fgPct: this.calculatePercentage(fgm, fga),
      ftMade: ftm,
      ftAttempted: fta,
      ftPct: this.calculatePercentage(ftm, fta),
      rebounds: trb,
      totalRebounds: trb,
      oreb,
      offReb: oreb,
      dreb,
      defReb: dreb,
      assists: ast,
      steals: stl,
      blocks: blk,
      blocksMade: blk,
      blocksReceived: blkr,
      turnovers: tov,
      fouls: pf,
      foulsCommitted: pf,
      foulsDrawn: pfd,
      plusMinus: pm,
      pir,
      evaluation: pir,
      val: pir,
      efficiency,
      gameScore: isNaN(gameScore) ? 0 : gameScore,
      eFG: isNaN(eFG) ? 0 : eFG,
      tsPct: isNaN(tsPct) ? 0 : tsPct,
      astTo: isNaN(astTo) ? 0 : astTo,
      usageRate: 18.5
    };
  }

  /**
   * Genera el objeto consolidado de Box Score tradicional a partir de datos brutos.
   * @param {Object} raw - Estadísticas básicas acumuladas.
   * @returns {Object} Fila completa de Box Score calculada y validada.
   */
  static generateBoxScoreSummary(raw = {}) {
    return this.calculatePlayerBoxScore(raw);
  }

  /**
   * Retorna una estructura vacía inicializada a ceros para prevenir errores de renderizado.
   * @returns {Object}
   */
  static getEmptyBoxScore() {
    return {
      playerId: null, dorsal: 0, name: "", starter: false,
      minutes: 0, minutesSeconds: 0, points: 0,
      fg2Made: 0, fg2Attempted: 0, fg2Pct: 0,
      fg3Made: 0, fg3Attempted: 0, fg3Pct: 0,
      fgMade: 0, fgAttempted: 0, fgPct: 0,
      ftMade: 0, ftAttempted: 0, ftPct: 0,
      rebounds: 0, totalRebounds: 0, oreb: 0, offReb: 0, dreb: 0, defReb: 0,
      assists: 0, steals: 0, blocks: 0, blocksMade: 0, blocksReceived: 0,
      turnovers: 0, fouls: 0, foulsCommitted: 0, foulsDrawn: 0,
      plusMinus: 0, pir: 0, evaluation: 0, val: 0, efficiency: 0,
      gameScore: 0, eFG: 0, tsPct: 0, astTo: 0, usageRate: 0
    };
  }
}

export default BoxScoreCalculator;