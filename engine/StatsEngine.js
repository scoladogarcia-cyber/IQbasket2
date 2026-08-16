/**
 * @fileoverview Motor Central de Eventos y Estadísticas: StatsEngine.js
 * @description Única Fuente de Verdad para el procesamiento matemático y analítico de IQ Basket.
 * Centraliza el 100% de la lógica de negocio, Event Sourcing, minutaje por sustituciones,
 * control de 5 en pista, lead tracker, box scores, analítica avanzada de jugador/equipo,
 * quintetos (lineups) y agregados de temporada, garantizando cero dispersión de errores de cálculo.
 * 
 * Basado en las 93 métricas individuales y 95 métricas colectivas del catálogo oficial:
 * `Diccionario_estadisticas_baloncesto_jugador_equipo.xlsx`.
 */

import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { AdvancedPlayerStatsCalculator } from "../domain/stats/AdvancedPlayerStatsCalculator.js";
import { AdvancedTeamStatsCalculator } from "../domain/stats/AdvancedTeamStatsCalculator.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";

/**
 * Catálogo de tipos de eventos estándar para Event Sourcing.
 * @readonly
 * @enum {string}
 */
export const GameEventType = {
  PERIOD_START: "PERIOD_START",
  PERIOD_END: "PERIOD_END",
  SUBSTITUTION: "SUBSTITUTION",
  SHOT_2P_MADE: "SHOT_2P_MADE",
  SHOT_2P_MISSED: "SHOT_2P_MISSED",
  SHOT_3P_MADE: "SHOT_3P_MADE",
  SHOT_3P_MISSED: "SHOT_3P_MISSED",
  FREE_THROW_MADE: "FREE_THROW_MADE",
  FREE_THROW_MISSED: "FREE_THROW_MISSED",
  REBOUND_OFFENSIVE: "REBOUND_OFFENSIVE",
  REBOUND_DEFENSIVE: "REBOUND_DEFENSIVE",
  ASSIST: "ASSIST",
  STEAL: "STEAL",
  BLOCK_MADE: "BLOCK_MADE",
  BLOCK_RECEIVED: "BLOCK_RECEIVED",
  TURNOVER: "TURNOVER",
  FOUL_PERSONAL: "FOUL_PERSONAL",
  FOUL_DRAWN: "FOUL_DRAWN",
  TIMEOUT: "TIMEOUT",
  OPPONENT_SCORE_2P: "OPPONENT_SCORE_2P",
  OPPONENT_SCORE_3P: "OPPONENT_SCORE_3P",
  OPPONENT_SCORE_FT: "OPPONENT_SCORE_FT",
  OPPONENT_MISS_2P: "OPPONENT_MISS_2P",
  OPPONENT_MISS_3P: "OPPONENT_MISS_3P",
  OPPONENT_MISS_FT: "OPPONENT_MISS_FT",
  OPPONENT_REB_OFF: "OPPONENT_REB_OFF",
  OPPONENT_REB_DEF: "OPPONENT_REB_DEF",
  OPPONENT_TURNOVER: "OPPONENT_TURNOVER",
  OPPONENT_FOUL: "OPPONENT_FOUL"
};

export class StatsEngine {
  // =========================================================================
  // 1. CÁLCULO INDIVIDUAL (BOX SCORE & PIR / VALORACIÓN)
  // =========================================================================

  /**
   * Calcula las estadísticas completas de un jugador a partir de una fila de estadísticas.
   * @param {Object} row - Fila con estadísticas del jugador.
   * @returns {Object} Box score completo, valoración FIBA, Game Score y porcentajes.
   */
  static calculatePlayerStats(row = {}) {
    const box = BoxScoreCalculator.calculatePlayerBoxScore(row);
    return {
      ...box,
      evaluation: box.pir,
      val: box.pir,
      trb: box.rebounds
    };
  }

  // =========================================================================
  // 2. EVENT SOURCING REDUCER: ESTADO EN VIVO A PARTIR DE EVENTOS
  // =========================================================================

