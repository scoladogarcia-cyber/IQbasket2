/**
 * @fileoverview Calculador de Dominio: AdvancedPlayerStatsCalculator (Estadísticas Avanzadas de Jugador).
 * @description Implementa todas las métricas avanzadas del catálogo oficial
 * (`Diccionario_estadisticas_baloncesto_jugador_equipo.xlsx`) para jugadores individuales.
 * 
 * Incluye módulos de:
 * 1. Selección y Eficiencia de Tiro (eFG%, TS%, PP2, PP3, PPT, 3PAr, FTr, % Tiros Asistidos, Zonas).
 * 2. Creación y Manejo de Balón (AST/TOV, AST%, Puntos Creados por Asistencia).
 * 3. Posesión y Uso (Posesiones Individuales Estimadas, USG%, TOV%).
 * 4. Rebote Avanzado (ORB%, DRB%, TRB%).
 * 5. Defensa Avanzada (STL%, BLK%).
 * 6. Normalización e Impacto (PPM, Pts/40min, Reb/min, Ast/40min, Individual ORtg, Individual DRtg, Net Rating).
 * 
 * Reglas de diseño:
 * - Funciones puras e inmutables sin dependencias externas ni mutación de estado.
 * - Control defensivo estricto contra divisiones por cero (retorna 0 si denominador <= 0).
 * - Soporte indistinto para propiedades en camelCase o snake_case.
 */

export class AdvancedPlayerStatsCalculator {
  // =========================================================================
  // 1. EFICIENCIA Y SELECCIÓN DE TIRO (SHOOTING METRICS)
  // =========================================================================

  /**
   * Porcentaje de Tiro Efectivo (eFG% - Effective Field Goal Percentage).
   * Compensa el valor añadido del tiro de 3 puntos (+50% respecto al tiro de 2).
   * Fórmula del catálogo: (FGM + 0.5×3PM) / FGA × 100
   * 
   * @param {number} fg2Made - Canastas de 2 anotadas (2PM).
   * @param {number} fg3Made - Triples anotados (3PM).
   * @param {number} fg2Attempted - Tiros de 2 intentados (2PA).
   * @param {number} fg3Attempted - Triples intentados (3PA).
   * @returns {number} eFG% en porcentaje con 1 decimal.
   */
  static calculateEFG(fg2Made = 0, fg3Made = 0, fg2Attempted = 0, fg3Attempted = 0) {
    const fgm = Number(fg2Made || 0) + Number(fg3Made || 0);
    const fga = Number(fg2Attempted || 0) + Number(fg3Attempted || 0);
    if (fga <= 0) return 0;

    const efg = ((fgm + (0.5 * Number(fg3Made || 0))) / fga) * 100;
    return Number(efg.toFixed(1));
  }

  /**
   * Porcentaje de Tiro Verdadero (TS% - True Shooting Percentage).
   * Eficiencia absoluta de lanzamiento considerando tiros de campo y tiros libres.
   * Fórmula del catálogo: PTS / [2×(FGA + 0.44×FTA)] × 100
   * 
   * @param {number} pts - Puntos totales anotados.
   * @param {number} fga - Tiros de campo intentados (2PA + 3PA).
   * @param {number} fta - Tiros libres intentados (FTA).
   * @returns {number} TS% en porcentaje con 1 decimal.
   */
  static calculateTS(pts = 0, fga = 0, fta = 0) {
    const denominator = 2 * (Number(fga || 0) + (0.44 * Number(fta || 0)));
    if (denominator <= 0) return 0;

    const ts = (Number(pts || 0) / denominator) * 100;
    return Number(ts.toFixed(1));
  }

  /**
   * Puntos por Tiro de 2 Puntos Intentado (PP2).
   * Fórmula del catálogo: (2×2PM) / 2PA
   * 
   * @param {number} fg2Made - 2PM.
   * @param {number} fg2Attempted - 2PA.
   * @returns {number} Puntos por intento con 2 decimales.
   */
  static calculatePP2(fg2Made = 0, fg2Attempted = 0) {
    const att = Number(fg2Attempted || 0);
    if (att <= 0) return 0;
    return Number(((2 * Number(fg2Made || 0)) / att).toFixed(2));
  }

