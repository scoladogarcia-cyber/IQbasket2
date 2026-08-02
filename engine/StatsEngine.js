/**
 * @fileoverview Motor de Cálculo Estadístico de IQ Basket.
 * Contiene fórmulas puras según el Diccionario de Estadísticas.
 */

export class StatsEngine {
  /**
   * Filtra únicamente los partidos jugados/finalizados.
   * Flexibilizado para capturar cualquier partido completado o con marcador registrado.
   */
  static filterPlayedGames(games) {
    if (!games || !Array.isArray(games)) return [];

    const validStatuses = ['COMPLETED', 'FINALIZADO', 'FINISHED', 'FINAL', 'PLAYED', 'JUGADO'];

    return games.filter((g) => {
      if (!g) return false;

      // 1. Validar por estado textual (mayúsculas/minúsculas indiferente)
      const statusUpper = String(g.status || '').trim().toUpperCase();
      if (validStatuses.includes(statusUpper)) {
        return true;
      }

      // 2. O validar si ya tiene puntuación de ambos equipos registrada
      const hasTeamScore = g.team_score !== null && g.team_score !== undefined;
      const hasOpponentScore = g.opponent_score !== null && g.opponent_score !== undefined;

      return hasTeamScore && hasOpponentScore;
    });
  }

  /**
   * Calcula el resumen KPI para el Dashboard Colectivo/Equipo
   */
  static calculateTeamDashboardKPIs(playedGames, teamStatsRows = []) {
    const gp = playedGames.length;
    if (gp === 0) {
      return {
        gp: 0, wins: 0, losses: 0, ppg: 0, oppPpg: 0, diffPpg: 0,
        ortg: 0, drtg: 0, netRtg: 0, pace: 0, efg: 0, tovPct: 0
      };
    }

    // 1. Contexto básico y puntuación
    let wins = 0;
    let losses = 0;
    let totalPts = 0;
    let totalOppPts = 0;

    playedGames.forEach((g) => {
      const pts = g.team_score || 0;
      const oppPts = g.opponent_score || 0;
      totalPts += pts;
      totalOppPts += oppPts;

      if (pts > oppPts) wins++;
      else if (pts < oppPts) losses++;
    });

    const ppg = Number((totalPts / gp).toFixed(1));
    const oppPpg = Number((totalOppPts / gp).toFixed(1));
    const diffPpg = Number((ppg - oppPpg).toFixed(1));

    // 2. Acumulados colectivos para Advanced Stats
    let totalFGA = 0, totalFGM = 0, total3PM = 0, totalFTA = 0;
    let totalTOV = 0, totalORB = 0, totalDRB = 0;
    let totalOppFGA = 0, totalOppFTA = 0, totalOppORB = 0, totalOppTOV = 0;

    teamStatsRows.forEach((st) => {
      totalFGM += (st.fg2_made || 0) + (st.fg3_made || 0);
      totalFGA += (st.fg2_attempted || 0) + (st.fg3_attempted || 0);
      total3PM += st.fg3_made || 0;
      totalFTA += st.ft_attempted || 0;
      totalTOV += st.turnovers || 0;
      totalORB += st.rebounds_offensive || 0;
      totalDRB += st.rebounds_defensive || 0;

      totalOppFGA += st.opp_fg_attempted || 0;
      totalOppFTA += st.opp_ft_attempted || 0;
      totalOppORB += st.opp_off_reb || 0;
      totalOppTOV += st.opp_turnovers || 0;
    });

    // 3. Fórmulas Avanzadas del Diccionario
    // Effective Field Goal Percentage: (FGM + 0.5 * 3PM) / FGA * 100
    const efg = totalFGA > 0 
      ? Number((((totalFGM + 0.5 * total3PM) / totalFGA) * 100).toFixed(1)) 
      : 0;

    // Turnover Percentage: TOV / (FGA + 0.44 * FTA + TOV) * 100
    const tovDenom = totalFGA + 0.44 * totalFTA + totalTOV;
    const tovPct = tovDenom > 0 
      ? Number(((totalTOV / tovDenom) * 100).toFixed(1)) 
      : 0;

    // Posesiones Estimadas: 0.5 * [(FGA + 0.44*FTA - ORB + TOV) + (Opp FGA + 0.44*Opp FTA - Opp ORB + Opp TOV)]
    const possUs = totalFGA + 0.44 * totalFTA - totalORB + totalTOV;
    const possThem = totalOppFGA + 0.44 * totalOppFTA - totalOppORB + totalOppTOV;
    const totalPossessions = 0.5 * (possUs + possThem);

    // Ratings (por 100 posesiones)
    const ortg = totalPossessions > 0 
      ? Number(((totalPts / totalPossessions) * 100).toFixed(1)) 
      : 0;
    const drtg = totalPossessions > 0 
      ? Number(((totalOppPts / totalPossessions) * 100).toFixed(1)) 
      : 0;
    const netRtg = Number((ortg - drtg).toFixed(1));

    // Ritmo (Pace por 40 min)
    const pace = gp > 0 
      ? Number((totalPossessions / gp).toFixed(1)) 
      : 0;

    return {
      gp,
      wins,
      losses,
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

  /**
   * Fórmulas individuales de Jugador (Game Score, EFF, TS%, etc.)
   */
  static calculatePlayerStats(row) {
    const pts = row.points || 0;
    const fgm = (row.fg2_made || 0) + (row.fg3_made || 0);
    const fga = (row.fg2_attempted || 0) + (row.fg3_attempted || 0);
    const ftm = row.ft_made || 0;
    const fta = row.ft_attempted || 0;
    const orb = row.off_reb || 0;
    const drb = row.def_reb || 0;
    const ast = row.assists || 0;
    const stl = row.steals || 0;
    const blk = row.blocks || 0;
    const pf = row.fouls_committed || 0;
    const tov = row.turnovers || 0;

    // Game Score (Fórmula Hollinger)
    const gameScore = pts + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) +
                      0.7 * orb + 0.3 * drb + stl + 0.7 * ast + 0.7 * blk - 0.4 * pf - tov;

    // True Shooting Percentage (TS%)
    const tsDenom = 2 * (fga + 0.44 * fta);
    const tsPct = tsDenom > 0 ? (pts / tsDenom) * 100 : 0;

    return {
      ...row,
      gameScore: Number(gameScore.toFixed(1)),
      tsPct: Number(tsPct.toFixed(1))
    };
  }
}