  /**
   * Procesa la lista inmutable de eventos de un partido y genera el estado completo:
   * marcadores, parciales por cuarto, box scores individuales, box score colectivo,
   * minutos reales derivados de sustituciones y quinteto activo.
   * 
   * @param {Array<Object>} events - Lista ordenada cronológicamente de GameEvents.
   * @param {Object} [config={}] - Opciones de configuración (periodMinutes, overtimeMinutes, starterIds).
   * @returns {Object} Estado computado consolidado del partido.
   */
  static processGameEvents(events = [], config = {}) {
    const periodMin = Number(config.periodMinutes || 10);
    const otMin = Number(config.overtimeMinutes || 5);
    const initialStarters = Array.isArray(config.starterIds) ? [...config.starterIds] : [];

    // Estructuras acumuladoras
    let teamScore = 0;
    let opponentScore = 0;
    let currentPeriod = 1;
    let periodScores = {}; // { 1: { team: 0, opp: 0 }, ... }
    let activeLineup = new Set(initialStarters);
    
    // Mapeo de stints para minutaje: { [playerId]: [{ period, inSec, outSec }] }
    const playerStints = {};
    // Puntos acumulados en pista por jugador para cálculo de +/-: { [playerId]: number }
    const playerPlusMinus = {};

    // Acumuladores de Box Score por jugador: { [playerId]: statsObject }
    const playerStatsMap = {};
    
    // Acumulador de Box Score de Equipo Propio y Rival
    const teamBox = this._createEmptyBoxObject();
    const oppBox = this._createEmptyBoxObject();

    // Historial temporal para gráfica de evolución del marcador (Lead Tracker)
    const scoreTimeline = [{
      timestampSec: 0,
      period: 1,
      teamScore: 0,
      opponentScore: 0,
      diff: 0,
      eventDesc: "Inicio"
    }];

    // Inicializar minutaje para titulares de Q1
    for (const pid of initialStarters) {
      playerStints[pid] = [{ period: 1, inSec: 0, outSec: null }];
      playerPlusMinus[pid] = 0;
    }

    // Recorrido secuencial e inmutable de eventos
    (events || []).forEach((evt) => {
      const pNum = Number(evt.period || currentPeriod || 1);
      currentPeriod = pNum;
      if (!periodScores[pNum]) {
        periodScores[pNum] = { team: 0, opp: 0 };
      }

      const evtSec = Number(evt.timestampSec ?? (evt.minute ? evt.minute * 60 + (evt.second || 0) : 0));
      const pid = evt.playerId || evt.player_id;

      if (pid && !playerStatsMap[pid]) {
        playerStatsMap[pid] = this._createEmptyBoxObject(pid);
        if (playerPlusMinus[pid] === undefined) playerPlusMinus[pid] = 0;
      }

      switch (evt.type) {
        // --- Control de Periodo y Sustituciones ---
        case GameEventType.PERIOD_START: {
          if (Array.isArray(evt.lineupIds) && evt.lineupIds.length === 5) {
            activeLineup.forEach((id) => {
              this._closeStint(playerStints, id, pNum - 1, periodMin * 60);
            });
            activeLineup = new Set(evt.lineupIds);
            activeLineup.forEach((id) => {
              this._openStint(playerStints, id, pNum, 0);
            });
          }
          break;
        }

        case GameEventType.PERIOD_END: {
          const maxSec = pNum > 4 ? otMin * 60 : periodMin * 60;
          activeLineup.forEach((id) => {
            this._closeStint(playerStints, id, pNum, maxSec);
          });
          break;
        }

        case GameEventType.SUBSTITUTION: {
          const { playerInId, playerOutId } = evt;
          if (playerOutId && activeLineup.has(playerOutId)) {
            activeLineup.delete(playerOutId);
            this._closeStint(playerStints, playerOutId, pNum, evtSec);
          }
          if (playerInId) {
            activeLineup.add(playerInId);
            this._openStint(playerStints, playerInId, pNum, evtSec);
          }
          break;
        }

        // --- Tiros Propios ---
        case GameEventType.SHOT_2P_MADE: {
          teamScore += 2;
          periodScores[pNum].team += 2;
          teamBox.fg2Made += 1;
          teamBox.fg2Attempted += 1;
          if (pid) {
            playerStatsMap[pid].fg2Made += 1;
            playerStatsMap[pid].fg2Attempted += 1;
          }
          this._applyPlusMinus(activeLineup, playerPlusMinus, 2, 0);
          break;
        }

        case GameEventType.SHOT_2P_MISSED: {
          teamBox.fg2Attempted += 1;
          if (pid) playerStatsMap[pid].fg2Attempted += 1;
          break;
        }

        case GameEventType.SHOT_3P_MADE: {
          teamScore += 3;
          periodScores[pNum].team += 3;
          teamBox.fg3Made += 1;
          teamBox.fg3Attempted += 1;
          if (pid) {
            playerStatsMap[pid].fg3Made += 1;
            playerStatsMap[pid].fg3Attempted += 1;
          }
          this._applyPlusMinus(activeLineup, playerPlusMinus, 3, 0);
          break;
        }

        case GameEventType.SHOT_3P_MISSED: {
          teamBox.fg3Attempted += 1;
          if (pid) playerStatsMap[pid].fg3Attempted += 1;
          break;
        }

        case GameEventType.FREE_THROW_MADE: {
          teamScore += 1;
          periodScores[pNum].team += 1;
          teamBox.ftMade += 1;
          teamBox.ftAttempted += 1;
          if (pid) {
            playerStatsMap[pid].ftMade += 1;
            playerStatsMap[pid].ftAttempted += 1;
          }
          this._applyPlusMinus(activeLineup, playerPlusMinus, 1, 0);
          break;
        }

        case GameEventType.FREE_THROW_MISSED: {
          teamBox.ftAttempted += 1;
          if (pid) playerStatsMap[pid].ftAttempted += 1;
          break;
        }

        // --- Acciones Básicas Propias ---
        case GameEventType.REBOUND_OFFENSIVE: {
          teamBox.offReb += 1;
          if (pid) playerStatsMap[pid].offReb += 1;
          break;
        }

        case GameEventType.REBOUND_DEFENSIVE: {
          teamBox.defReb += 1;
          if (pid) playerStatsMap[pid].defReb += 1;
          break;
        }

        case GameEventType.ASSIST: {
          teamBox.assists += 1;
          if (pid) playerStatsMap[pid].assists += 1;
          break;
        }

        case GameEventType.STEAL: {
          teamBox.steals += 1;
          if (pid) playerStatsMap[pid].steals += 1;
          break;
        }

        case GameEventType.BLOCK_MADE: {
          teamBox.blocksMade += 1;
          if (pid) playerStatsMap[pid].blocksMade += 1;
          break;
        }

        case GameEventType.BLOCK_RECEIVED: {
          teamBox.blocksReceived += 1;
          if (pid) playerStatsMap[pid].blocksReceived += 1;
          break;
        }

        case GameEventType.TURNOVER: {
          teamBox.turnovers += 1;
          if (pid) playerStatsMap[pid].turnovers += 1;
          break;
        }

        case GameEventType.FOUL_PERSONAL: {
          teamBox.foulsCommitted += 1;
          if (pid) playerStatsMap[pid].foulsCommitted += 1;
          break;
        }

        case GameEventType.FOUL_DRAWN: {
          teamBox.foulsDrawn += 1;
          if (pid) playerStatsMap[pid].foulsDrawn += 1;
          break;
        }

        // --- Acciones del Rival ---
        case GameEventType.OPPONENT_SCORE_2P: {
          opponentScore += 2;
          periodScores[pNum].opp += 2;
          oppBox.fg2Made += 1;
          oppBox.fg2Attempted += 1;
          this._applyPlusMinus(activeLineup, playerPlusMinus, 0, 2);
          break;
        }

        case GameEventType.OPPONENT_SCORE_3P: {
          opponentScore += 3;
          periodScores[pNum].opp += 3;
          oppBox.fg3Made += 1;
          oppBox.fg3Attempted += 1;
          this._applyPlusMinus(activeLineup, playerPlusMinus, 0, 3);
          break;
        }

        case GameEventType.OPPONENT_SCORE_FT: {
          opponentScore += 1;
          periodScores[pNum].opp += 1;
          oppBox.ftMade += 1;
          oppBox.ftAttempted += 1;
          this._applyPlusMinus(activeLineup, playerPlusMinus, 0, 1);
          break;
        }

        case GameEventType.OPPONENT_MISS_2P: {
          oppBox.fg2Attempted += 1;
          break;
        }

        case GameEventType.OPPONENT_MISS_3P: {
          oppBox.fg3Attempted += 1;
          break;
        }

        case GameEventType.OPPONENT_MISS_FT: {
          oppBox.ftAttempted += 1;
          break;
        }

        case GameEventType.OPPONENT_REB_OFF: {
          oppBox.offReb += 1;
          break;
        }

        case GameEventType.OPPONENT_REB_DEF: {
          oppBox.defReb += 1;
          break;
        }

        case GameEventType.OPPONENT_TURNOVER: {
          oppBox.turnovers += 1;
          break;
        }

        case GameEventType.OPPONENT_FOUL: {
          oppBox.foulsCommitted += 1;
          break;
        }

        default:
          break;
      }

      if (
        evt.type.includes("SCORE") ||
        evt.type.includes("MADE") ||
        evt.type === GameEventType.FREE_THROW_MADE
      ) {
        scoreTimeline.push({
          timestampSec: evtSec,
          period: pNum,
          teamScore,
          opponentScore,
          diff: teamScore - opponentScore,
          eventDesc: evt.type
        });
      }
    });

    // Minutos reales en segundos por jugador
    const playerSeconds = {};
    for (const [pid, stints] of Object.entries(playerStints)) {
      let totalSec = 0;
      stints.forEach((stint) => {
        const out = stint.outSec !== null ? stint.outSec : (stint.period > 4 ? otMin * 60 : periodMin * 60);
        totalSec += Math.max(0, out - stint.inSec);
      });
      playerSeconds[pid] = totalSec;
    }

    // Box Scores con StatsAggregator
    const playersListForAggregator = Object.entries(playerStatsMap).map(([pid, st]) => {
      const sec = playerSeconds[pid] || 0;
      return {
        ...st,
        playerId: pid,
        starter: initialStarters.includes(pid),
        minutesSeconds: sec,
        minutes: Number((sec / 60).toFixed(2)),
        plusMinus: playerPlusMinus[pid] || 0
      };
    });

    const totalGameMinutes = currentPeriod > 4 ? 40 + ((currentPeriod - 4) * otMin) : currentPeriod * periodMin;
    teamBox.points = teamScore;
    oppBox.points = opponentScore;

    const aggregated = StatsAggregator.processGameStats
      ? StatsAggregator.processGameStats(
          playersListForAggregator,
          teamBox,
          oppBox,
          totalGameMinutes
        )
      : {
          playerStatsList: playersListForAggregator.map(p => this.calculatePlayerStats(p)),
          teamReport: teamBox,
          opponentReport: oppBox,
          gameSummary: {}
        };

    return {
      teamScore,
      opponentScore,
      pointDifferential: teamScore - opponentScore,
      currentPeriod,
      periodScores,
      activeLineup: Array.from(activeLineup),
      playerSeconds,
      playerStatsList: aggregated.playerStatsList,
      teamReport: aggregated.teamReport,
      opponentReport: aggregated.opponentReport,
      gameSummary: aggregated.gameSummary,
      scoreTimeline
    };
  }

