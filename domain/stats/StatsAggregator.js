/**
 * @fileoverview Orquestador del Dominio: StatsAggregator (Consolidador y Agregador Estadístico).
 * @description Procesa en cascada todas las métricas del catálogo oficial
 * (`Diccionario_estadisticas_baloncesto_jugador_equipo.xlsx`), coordinando BoxScoreCalculator,
 * AdvancedPlayerStatsCalculator y AdvancedTeamStatsCalculator.
 * 
 * Capacidades principales:
 * - Procesa Box Score completo y analítica avanzada para todos los jugadores y el colectivo.
 * - Soporta agregación acumulada de temporada (Career / Season Stats) y medias por partido.
 * - Manejo robusto de minutos reales en segundos derivados del registro de sustituciones.
 * - Respeta la arquitectura de funciones puras e inmutables sin dependencias externas.
 */

import { BoxScoreCalculator } from "./BoxScoreCalculator.js";
import { AdvancedPlayerStatsCalculator } from "./AdvancedPlayerStatsCalculator.js";
import { AdvancedTeamStatsCalculator } from "./AdvancedTeamStatsCalculator.js";

export class StatsAggregator {
  /**
   * Recalcula y consolida el conjunto completo de estadísticas de un partido para jugadores y equipos.
   * 
   * @param {Array<Object>} playersRawStats - Lista de estadísticas acumuladas por jugador.
   * @param {Object} teamRawStats - Acumulados crudos del equipo propio.
   * @param {Object} opponentRawStats - Acumulados crudos del equipo rival.
   * @param {number} [actualMinutes=40] - Minutos totales disputados en el partido (incluidas prórrogas).
   * @returns {Object} { playerStatsList, teamReport, opponentReport, gameSummary }
   */
  static processGameStats(playersRawStats = [], teamRawStats = {}, opponentRawStats = {}, actualMinutes = 40) {
    const totalActualMinutes = Number(actualMinutes || 40);
    const teamMinutesRegulation = totalActualMinutes * 5; // 200 min en 40 min estándar, 225 en prórroga

    // 1. Posesiones colectivas estimadas (propias, rivales y conjuntas)
    const teamPossOnly = AdvancedTeamStatsCalculator.calculateTeamPossessions(teamRawStats);
    const oppPossOnly = AdvancedTeamStatsCalculator.calculateTeamPossessions(opponentRawStats);
    const jointPossessions = AdvancedTeamStatsCalculator.calculateJointPossessions(teamRawStats, opponentRawStats);

    // 2. Procesamiento de cada jugador (Box Score Tradicional + Métricas Avanzadas)
    const processedPlayers = (playersRawStats || []).map((p) => {
      const boxScore = BoxScoreCalculator.generateBoxScoreSummary(p);
      const advanced = AdvancedPlayerStatsCalculator.generateAdvancedPlayerReport(
        boxScore,
        teamRawStats,
        opponentRawStats,
        boxScore.minutes,
        teamMinutesRegulation
      );

      return {
        ...p,
        ...boxScore,
        advanced
      };
    });

    // 3. Generación de informes colectivos avanzados
    const teamReport = AdvancedTeamStatsCalculator.generateAdvancedTeamReport(teamRawStats, opponentRawStats, totalActualMinutes);
    const opponentReport = AdvancedTeamStatsCalculator.generateAdvancedTeamReport(opponentRawStats, teamRawStats, totalActualMinutes);

    return {
      playerStatsList: processedPlayers,
      teamReport,
      opponentReport,
      gameSummary: {
        teamScore: teamReport.teamScore,
        opponentScore: opponentReport.teamScore,
        pointDifferential: teamReport.pointDifferential,
        jointPossessions,
        teamPossessionsOnly: teamPossOnly,
        opponentPossessionsOnly: oppPossOnly,
        pace: teamReport.pace,
        minutesPlayed: totalActualMinutes
      }
    };
  }