  /**
   * Puntos por Intento de Triple (PP3).
   * Fórmula del catálogo: (3×3PM) / 3PA
   * 
   * @param {number} fg3Made - 3PM.
   * @param {number} fg3Attempted - 3PA.
   * @returns {number} Puntos por intento con 2 decimales.
   */
  static calculatePP3(fg3Made = 0, fg3Attempted = 0) {
    const att = Number(fg3Attempted || 0);
    if (att <= 0) return 0;
    return Number(((3 * Number(fg3Made || 0)) / att).toFixed(2));
  }

  /**
   * Puntos por Tiro de Campo Intentado (PPT).
   * Fórmula del catálogo: (2×2PM + 3×3PM) / FGA
   * 
   * @param {number} fg2Made - 2PM.
   * @param {number} fg3Made - 3PM.
   * @param {number} fga - FGA (2PA + 3PA).
   * @returns {number} Puntos por tiro de campo con 2 decimales.
   */
  static calculatePPT(fg2Made = 0, fg3Made = 0, fga = 0) {
    const totalFga = Number(fga || 0);
    if (totalFga <= 0) return 0;
    const ptsCampo = (2 * Number(fg2Made || 0)) + (3 * Number(fg3Made || 0));
    return Number((ptsCampo / totalFga).toFixed(2));
  }

  /**
   * Tasa de Intento de Triple (3PAr - Three-Point Attempt Rate).
   * Mide qué porcentaje de los tiros de campo del jugador son triples.
   * Fórmula del catálogo: 3PA / FGA × 100
   * 
   * @param {number} fg3Attempted - 3PA.
   * @param {number} fga - FGA.
   * @returns {number} Porcentaje con 1 decimal.
   */
  static calculate3PAr(fg3Attempted = 0, fga = 0) {
    const totalFga = Number(fga || 0);
    if (totalFga <= 0) return 0;
    return Number(((Number(fg3Attempted || 0) / totalFga) * 100).toFixed(1));
  }

  /**
   * Tasa de Tiro Libre (FTr - Free Throw Rate).
   * Capacidad del jugador para forzar lanzamientos desde la línea de personal.
   * Fórmula del catálogo (convención principal): FTA / FGA
   * 
   * @param {number} ftAttempted - FTA.
   * @param {number} fga - FGA.
   * @returns {number} Ratio con 2 decimales.
   */
  static calculateFTr(ftAttempted = 0, fga = 0) {
    const totalFga = Number(fga || 0);
    if (totalFga <= 0) return 0;
    return Number((Number(ftAttempted || 0) / totalFga).toFixed(2));
  }

  /**
   * Porcentaje de Tiros de Campo Anotados Asistidos (% Assisted FGM).
   * Proporción de canastas del jugador que proceden de un pase decisivo de un compañero.
   * Fórmula del catálogo: FGM_asistidos / FGM × 100
   * 
   * @param {number} assistedFGM - Canastas convertidas tras asistencia.
   * @param {number} totalFGM - FGM total.
   * @returns {number} Porcentaje con 1 decimal.
   */
  static calculateAssistedFGMPercentage(assistedFGM = 0, totalFGM = 0) {
    const fgm = Number(totalFGM || 0);
    if (fgm <= 0) return 0;
    return Number(((Number(assistedFGM || 0) / fgm) * 100).toFixed(1));
  }

  // =========================================================================
  // 2. CREACIÓN Y GENERACIÓN DE JUEGO
  // =========================================================================

  /**
   * Ratio Asistencia / Pérdida (AST/TOV).
   * Evalúa la seguridad del jugador en la distribución del balón.
   * Fórmula del catálogo: AST / TOV
   * 
   * @param {number} assists - Asistencias (AST).
   * @param {number} turnovers - Pérdidas (TOV).
   * @returns {number} Ratio con 2 decimales. Si TOV es 0, retorna AST.
   */
  static calculateAstTovRatio(assists = 0, turnovers = 0) {
    const tov = Number(turnovers || 0);
    const ast = Number(assists || 0);
    if (tov <= 0) return ast;
    return Number((ast / tov).toFixed(2));
  }

