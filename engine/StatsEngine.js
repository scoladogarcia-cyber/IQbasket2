/**
 * @fileoverview Motor de Cálculo Estadístico de IQ Basket.
 * Contiene fórmulas puras según el Diccionario de Estadísticas Oficial (Jugador y Equipo).
 */

export class StatsEngine {
  /**
   * Filtra los partidos jugados capturando cualquier partido con puntuación o estado no pendiente.
   */
  static filterPlayedGames(games) {
    if (!games || !Array.isArray(games)) return [];

    return games.filter((g) => {
      if (!g) return false;

      const ptsUs = g.team_score ?? g.our_score ?? g.points ?? null;
      const ptsThem = g.opponent_score ?? g.opp_score ?? g.opp_points ?? null;

      // 1. Si hay alguna puntuación registrada mayor o igual a 0
      if (ptsUs !== null && ptsThem !== null) return true;

      // 2. Validar por estado textual si no es PENDIENTE/SCHEDULED
      const statusUpper = String(g.status || '').trim().toUpperCase();
      const isPending = statusUpper === 'SCHEDULED' || statusUpper === 'PENDIENTE' || statusUpper === 'PROGRAMADO';
      
      return statusUpper !== '' && !isPending;
    });
  }

  /**
   * Calcula el resumen KPI para el Dashboard Colectivo/Equipo
   */
  static calculateTeamDashboardKPIs(playedGames = [], teamStatsRows = []) {
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
      const pts = Number(g.team_score ?? g.our_score ?? g.points ?? 0);
      const oppPts = Number(g.opponent_score ?? g.opp_score ?? g.opp_points ?? 0);
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

    (teamStatsRows || []).forEach((st) => {
      totalFGM += Number((st.fg2_made || 0) + (st.fg3_made || 0));
      totalFGA += Number((st.fg2_attempted || 0) + (st.fg3_attempted || 0));
      total3PM += Number(st.fg3_made || 0);
      totalFTA += Number(st.ft_attempted || 0);
      totalTOV += Number(st.turnovers || 0);
      totalORB += Number(st.rebounds_offensive || st.off_reb || 0);
      totalDRB += Number(st.rebounds_defensive || st.def_reb || 0);

      totalOppFGA += Number(st.opp_fg_attempted || 0);
      totalOppFTA += Number(st.opp_ft_attempted || 0);
      totalOppORB += Number(st.opp_off_reb || 0);
      totalOppTOV += Number(st.opp_turnovers || 0);
    });

    // Fallbacks si aún no hay box score colectivo cargado
    if (totalFGA === 0) totalFGA = gp * 60;
    if (totalFGM === 0) totalFGM = Math.round(totalPts / 2.2);

    // 3. Fórmulas Avanzadas
    const efg = totalFGA > 0 
      ? Number((((totalFGM + 0.5 * total3PM) / totalFGA) * 100).toFixed(1)) 
      : 0;

    const tovDenom = totalFGA + 0.44 * totalFTA + totalTOV;
    const tovPct = tovDenom > 0 
      ? Number(((totalTOV / tovDenom) * 100).toFixed(1)) 
      : 0;

    const possUs = totalFGA + 0.44 * totalFTA - totalORB + totalTOV;
    const possThem = totalOppFGA + 0.44 * totalOppFTA - totalOppORB + totalOppTOV;
    const totalPossessions = 0.5 * (possUs + (possThem || possUs));

    const ortg = totalPossessions > 0 
      ? Number(((totalPts / totalPossessions) * 100).toFixed(1)) 
      : 0;
    const drtg = totalPossessions > 0 
      ? Number(((totalOppPts / totalPossessions) * 100).toFixed(1)) 
      : 0;
    const netRtg = Number((ortg - drtg).toFixed(1));

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
   * Fórmulas individuales de Jugador
   */
  static calculatePlayerStats(row, teamStats = {}) {
    const min = Number(row.minutes || 0);
    const fg2m = Number(row.fg2_made || 0);
    const fg2a = Number(row.fg2_attempted || 0);
    const fg3m = Number(row.fg3_made || 0);
    const fg3a = Number(row.fg3_attempted || 0);
    const ftm = Number(row.ft_made || 0);
    const fta = Number(row.ft_attempted || 0);

    const orb = Number(row.off_reb || row.rebounds_offensive || 0);
    const drb = Number(row.def_reb || row.rebounds_defensive || 0);
    const ast = Number(row.assists || 0);
    const stl = Number(row.steals || 0);
    const blk = Number(row.blocks || 0);
    const pf = Number(row.fouls_committed || 0);
    const tov = Number(row.turnovers || 0);

    const fgm = fg2m + fg3m;
    const fga = fg2a + fg3a;
    const trb = orb + drb;

    // Recálculo real de puntos
    const calculatedPoints = (fg2m * 2) + (fg3m * 3) + ftm;
    const pts = (row.points !== undefined && row.points !== null && Number(row.points) > 0)
      ? Number(row.points)
      : calculatedPoints;

    // Porcentajes de tiro
    const pct2P = fg2a > 0 ? Number(((fg2m / fg2a) * 100).toFixed(1)) : 0.0;
    const pct3P = fg3a > 0 ? Number(((fg3m / fg3a) * 100).toFixed(1)) : 0.0;
    const pctFG = fga > 0 ? Number(((fgm / fga) * 100).toFixed(1)) : 0.0;
    const pctFT = fta > 0 ? Number(((ftm / fta) * 100).toFixed(1)) : 0.0;

    const efg = fga > 0 ? Number((((fgm + 0.5 * fg3m) / fga) * 100).toFixed(1)) : 0.0;
    const tsDenom = 2 * (fga + 0.44 * fta);
    const tsPct = tsDenom > 0 ? Number(((pts / tsDenom) * 100).toFixed(1)) : 0.0;

    const gameScoreVal = pts + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) +
      0.7 * orb + 0.3 * drb + stl + 0.7 * ast + 0.7 * blk - 0.4 * pf - tov;
    const gameScore = Number(gameScoreVal.toFixed(1));

    const missedFg = fga - fgm;
    const missedFt = fta - ftm;
    const evaluation = (pts + trb + ast + stl + blk) - (missedFg + missedFt + tov + pf);

    return {
      ...row,
      points: pts,
      fgm, fga, trb,
      pct2P, pct3P, pctFG, pctFT,
      eFG: efg, tsPct,
      gameScore,
      evaluation
    };
  }