  /**
   * Agrega el histórico de partidos de un jugador a lo largo de una temporada o carrera.
   * Calcula totales acumulados, medias por partido (Per Game) y métricas avanzadas globales.
   * 
   * @param {Array<Object>} playerGameStatsList - Lista de partidos disputados por el jugador.
   * @param {Object} [teamSeasonTotals={}] - Totales de temporada del equipo para normalizaciones de uso y rebote.
   * @param {Object} [oppSeasonTotals={}] - Totales de temporada de los rivales.
   * @returns {Object} Perfil estadístico acumulado y medias por encuentro.
   */
  static aggregatePlayerSeasonStats(playerGameStatsList = [], teamSeasonTotals = {}, oppSeasonTotals = {}) {
    const gp = (playerGameStatsList || []).length;
    if (gp === 0) return null;

    let gs = 0;
    let totalSec = 0;
    let pts = 0;
    let fg2m = 0;
    let fg2a = 0;
    let fg3m = 0;
    let fg3a = 0;
    let ftm = 0;
    let fta = 0;
    let orb = 0;
    let drb = 0;
    let ast = 0;
    let stl = 0;
    let blk = 0;
    let ba = 0;
    let tov = 0;
    let pf = 0;
    let fd = 0;
    let plusMinus = 0;

    for (const g of playerGameStatsList) {
      if (g.starter) gs += 1;
      totalSec += Number(g.minutesSeconds ?? g.minutes_seconds ?? ((g.minutes || 0) * 60));
      pts += Number(g.points ?? g.pts ?? 0);
      fg2m += Number(g.fg2Made ?? g.fg2_made ?? 0);
      fg2a += Number(g.fg2Attempted ?? g.fg2_attempted ?? 0);
      fg3m += Number(g.fg3Made ?? g.fg3_made ?? 0);
      fg3a += Number(g.fg3Attempted ?? g.fg3_attempted ?? 0);
      ftm += Number(g.ftMade ?? g.ft_made ?? 0);
      fta += Number(g.ftAttempted ?? g.ft_attempted ?? 0);
      orb += Number(g.offReb ?? g.off_reb ?? 0);
      drb += Number(g.defReb ?? g.def_reb ?? 0);
      ast += Number(g.assists ?? g.ast ?? 0);
      stl += Number(g.steals ?? g.stl ?? 0);
      blk += Number(g.blocksMade ?? g.blocks_made ?? 0);
      ba += Number(g.blocksReceived ?? g.blocks_received ?? 0);
      tov += Number(g.turnovers ?? g.tov ?? 0);
      pf += Number(g.foulsCommitted ?? g.fouls_committed ?? 0);
      fd += Number(g.foulsDrawn ?? g.fouls_drawn ?? 0);
      plusMinus += Number(g.plusMinus ?? g.plus_minus ?? 0);
    }

    const totalMinutes = Number((totalSec / 60).toFixed(2));
    const fgm = fg2m + fg3m;
    const fga = fg2a + fg3a;
    const trb = orb + drb;

    const totals = {
      gp,
      gs,
      minutesSeconds: totalSec,
      minutes: totalMinutes,
      points: pts,
      fg2Made: fg2m,
      fg2Attempted: fg2a,
      fg2Pct: BoxScoreCalculator.calculatePercentage(fg2m, fg2a),
      fg3Made: fg3m,
      fg3Attempted: fg3a,
      fg3Pct: BoxScoreCalculator.calculatePercentage(fg3m, fg3a),
      fgMade: fgm,
      fgAttempted: fga,
      fgPct: BoxScoreCalculator.calculatePercentage(fgm, fga),
      ftMade: ftm,
      ftAttempted: fta,
      ftPct: BoxScoreCalculator.calculatePercentage(ftm, fta),
      offReb: orb,
      defReb: drb,
      totalRebounds: trb,
      assists: ast,
      steals: stl,
      blocksMade: blk,
      blocksReceived: ba,
      turnovers: tov,
      foulsCommitted: pf,
      foulsDrawn: fd,
      plusMinus,
      pir: BoxScoreCalculator.calculatePIR({ points: pts, fg2Made: fg2m, fg2Attempted: fg2a, fg3Made: fg3m, fg3Attempted: fg3a, ftMade: ftm, ftAttempted: fta, offReb: orb, defReb: drb, assists: ast, steals: stl, blocksMade: blk, blocksReceived: ba, turnovers: tov, foulsCommitted: pf, foulsDrawn: fd }),
      efficiency: BoxScoreCalculator.calculateEFF({ points: pts, fg2Made: fg2m, fg2Attempted: fg2a, fg3Made: fg3m, fg3Attempted: fg3a, ftMade: ftm, ftAttempted: fta, offReb: orb, defReb: drb, assists: ast, steals: stl, blocksMade: blk, turnovers: tov }),
      gameScore: BoxScoreCalculator.calculateGameScore({ points: pts, fg2Made: fg2m, fg2Attempted: fg2a, fg3Made: fg3m, fg3Attempted: fg3a, ftMade: ftm, ftAttempted: fta, offReb: orb, defReb: drb, assists: ast, steals: stl, blocksMade: blk, foulsCommitted: pf, turnovers: tov })
    };

    // Medias por partido (Per Game)
    const perGame = {
      mpg: Number((totalMinutes / gp).toFixed(1)),
      ppg: Number((pts / gp).toFixed(1)),
      rpg: Number((trb / gp).toFixed(1)),
      apg: Number((ast / gp).toFixed(1)),
      spg: Number((stl / gp).toFixed(1)),
      bpg: Number((blk / gp).toFixed(1)),
      topg: Number((tov / gp).toFixed(1)),
      pfpg: Number((pf / gp).toFixed(1)),
      plusMinusPg: Number((plusMinus / gp).toFixed(1)),
      pirPg: Number((totals.pir / gp).toFixed(1))
    };

    // Analítica avanzada agregada
    const advanced = AdvancedPlayerStatsCalculator.generateAdvancedPlayerReport(
      totals,
      teamSeasonTotals,
      oppSeasonTotals,
      totalMinutes,
      teamSeasonTotals.minutes ?? (gp * 200)
    );

    return {
      totals,
      perGame,
      advanced
    };
  }