  /**
   * Puntos Generados por Asistencias.
   * Cuantifica la anotación directa propiciada por los pases del jugador.
   * Fórmula del catálogo: 2×AST_a_canasta_2 + 3×AST_a_triple
   * 
   * @param {number} ast2p - Asistencias que terminaron en canasta de 2.
   * @param {number} ast3p - Asistencias que terminaron en triple.
   * @returns {number} Puntos totales generados.
   */
  static calculatePointsCreatedByAssists(ast2p = 0, ast3p = 0) {
    return (2 * Number(ast2p || 0)) + (3 * Number(ast3p || 0));
  }

  /**
   * Porcentaje de Asistencias (AST% - Assist Percentage).
   * Estima el porcentaje de canastas de campo de sus compañeros que el jugador asistió mientras estuvo en pista.
   * Fórmula del catálogo: 100×AST / {[(MIN / (MIN_eq/5)) × FGM_eq] − FGM_jugador}
   * 
   * @param {number} playerAst - Asistencias del jugador.
   * @param {number} playerMin - Minutos disputados por el jugador.
   * @param {number} playerFgm - FGM del jugador.
   * @param {number} teamFgm - FGM total del equipo.
   * @param {number} [teamMin=200] - Minutos totales del equipo (200 en 40 min).
   * @returns {number} AST% con 1 decimal.
   */
  static calculateAssistPercentage(playerAst = 0, playerMin = 0, playerFgm = 0, teamFgm = 0, teamMin = 200) {
    const minJ = Number(playerMin || 0);
    if (minJ <= 0) return 0;

    const teamMinutes = Number(teamMin || 200);
    const denominator = ((minJ / (teamMinutes / 5)) * Number(teamFgm || 0)) - Number(playerFgm || 0);
    if (denominator <= 0) return 0;

    const astPct = (100 * Number(playerAst || 0)) / denominator;
    return Number(astPct.toFixed(1));
  }

  // =========================================================================
  // 3. POSESIÓN Y TASA DE USO (USAGE RATE)
  // =========================================================================

  /**
   * Posesiones Individuales Estimadas.
   * Cuantifica las posesiones finalizadas directamente por el jugador.
   * Fórmula del catálogo: FGA + 0.44×FTA + TOV − ORB (versión individual estándar)
   * 
   * @param {number} fga - FGA (2PA + 3PA).
   * @param {number} fta - FTA.
   * @param {number} tov - TOV.
   * @param {number} [orb=0] - Rebotes ofensivos.
   * @returns {number} Posesiones estimadas con 1 decimal.
   */
  static calculateIndividualPossessions(fga = 0, fta = 0, tov = 0, orb = 0) {
    const poss = Number(fga || 0) + (0.44 * Number(fta || 0)) + Number(tov || 0) - Number(orb || 0);
    return Number(Math.max(0, poss).toFixed(1));
  }

