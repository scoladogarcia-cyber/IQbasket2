/**
 * @fileoverview Calculador de Estadísticas Avanzadas Individuales de Jugador.
 * @description Métrica eFG% (% Tiro Efectivo), True Shooting (TS%), Ratio AST/TOV,
 * Posesiones Individuales y Porcentaje de Uso (USG%).
 */

export class AdvancedPlayerStatsCalculator {
  /**
   * Porcentaje de Tiro Efectivo (eFG% - Effective Field Goal Percentage).
   * Mide la eficacia de tiro ajustando el hecho de que el triple vale 1.5 veces más que el tiro libre/doble.
   * 
   * Fórmula del diccionario: (FGM + 0.5 * 3PM) / FGA * 100
   * 
   * @param {number} fg2Made - Tiros de 2 anotados.
   * @param {number} fg3Made - Triples anotados.
   * @param {number} fg2Attempted - Tiros de 2 intentados.
   * @param {number} fg3Attempted - Triples intentados.
   * @returns {number} eFG% en porcentaje con 1 decimal.
   */
  static calculateEFG(fg2Made = 0, fg3Made = 0, fg2Attempted = 0, fg3Attempted = 0) {
    const fgm = Number(fg2Made) + Number(fg3Made);
    const fga = Number(fg2Attempted) + Number(fg3Attempted);
    if (!fga || fga === 0) return 0;

    const efg = ((fgm + (0.5 * Number(fg3Made))) / fga) * 100;
    return Number(efg.toFixed(1));
  }

  /**
   * Porcentaje de Tiro Real (TS% - True Shooting Percentage).
   * Mide la eficiencia absoluta de tiro incluyendo tiros de 2, triples y tiros libres.
   * 
   * Fórmula del diccionario: PTS / (2 * (FGA + 0.44 * FTA)) * 100
   * 
   * @param {number} pts - Puntos totales anotados.
   * @param {number} fg2Attempted - Tiros de 2 intentados.
   * @param {number} fg3Attempted - Triples intentados.
   * @param {number} ftAttempted - Tiros libres intentados.
   * @returns {number} TS% en porcentaje con 1 decimal.
   */
  static calculateTS(pts = 0, fg2Attempted = 0, fg3Attempted = 0, ftAttempted = 0) {
    const fga = Number(fg2Attempted) + Number(fg3Attempted);
    const fta = Number(ftAttempted);
    const denominator = 2 * (fga + (0.44 * fta));

    if (!denominator || denominator === 0) return 0;
    const ts = (Number(pts) / denominator) * 100;
    return Number(ts.toFixed(1));
  }

  /**
   * Ratio de Asistencias por Pérdida (AST/TOV Ratio).
   * Mide la seguridad del jugador en la toma de decisiones y pase.
   * 
   * @param {number} assists - Total de asistencias.
   * @param {number} turnovers - Total de pérdidas de balón.
   * @returns {number} Ratio con 2 decimales. Si las pérdidas son 0, retorna las asistencias directas.
   */
  static calculateAstTovRatio(assists = 0, turnovers = 0) {
    const tov = Number(turnovers);
    const ast = Number(assists);
    if (tov === 0) return ast;
    return Number((ast / tov).toFixed(2));
  }

  /**
   * Posesiones Individuales Finalizadas por el Jugador.
   * Mide cuántas posesiones agota el jugador (con lanzamiento, tiros libres o pérdida).
   * 
   * Fórmula del diccionario: FGA + 0.44 * FTA + TOV
   * 
   * @returns {number} Número estimado de posesiones gastadas.
   */
  static calculateIndividualPossessions(fg2Attempted = 0, fg3Attempted = 0, ftAttempted = 0, turnovers = 0) {
    const fga = Number(fg2Attempted) + Number(fg3Attempted);
    const fta = Number(ftAttempted);
    const tov = Number(turnovers);
    return Number((fga + (0.44 * fta) + tov).toFixed(1));
  }

  /**
   * Porcentaje de Uso (USG% - Usage Rate).
   * Estima la proporción de jugadas del equipo que finaliza el jugador mientras está en pista.
   * 
   * Fórmula del diccionario:
   * 100 * ((FGA_jugador + 0.44*FTA_jugador + TOV_jugador) * (MIN_equipo / 5)) / (MIN_jugador * (FGA_equipo + 0.44*FTA_equipo + TOV_equipo))
   * 
   * @param {Object} playerStats - Estadísticas de tiro y pérdidas del jugador.
   * @param {Object} teamStats - Totales acumulados de tiro y pérdidas del equipo.
   * @param {number} playerMinutes - Minutos que ha jugado el jugador.
   * @param {number} [teamMinutes=200] - Minutos totales disputados por el equipo (200 en 40 min sin prórroga).
   * @returns {number} Porcentaje USG% con 1 decimal.
   */
  static calculateUsageRate(playerStats = {}, teamStats = {}, playerMinutes = 0, teamMinutes = 200) {
    const minJ = Number(playerMinutes);
    if (!minJ || minJ === 0) return 0;

    const playerPoss = this.calculateIndividualPossessions(
      playerStats.fg2Attempted || playerStats.fg2_attempted,
      playerStats.fg3Attempted || playerStats.fg3_attempted,
      playerStats.ftAttempted || playerStats.ft_attempted,
      playerStats.turnovers
    );

    const teamFga = Number((teamStats.fg2Attempted || teamStats.fg2_attempted || 0) + (teamStats.fg3Attempted || teamStats.fg3_attempted || 0));
    const teamFta = Number(teamStats.ftAttempted || teamStats.ft_attempted || 0);
    const teamTov = Number(teamStats.turnovers || 0);
    const teamPoss = teamFga + (0.44 * teamFta) + teamTov;

    if (!teamPoss || teamPoss === 0) return 0;

    const usg = 100 * ((playerPoss * (Number(teamMinutes) / 5)) / (minJ * teamPoss));
    return Number(usg.toFixed(1));
  }
}