  // =========================================================================
  // 3. LINEUPS & QUINTETOS A PARTIR DE SUSTITUCIONES
  // =========================================================================

  /**
   * Reconstruye todos los quintetos utilizados durante el partido, calculando
   * sus minutos compartidos, balance de puntos (+/-), posesiones y ratings.
   * 
   * @param {Array<Object>} events - Lista inmutable de eventos.
   * @param {Array<string>} initialStarters - Quinteto titular del Q1.
   * @param {number} [periodMinutes=10] - Minutos por cuarto.
   * @returns {Array<Object>} Lista de quintetos con métricas avanzadas ordenadas por minutos.
   */
  static computeLineupsFromEvents(events = [], initialStarters = [], periodMinutes = 10) {
    let currentLineup = new Set(initialStarters);
    let lineupStartTime = 0;
    let teamScoreAtStart = 0;
    let oppScoreAtStart = 0;

    const lineupsMap = new Map();

    const flushStint = (endTime, currentTeamScore, currentOppScore) => {
      if (currentLineup.size !== 5) return;
      const key = Array.from(currentLineup).sort().join("|");
      const duration = Math.max(0, endTime - lineupStartTime);
      const ptsFor = currentTeamScore - teamScoreAtStart;
      const ptsAgainst = currentOppScore - oppScoreAtStart;

      if (!lineupsMap.has(key)) {
        lineupsMap.set(key, {
          playerIds: Array.from(currentLineup).sort(),
          secondsPlayed: 0,
          ptsFor: 0,
          ptsAgainst: 0,
          stintsCount: 0
        });
      }

      const lData = lineupsMap.get(key);
      lData.secondsPlayed += duration;
      lData.ptsFor += ptsFor;
      lData.ptsAgainst += ptsAgainst;
      lData.stintsCount += 1;
    };

    let teamRunningScore = 0;
    let oppRunningScore = 0;

    (events || []).forEach((evt) => {
      const evtSec = Number(evt.timestampSec || 0);

      if (evt.type === GameEventType.SHOT_2P_MADE) teamRunningScore += 2;
      else if (evt.type === GameEventType.SHOT_3P_MADE) teamRunningScore += 3;
      else if (evt.type === GameEventType.FREE_THROW_MADE) teamRunningScore += 1;
      else if (evt.type === GameEventType.OPPONENT_SCORE_2P) oppRunningScore += 2;
      else if (evt.type === GameEventType.OPPONENT_SCORE_3P) oppRunningScore += 3;
      else if (evt.type === GameEventType.OPPONENT_SCORE_FT) oppRunningScore += 1;

      if (evt.type === GameEventType.SUBSTITUTION || evt.type === GameEventType.PERIOD_START) {
        flushStint(evtSec, teamRunningScore, oppRunningScore);
        lineupStartTime = evtSec;
        teamScoreAtStart = teamRunningScore;
        oppScoreAtStart = oppRunningScore;

        if (evt.type === GameEventType.SUBSTITUTION) {
          if (evt.playerOutId) currentLineup.delete(evt.playerOutId);
          if (evt.playerInId) currentLineup.add(evt.playerInId);
        } else if (evt.type === GameEventType.PERIOD_START && Array.isArray(evt.lineupIds)) {
          currentLineup = new Set(evt.lineupIds);
        }
      }
    });

    const lastEvent = events[events.length - 1];
    const finalSec = lastEvent ? Number(lastEvent.timestampSec || 0) : 0;
    flushStint(finalSec, teamRunningScore, oppRunningScore);

    const result = [];
    lineupsMap.forEach((val) => {
      const metrics = AdvancedTeamStatsCalculator.calculateLineupMetrics({
        ptsFor: val.ptsFor,
        ptsAgainst: val.ptsAgainst,
        possessions: Math.round((val.secondsPlayed / 2400) * 75),
        secondsPlayed: val.secondsPlayed
      });

      result.push({
        playerIds: val.playerIds,
        ...metrics,
        stintsCount: val.stintsCount
      });
    });

    return result.sort((a, b) => b.minutesSeconds - a.minutesSeconds);
  }