  /**
   * Porcentaje de Uso (USG% - Usage Percentage).
   * Proporción de posesiones del equipo que finaliza el jugador mientras está en pista.
   * Fórmula del catálogo:
   * 100 × [(FGA_j + 0.44×FTA_j + TOV_j) × (MIN_eq / 5)] / [MIN_j × (FGA_eq + 0.44×FTA_eq + TOV_eq)]
   * 
   * @param {Object} playerStats - Estadísticas individuales (fga, fta, tov).
   * @param {Object} teamStats - Estadísticas de equipo (fga, fta, tov).
   * @param {number} playerMinutes - Minutos jugados por el jugador.
   * @param {number} [teamMinutes=200] - Minutos totales disputados por el equipo.
   * @returns {number} USG% con 1 decimal.
   */
  static calculateUsageRate(playerStats = {}, teamStats = {}, playerMinutes = 0, teamMinutes = 200) {
    const minJ = Number(playerMinutes || 0);
    if (minJ <= 0) return 0;

    const pFga = Number(playerStats.fg2Attempted ?? playerStats.fg2_attempted ?? 0) +
                 Number(playerStats.fg3Attempted ?? playerStats.fg3_attempted ?? 0);
    const pFta = Number(playerStats.ftAttempted ?? playerStats.ft_attempted ?? 0);
    const pTov = Number(playerStats.turnovers ?? playerStats.tov ?? 0);
    const playerPlays = pFga + (0.44 * pFta) + pTov;

    const tFga = Number(teamStats.fg2Attempted ?? teamStats.fg2_attempted ?? teamStats.fga ?? 0) +
                 Number(teamStats.fg3Attempted ?? teamStats.fg3_attempted ?? 0);
    const tFta = Number(teamStats.ftAttempted ?? teamStats.ft_attempted ?? teamStats.fta ?? 0);
    const tTov = Number(teamStats.turnovers ?? teamStats.tov ?? 0);
    const teamPlays = tFga + (0.44 * tFta) + tTov;

    const teamMin = Number(teamMinutes || 200);
    const denominator = minJ * teamPlays;
    if (denominator <= 0) return 0;

    const usg = 100 * ((playerPlays * (teamMin / 5)) / denominator);
    return Number(usg.toFixed(1));
  }

  /**
   * Porcentaje de Pérdidas Individual (TOV% - Turnover Percentage).
   * Número de pérdidas de balón cometidas por cada 100 jugadas individuales intentadas.
   * Fórmula del catálogo: TOV / (FGA + 0.44×FTA + TOV) × 100
   * 
   * @param {number} turnovers - TOV.
   * @param {number} fga - FGA.
   * @param {number} fta - FTA.
   * @returns {number} TOV% con 1 decimal.
   */
  static calculateTurnoverPercentage(turnovers = 0, fga = 0, fta = 0) {
    const tov = Number(turnovers || 0);
    const plays = Number(fga || 0) + (0.44 * Number(fta || 0)) + tov;
    if (plays <= 0) return 0;
    return Number(((tov / plays) * 100).toFixed(1));
  }

  // =========================================================================
  // 4. TASAS DE REBOTE AVANZADAS (REBOUND PERCENTAGES)
  // =========================================================================

  /**
   * Porcentaje de Rebote Ofensivo Individual (ORB%).
   * Proporción de rebotes ofensivos disponibles capturados por el jugador en pista.
   * Fórmula del catálogo: 100×ORB × (MIN_eq / 5) / [MIN_j × (ORB_eq + DRB_rival)]
   * 
   * @param {number} playerOrb - ORB del jugador.
   * @param {number} playerMin - Minutos del jugador.
   * @param {number} teamOrb - ORB de su equipo.
   * @param {number} oppDrb - DRB del equipo rival.
   * @param {number} [teamMin=200] - Minutos de equipo.
   * @returns {number} ORB% con 1 decimal.
   */
  static calculateORBPercentage(playerOrb = 0, playerMin = 0, teamOrb = 0, oppDrb = 0, teamMin = 200) {
    const minJ = Number(playerMin || 0);
    const totalAvail = Number(teamOrb || 0) + Number(oppDrb || 0);
    if (minJ <= 0 || totalAvail <= 0) return 0;

    const orbPct = (100 * Number(playerOrb || 0) * (Number(teamMin || 200) / 5)) / (minJ * totalAvail);
    return Number(orbPct.toFixed(1));
  }