  /**
   * Agrega las estadísticas colectivas de un equipo a lo largo de una temporada.
   * Calcula victorias, derrotas, medias y métricas Four Factors acumuladas.
   * 
   * @param {Array<Object>} gamesReportList - Lista de reportes de partidos del equipo.
   * @returns {Object} Resumen agregado de temporada del equipo.
   */
  static aggregateTeamSeasonStats(gamesReportList = []) {
    const gp = (gamesReportList || []).length;
    if (gp === 0) return null;

    let wins = 0;
    let losses = 0;
    let totalPtsFor = 0;
    let totalPtsAgainst = 0;

    const teamAcc = {
      fg2Made: 0, fg2Attempted: 0, fg3Made: 0, fg3Attempted: 0,
      ftMade: 0, ftAttempted: 0, offReb: 0, defReb: 0,
      assists: 0, steals: 0, blocksMade: 0, turnovers: 0, foulsCommitted: 0
    };

    const oppAcc = {
      fg2Made: 0, fg2Attempted: 0, fg3Made: 0, fg3Attempted: 0,
      ftMade: 0, ftAttempted: 0, offReb: 0, defReb: 0,
      assists: 0, steals: 0, blocksMade: 0, turnovers: 0, foulsCommitted: 0
    };

    for (const g of gamesReportList) {
      const tPts = Number(g.teamScore ?? g.team_score ?? 0);
      const oPts = Number(g.opponentScore ?? g.opponent_score ?? 0);
      totalPtsFor += tPts;
      totalPtsAgainst += oPts;

      if (tPts > oPts) wins += 1;
      else losses += 1;

      // Acumula estadísticas básicas de equipo y rival si están presentes
      if (g.teamStats) {
        teamAcc.fg2Made += Number(g.teamStats.fg2Made ?? 0);
        teamAcc.fg2Attempted += Number(g.teamStats.fg2Attempted ?? 0);
        teamAcc.fg3Made += Number(g.teamStats.fg3Made ?? 0);
        teamAcc.fg3Attempted += Number(g.teamStats.fg3Attempted ?? 0);
        teamAcc.ftMade += Number(g.teamStats.ftMade ?? 0);
        teamAcc.ftAttempted += Number(g.teamStats.ftAttempted ?? 0);
        teamAcc.offReb += Number(g.teamStats.offReb ?? 0);
        teamAcc.defReb += Number(g.teamStats.defReb ?? 0);
        teamAcc.assists += Number(g.teamStats.assists ?? 0);
        teamAcc.steals += Number(g.teamStats.steals ?? 0);
        teamAcc.blocksMade += Number(g.teamStats.blocksMade ?? 0);
        teamAcc.turnovers += Number(g.teamStats.turnovers ?? 0);
        teamAcc.foulsCommitted += Number(g.teamStats.foulsCommitted ?? 0);
      }

      if (g.oppStats) {
        oppAcc.fg2Made += Number(g.oppStats.fg2Made ?? 0);
        oppAcc.fg2Attempted += Number(g.oppStats.fg2Attempted ?? 0);
        oppAcc.fg3Made += Number(g.oppStats.fg3Made ?? 0);
        oppAcc.fg3Attempted += Number(g.oppStats.fg3Attempted ?? 0);
        oppAcc.ftMade += Number(g.oppStats.ftMade ?? 0);
        oppAcc.ftAttempted += Number(g.oppStats.ftAttempted ?? 0);
        oppAcc.offReb += Number(g.oppStats.offReb ?? 0);
        oppAcc.defReb += Number(g.oppStats.defReb ?? 0);
        oppAcc.assists += Number(g.oppStats.assists ?? 0);
        oppAcc.steals += Number(g.oppStats.steals ?? 0);
        oppAcc.blocksMade += Number(g.oppStats.blocksMade ?? 0);
        oppAcc.turnovers += Number(g.oppStats.turnovers ?? 0);
        oppAcc.foulsCommitted += Number(g.oppStats.foulsCommitted ?? 0);
      }
    }

    const winPct = BoxScoreCalculator.calculatePercentage(wins, gp);
    const avgPtsFor = Number((totalPtsFor / gp).toFixed(1));
    const avgPtsAgainst = Number((totalPtsAgainst / gp).toFixed(1));
    const netDifferential = totalPtsFor - totalPtsAgainst;

    const advancedReport = AdvancedTeamStatsCalculator.generateAdvancedTeamReport(
      { ...teamAcc, points: totalPtsFor },
      { ...oppAcc, points: totalPtsAgainst },
      gp * 40
    );

    return {
      record: {
        gamesPlayed: gp,
        wins,
        losses,
        winPercentage: winPct
      },
      points: {
        totalFor: totalPtsFor,
        totalAgainst: totalPtsAgainst,
        avgFor: avgPtsFor,
        avgAgainst: avgPtsAgainst,
        differential: netDifferential
      },
      seasonReport: advancedReport
    };
  }
}