  /**
   * Fórmulas colectivas por Partido
   */
  static calculateTeamStats(teamRow, oppRow = {}) {
    const fg2m = Number(teamRow.fg2_made || 0);
    const fg2a = Number(teamRow.fg2_attempted || 0);
    const fg3m = Number(teamRow.fg3_made || 0);
    const fg3a = Number(teamRow.fg3_attempted || 0);
    const ftm = Number(teamRow.ft_made || 0);
    const fta = Number(teamRow.ft_attempted || 0);

    const orb = Number(teamRow.rebounds_offensive || teamRow.off_reb || 0);
    const drb = Number(teamRow.rebounds_defensive || teamRow.def_reb || 0);
    const ast = Number(teamRow.assists || 0);
    const stl = Number(teamRow.steals || 0);
    const blk = Number(teamRow.blocks_made || teamRow.blocks || 0);
    const tov = Number(teamRow.turnovers || 0);

    const fgm = fg2m + fg3m;
    const fga = fg2a + fg3a;

    const pts = Number(teamRow.points || (fg2m * 2) + (fg3m * 3) + ftm);
    const oppPts = Number(teamRow.opp_points || oppRow.points || 0);

    const ownPossEst = fga + (0.44 * fta) - orb + tov;
    const estimatedPossessions = Number(ownPossEst.toFixed(1)) || 70.0;

    const ortg = estimatedPossessions > 0 ? Number(((pts / estimatedPossessions) * 100).toFixed(1)) : 0.0;
    const drtg = estimatedPossessions > 0 ? Number(((oppPts / estimatedPossessions) * 100).toFixed(1)) : 0.0;
    const netRating = Number((ortg - drtg).toFixed(1));
    const pace = Number(estimatedPossessions.toFixed(1));

    const eFG = fga > 0 ? Number((((fgm + 0.5 * fg3m) / fga) * 100).toFixed(1)) : 0.0;

    return {
      ...teamRow,
      points: pts,
      opp_points: oppPts,
      estimated_possessions: estimatedPossessions,
      pace,
      ortg, drtg, net_rating: netRating,
      efg: eFG
    };
  }
}