  /**
   * Porcentaje de Rebote Defensivo Individual (DRB%).
   * Proporción de rebotes defensivos disponibles capturados por el jugador en pista.
   * Fórmula del catálogo: 100×DRB × (MIN_eq / 5) / [MIN_j × (DRB_eq + ORB_rival)]
   * 
   * @param {number} playerDrb - DRB del jugador.
   * @param {number} playerMin - Minutos del jugador.
   * @param {number} teamDrb - DRB de su equipo.
   * @param {number} oppOrb - ORB del equipo rival.
   * @param {number} [teamMin=200] - Minutos de equipo.
   * @returns {number} DRB% con 1 decimal.
   */
  static calculateDRBPercentage(playerDrb = 0, playerMin = 0, teamDrb = 0, oppOrb = 0, teamMin = 200) {
    const minJ = Number(playerMin || 0);
    const totalAvail = Number(teamDrb || 0) + Number(oppOrb || 0);
    if (minJ <= 0 || totalAvail <= 0) return 0;

    const drbPct = (100 * Number(playerDrb || 0) * (Number(teamMin || 200) / 5)) / (minJ * totalAvail);
    return Number(drbPct.toFixed(1));
  }

  /**
   * Porcentaje de Rebote Total Individual (TRB%).
   * Proporción de rebotes totales capturados por el jugador mientras estuvo en cancha.
   * Fórmula del catálogo: 100×TRB × (MIN_eq / 5) / [MIN_j × (TRB_eq + TRB_rival)]
   * 
   * @param {number} playerTrb - TRB del jugador.
   * @param {number} playerMin - Minutos del jugador.
   * @param {number} teamTrb - TRB de su equipo.
   * @param {number} oppTrb - TRB del rival.
   * @param {number} [teamMin=200] - Minutos de equipo.
   * @returns {number} TRB% con 1 decimal.
   */
  static calculateTRBPercentage(playerTrb = 0, playerMin = 0, teamTrb = 0, oppTrb = 0, teamMin = 200) {
    const minJ = Number(playerMin || 0);
    const totalAvail = Number(teamTrb || 0) + Number(oppTrb || 0);
    if (minJ <= 0 || totalAvail <= 0) return 0;

    const trbPct = (100 * Number(playerTrb || 0) * (Number(teamMin || 200) / 5)) / (minJ * totalAvail);
    return Number(trbPct.toFixed(1));
  }

  // =========================================================================
  // 5. DEFENSA AVANZADA (STEAL & BLOCK PERCENTAGES)
  // =========================================================================

  /**
   * Porcentaje de Robos (STL% - Steal Percentage).
   * Proporción de posesiones defensivas del rival que terminan en robo del jugador.
   * Fórmula del catálogo: 100×STL × (MIN_eq / 5) / (MIN_j × POSS_rival)
   * 
   * @param {number} playerStl - Robos del jugador.
   * @param {number} playerMin - Minutos del jugador.
   * @param {number} oppPoss - Posesiones totales disputadas por el rival.
   * @param {number} [teamMin=200] - Minutos de equipo.
   * @returns {number} STL% con 1 decimal.
   */
  static calculateStealPercentage(playerStl = 0, playerMin = 0, oppPoss = 0, teamMin = 200) {
    const minJ = Number(playerMin || 0);
    const rivalPoss = Number(oppPoss || 0);
    if (minJ <= 0 || rivalPoss <= 0) return 0;

    const stlPct = (100 * Number(playerStl || 0) * (Number(teamMin || 200) / 5)) / (minJ * rivalPoss);
    return Number(stlPct.toFixed(1));
  }

  /**
   * Porcentaje de Tapones (BLK% - Block Percentage).
   * Proporción de tiros de 2 del rival taponados por el jugador mientras está en pista.
   * Fórmula del catálogo: 100×BLK × (MIN_eq / 5) / [MIN_j × 2PA_rival]
   * 
   * @param {number} playerBlk - Tapones realizados por el jugador.
   * @param {number} playerMin - Minutos del jugador.
   * @param {number} opp2PA - Tiros de 2 intentados por el rival.
   * @param {number} [teamMin=200] - Minutos de equipo.
   * @returns {number} BLK% con 1 decimal.
   */
  static calculateBlockPercentage(playerBlk = 0, playerMin = 0, opp2PA = 0, teamMin = 200) {
    const minJ = Number(playerMin || 0);
    const rival2pa = Number(opp2PA || 0);
    if (minJ <= 0 || rival2pa <= 0) return 0;

    const blkPct = (100 * Number(playerBlk || 0) * (Number(teamMin || 200) / 5)) / (minJ * rival2pa);
    return Number(blkPct.toFixed(1));
  }