  // =========================================================================
  // 4. DASHBOARD Y AGREGACIÓN MULTI-PARTIDO / TEMPORADA
  // =========================================================================

  /**
   * Filtra partidos válidos para análisis (excluye programados o sin disputar).
   * @param {Array<Object>} games - Lista de partidos.
   * @returns {Array<Object>} Partidos jugados.
   */
  static filterPlayedGames(games = []) {
    if (!Array.isArray(games)) return [];
    return games.filter((g) => {
      if (!g) return false;
      const pts = g.team_score ?? g.teamScore ?? g.our_score ?? null;
      const oppPts = g.opponent_score ?? g.opponentScore ?? g.opp_score ?? null;
      if (pts !== null && oppPts !== null && (Number(pts) > 0 || Number(oppPts) > 0)) return true;
      const status = String(g.status || "").trim().toUpperCase();
      return status === "COMPLETED" || status === "FINISHED" || status === "CLOSED" || status === "FINALIZADO";
    });
  }

  /**
   * Calcula los KPIs consolidados de temporada para el Dashboard Colectivo.
   * @param {Array<Object>} playedGames - Lista de partidos disputados.
   * @param {Array<Object>} playerStatsRows - Filas de estadísticas de jugador asociadas.
   * @returns {Object} Resumen KPI de temporada con métricas avanzadas (ORTG, DRTG, NET, eFG%, etc.).
   */
  static calculateTeamDashboardKPIs(playedGames = [], playerStatsRows = []) {
    const validGames = this.filterPlayedGames(playedGames);
    const gp = validGames.length;

    let wins = 0, losses = 0, totFor = 0, totAgainst = 0;

    validGames.forEach((g) => {
      const ptsFor = Number(g.team_score ?? g.teamScore ?? g.our_score ?? g.points ?? 0);
      const ptsAgainst = Number(g.opponent_score ?? g.opponentScore ?? g.opp_score ?? g.opp_points ?? 0);
      totFor += ptsFor;
      totAgainst += ptsAgainst;
      if (ptsFor > ptsAgainst) wins++;
      else if (ptsAgainst > ptsFor) losses++;
    });

    const ppg = gp > 0 ? Number((totFor / gp).toFixed(1)) : 0;
    const oppPpg = gp > 0 ? Number((totAgainst / gp).toFixed(1)) : 0;
    const diffPpg = Number((ppg - oppPpg).toFixed(1));
    const winPct = gp > 0 ? Number(((wins / gp) * 100).toFixed(1)) : 0;

    // Desglose de lanzamientos y pérdidas acumuladas
    let totFga = 0, totFgm = 0, totFg3m = 0, totFta = 0, totTov = 0;

    (playerStatsRows || []).forEach((s) => {
      const fg2m = Number(s.fg2_made ?? s.fg2Made ?? s.points_2_made ?? 0);
      const fg3m = Number(s.fg3_made ?? s.fg3Made ?? s.points_3_made ?? 0);
      const fg2a = Number(s.fg2_attempted ?? s.fg2Attempted ?? s.points_2_attempted ?? 0);
      const fg3a = Number(s.fg3_attempted ?? s.fg3Attempted ?? s.points_3_attempted ?? 0);
      totFgm += (fg2m + fg3m);
      totFga += (fg2a + fg3a);
      totFg3m += fg3m;
      totFta += Number(s.ft_attempted ?? s.ftAttempted ?? s.free_throws_attempted ?? 0);
      totTov += Number(s.turnovers ?? s.tov ?? 0);
    });

    // Estimación oficial de posesiones
    const totalPossessions = (totFga + 0.44 * totFta + totTov) || (gp * 70) || 70;
    const ortg = totalPossessions > 0 ? Number(((totFor / totalPossessions) * 100).toFixed(1)) : (ppg > 0 ? Number(((ppg / 70) * 100).toFixed(1)) : 65.4);
    const drtg = totalPossessions > 0 ? Number(((totAgainst / totalPossessions) * 100).toFixed(1)) : (oppPpg > 0 ? Number(((oppPpg / 70) * 100).toFixed(1)) : 108.5);
    const netRtg = Number((ortg - drtg).toFixed(1));

    const efg = totFga > 0 ? Number((((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1)) : 29.0;
    const tovPct = totalPossessions > 0 ? Number(((totTov / totalPossessions) * 100).toFixed(1)) : 16.5;
    const pace = gp > 0 ? Number((totalPossessions / gp).toFixed(1)) : 72.4;

    return {
      gp,
      wins,
      losses,
      winPct,
      ppg,
      oppPpg,
      diffPpg,
      ortg,
      drtg,
      netRtg,
      pace,
      efg,
      tovPct
    };
  }

  // =========================================================================
  // 5. HELPERS PRIVADOS DE ESTRUCTURA Y MINUTAJE
  // =========================================================================

  /**
   * Crea un objeto de estadísticas tradicional vacío a cero.
   * @private
   */
  static _createEmptyBoxObject(playerId = null) {
    return {
      playerId,
      fg2Made: 0,
      fg2Attempted: 0,
      fg3Made: 0,
      fg3Attempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      offReb: 0,
      defReb: 0,
      assists: 0,
      steals: 0,
      blocksMade: 0,
      blocksReceived: 0,
      turnovers: 0,
      foulsCommitted: 0,
      foulsDrawn: 0,
      points: 0
    };
  }

  /**
   * Abre un tramo de tiempo (stint) para un jugador que entra a pista.
   * @private
   */
  static _openStint(stintsMap, playerId, period, inSec) {
    if (!stintsMap[playerId]) stintsMap[playerId] = [];
    stintsMap[playerId].push({ period, inSec, outSec: null });
  }

  /**
   * Cierra el tramo de tiempo activo de un jugador que va al banquillo.
   * @private
   */
  static _closeStint(stintsMap, playerId, period, outSec) {
    if (!stintsMap[playerId]) return;
    const openStint = stintsMap[playerId].find((s) => s.period === period && s.outSec === null);
    if (openStint) {
      openStint.outSec = outSec;
    }
  }

  /**
   * Aplica el diferencial de puntos al balance +/- de los 5 jugadores activos en pista.
   * @private
   */
  static _applyPlusMinus(activeLineupSet, plusMinusMap, teamPts = 0, oppPts = 0) {
    const diff = teamPts - oppPts;
    activeLineupSet.forEach((pid) => {
      if (plusMinusMap[pid] === undefined) plusMinusMap[pid] = 0;
      plusMinusMap[pid] += diff;
    });
  }
}

export default StatsEngine;