  // =========================================================================
  // 6. NORMALIZACIÓN DE PRODUCCIÓN E IMPACTO INDIVIDUAL
  // =========================================================================

  /**
   * Puntos por Minuto (PPM).
   * Fórmula del catálogo: PTS / MIN
   * 
   * @param {number} pts - Puntos totales.
   * @param {number} minutes - Minutos jugados.
   * @returns {number} Valor con 2 decimales.
   */
  static calculatePPM(pts = 0, minutes = 0) {
    const min = Number(minutes || 0);
    if (min <= 0) return 0;
    return Number((Number(pts || 0) / min).toFixed(2));
  }

  /**
   * Proyección de Puntos a 40 Minutos (PTS / 40 min).
   * Normaliza la producción anotadora para comparar jugadores con distinto minutaje.
   * Fórmula del catálogo: (PTS / MIN) × 40
   * 
   * @param {number} pts - Puntos totales.
   * @param {number} minutes - Minutos jugados.
   * @returns {number} Valor con 1 decimal.
   */
  static calculatePointsPer40(pts = 0, minutes = 0) {
    const min = Number(minutes || 0);
    if (min <= 0) return 0;
    return Number(((Number(pts || 0) / min) * 40).toFixed(1));
  }

  /**
   * Proyección de Rebotes a 40 Minutos (TRB / 40 min).
   * Fórmula del catálogo: (TRB / MIN) × 40
   * 
   * @param {number} trb - Rebotes totales.
   * @param {number} minutes - Minutos jugados.
   * @returns {number} Valor con 1 decimal.
   */
  static calculateReboundsPer40(trb = 0, minutes = 0) {
    const min = Number(minutes || 0);
    if (min <= 0) return 0;
    return Number(((Number(trb || 0) / min) * 40).toFixed(1));
  }

  /**
   * Proyección de Asistencias a 40 Minutos (AST / 40 min).
   * Fórmula del catálogo: (AST / MIN) × 40
   * 
   * @param {number} ast - Asistencias totales.
   * @param {number} minutes - Minutos jugados.
   * @returns {number} Valor con 1 decimal.
   */
  static calculateAssistsPer40(ast = 0, minutes = 0) {
    const min = Number(minutes || 0);
    if (min <= 0) return 0;
    return Number(((Number(ast || 0) / min) * 40).toFixed(1));
  }

  /**
   * Rating Ofensivo Individual Estimado (Individual ORtg).
   * Puntos producidos por cada 100 posesiones individuales agotadas.
   * Fórmula del catálogo: 100 × Puntos Producidos / Posesiones Individuales
   * 
   * @param {number} pts - Puntos anotados.
   * @param {number} fga - FGA.
   * @param {number} fta - FTA.
   * @param {number} tov - TOV.
   * @returns {number} ORtg con 1 decimal.
   */
  static calculateIndividualORtg(pts = 0, fga = 0, fta = 0, tov = 0) {
    const indPoss = this.calculateIndividualPossessions(fga, fta, tov);
    if (indPoss <= 0) return 0;
    return Number(((Number(pts || 0) / indPoss) * 100).toFixed(1));
  }

  // =========================================================================
  // 7. OBJETO CONSOLIDADO DE ESTADÍSTICAS AVANZADAS DEL JUGADOR
  // =========================================================================

  /**
   * Genera el set completo de analítica avanzada para el perfil de un jugador.
   * Cruza datos individuales con el contexto del equipo y rival.
   * 
   * @param {Object} playerStats - Estadísticas individuales del jugador.
   * @param {Object} [teamStats={}] - Estadísticas colectivas de su equipo.
   * @param {Object} [oppStats={}] - Estadísticas colectivas del rival.
   * @param {number} [playerMinutes=0] - Minutos reales disputados.
   * @param {number} [teamMinutes=200] - Minutos de equipo.
   * @returns {Object} Reporte avanzado consolidado.
   */
  static generateAdvancedPlayerReport(playerStats = {}, teamStats = {}, oppStats = {}, playerMinutes = 0, teamMinutes = 200) {
    const fg2m = Number(playerStats.fg2Made ?? playerStats.fg2_made ?? 0);
    const fg2a = Number(playerStats.fg2Attempted ?? playerStats.fg2_attempted ?? 0);
    const fg3m = Number(playerStats.fg3Made ?? playerStats.fg3_made ?? 0);
    const fg3a = Number(playerStats.fg3Attempted ?? playerStats.fg3_attempted ?? 0);
    const ftm = Number(playerStats.ftMade ?? playerStats.ft_made ?? 0);
    const fta = Number(playerStats.ftAttempted ?? playerStats.ft_attempted ?? 0);
    const fgm = fg2m + fg3m;
    const fga = fg2a + fg3a;
    const pts = Number(playerStats.points ?? playerStats.pts ?? ((2 * fg2m) + (3 * fg3m) + ftm));
    const ast = Number(playerStats.assists ?? playerStats.ast ?? 0);
    const tov = Number(playerStats.turnovers ?? playerStats.tov ?? 0);
    const stl = Number(playerStats.steals ?? playerStats.stl ?? 0);
    const blk = Number(playerStats.blocksMade ?? playerStats.blocks_made ?? playerStats.blk ?? 0);
    const orb = Number(playerStats.offReb ?? playerStats.off_reb ?? 0);
    const drb = Number(playerStats.defReb ?? playerStats.def_reb ?? 0);
    const trb = orb + drb;

    const min = Number(playerMinutes || playerStats.minutes || 0);

    return {
      playerId: playerStats.playerId ?? playerStats.player_id ?? null,
      minutes: min,
      eFG: this.calculateEFG(fg2m, fg3m, fg2a, fg3a),
      ts: this.calculateTS(pts, fga, fta),
      pp2: this.calculatePP2(fg2m, fg2a),
      pp3: this.calculatePP3(fg3m, fg3a),
      ppt: this.calculatePPT(fg2m, fg3m, fga),
      threePointAttemptRate: this.calculate3PAr(fg3a, fga),
      freeThrowRate: this.calculateFTr(fta, fga),
      astTovRatio: this.calculateAstTovRatio(ast, tov),
      individualPossessions: this.calculateIndividualPossessions(fga, fta, tov, orb),
      usageRate: this.calculateUsageRate(playerStats, teamStats, min, teamMinutes),
      turnoverPct: this.calculateTurnoverPercentage(tov, fga, fta),
      orbPct: this.calculateORBPercentage(orb, min, teamStats.offReb ?? teamStats.off_reb ?? 0, oppStats.defReb ?? oppStats.def_reb ?? 0, teamMinutes),
      drbPct: this.calculateDRBPercentage(drb, min, teamStats.defReb ?? teamStats.def_reb ?? 0, oppStats.offReb ?? oppStats.off_reb ?? 0, teamMinutes),
      trbPct: this.calculateTRBPercentage(trb, min, teamStats.totalRebounds ?? teamStats.trb ?? 0, oppStats.totalRebounds ?? oppStats.trb ?? 0, teamMinutes),
      stlPct: this.calculateStealPercentage(stl, min, oppStats.possessions ?? oppStats.poss ?? 0, teamMinutes),
      blkPct: this.calculateBlockPercentage(blk, min, oppStats.fg2Attempted ?? oppStats.fg2_attempted ?? 0, teamMinutes),
      ppm: this.calculatePPM(pts, min),
      ptsPer40: this.calculatePointsPer40(pts, min),
      rebPer40: this.calculateReboundsPer40(trb, min),
      astPer40: this.calculateAssistsPer40(ast, min),
      individualORtg: this.calculateIndividualORtg(pts, fga, fta, tov)
    };
  }
}