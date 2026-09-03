/**
 * @fileoverview Vista de Estadística Avanzada y Four Factors: AdvancedStatsView.js
 * @description Presenta los 4 factores de Dean Oliver (eFG%, TOV%, ORB%, FT Rate) y métricas analíticas.
 * Fórmulas oficiales FIBA/ACB calculadas sobre partidos disputados (MIN > 0).
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class AdvancedStatsView {
  /**
   * Crea una instancia de AdvancedStatsView.
   * @param {Object} [gameController=null] - Controlador de partidos.
   */
  constructor(gameController = null) {
    this.controller = gameController;
    this.viewMode = "team"; // 'team' | 'players'
    
    // Estado de ordenación para vista de Equipo
    this.teamSortField = "date";
    this.teamSortAsc = false;

    // Estado de ordenación para vista de Jugadores
    this.playerSortField = "valAvg";
    this.playerSortAsc = false;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _calculateFibaVal(st = {}) {
    if (BoxScoreCalculator && typeof BoxScoreCalculator.calculatePlayerBoxScore === "function") {
      const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
      return Number(comp.pir ?? comp.evaluation ?? comp.val ?? 0);
    }

    const pts = Number(st.points ?? (Number(st.fg2_made ?? st.fg2Made ?? 0) * 2 + Number(st.fg3_made ?? st.fg3Made ?? 0) * 3 + Number(st.ft_made ?? st.ftMade ?? 0)));
    const oreb = Number(st.off_reb ?? st.offReb ?? st.rebounds_offensive ?? 0);
    const dreb = Number(st.def_reb ?? st.defReb ?? st.rebounds_defensive ?? 0);
    const reb = Number(st.rebounds ?? (oreb + dreb));
    const ast = Number(st.assists ?? st.ast ?? 0);
    const stl = Number(st.steals ?? st.stl ?? 0);
    const blk = Number(st.blocks ?? st.blocks_made ?? st.blk ?? 0);
    const foulsDrawn = Number(st.fouls_drawn ?? st.foulsDrawn ?? st.fouls_received ?? 0);

    const fg2m = Number(st.fg2_made ?? st.fg2Made ?? 0);
    const fg2a = Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
    const fg3m = Number(st.fg3_made ?? st.fg3Made ?? 0);
    const fg3a = Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
    const ftm = Number(st.ft_made ?? st.ftMade ?? 0);
    const fta = Number(st.ft_attempted ?? st.ftAttempted ?? 0);

    const missedFg = Math.max(0, (fg2a + fg3a) - (fg2m + fg3m));
    const missedFt = Math.max(0, fta - ftm);
    const tov = Number(st.turnovers ?? st.tov ?? 0);
    const blkAgainst = Number(st.blocks_received ?? st.blocksReceived ?? 0);
    const foulsCommitted = Number(st.fouls_committed ?? st.fouls ?? 0);

    return (pts + reb + ast + stl + blk + foulsDrawn) - (missedFg + missedFt + tov + blkAgainst + foulsCommitted);
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const activeTeamId = DataStore.getActiveTeamId();
    const games = DataStore.getGames(activeTeamId) || DataStore.getGames() || [];
    const playedGames = StatsEngine && typeof StatsEngine.filterPlayedGames === "function" 
      ? StatsEngine.filterPlayedGames(games) 
      : games.filter(g => Number(g.team_score ?? g.teamScore ?? 0) > 0 || Number(g.opponent_score ?? g.opponentScore ?? 0) > 0);

    const totalTeamGamesCount = Math.max(1, playedGames.length);
    const players = DataStore.getSeasonParticipantPlayers?.(activeTeamId)
      || DataStore.getPlayers(activeTeamId)
      || DataStore.getPlayers()
      || [];
    const allStats = DataStore.getPlayerGameStats() || [];

    if (games.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; color: #475569; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
          ${this.t("no_games_recorded", "No hay partidos registrados para analizar estadísticas avanzadas.")}
        </div>`;
      return;
    }

    // 1. CÁLCULO DE LOS FOUR FACTORS GLOBALES DEL EQUIPO
    let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0;
    let totFtm = 0, totFta = 0, totOffReb = 0, totDefReb = 0, totTo = 0;

    (allStats || []).forEach(st => {
      totFg2m += Number(st.fg2_made ?? st.fg2Made ?? 0);
      totFg2a += Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
      totFg3m += Number(st.fg3_made ?? st.fg3Made ?? 0);
      totFg3a += Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
      totFtm += Number(st.ft_made ?? st.ftMade ?? 0);
      totFta += Number(st.ft_attempted ?? st.ftAttempted ?? 0);
      totOffReb += Number(st.off_reb ?? st.offReb ?? st.rebounds_offensive ?? 0);
      totDefReb += Number(st.def_reb ?? st.defReb ?? st.rebounds_defensive ?? 0);
      totTo += Number(st.turnovers ?? st.tov ?? 0);
    });

    const totFgm = totFg2m + totFg3m;
    const totFga = totFg2a + totFg3a;

    const efg = totFga > 0 ? (((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1) : "0.0";
    const poss = (totFga + 0.44 * totFta + totTo) || (totalTeamGamesCount * 70) || 70;
    const tovPct = poss > 0 ? ((totTo / poss) * 100).toFixed(1) : "0.0";
    const estimatedOppDefReb = (totOffReb * 1.5) || 30;
    const orbPct = (totOffReb + estimatedOppDefReb) > 0 ? ((totOffReb / (totOffReb + estimatedOppDefReb)) * 100).toFixed(1) : "0.0";
    const ftRate = totFga > 0 ? (totFtm / totFga).toFixed(2) : "0.00";

    const getSortArrow = (field, currentField, isAsc) => {
      if (currentField !== field) return `<span style="color:#cbd5e1;">↕</span>`;
      return `<span style="color:#f97316;">${isAsc ? '↑' : '↓'}</span>`;
    };

    // 2. CONSTRUCCIÓN DE CONTENIDO (EQUIPO O JUGADORES)
    let desktopTableMarkup = "";
    let mobileCardsMarkup = "";

    if (this.viewMode === "team") {
      const teamDataList = games.map((g) => {
        const teamScore = Number(g.team_score ?? g.teamScore ?? g.our_score ?? 0);
        const oppScore = Number(g.opponent_score ?? g.opponentScore ?? g.opp_score ?? 0);
        const isWin = teamScore > oppScore;
        const diff = teamScore - oppScore;

        const gStats = DataStore.getPlayerGameStats(null, g.id) || [];
        let gFg2m = 0, gFg2a = 0, gFg3m = 0, gFg3a = 0, gFtm = 0, gFta = 0, gOffReb = 0, gTo = 0;

        gStats.forEach(s => {
          gFg2m += Number(s.fg2_made ?? s.fg2Made ?? 0); 
          gFg2a += Number(s.fg2_attempted ?? s.fg2Attempted ?? 0);
          gFg3m += Number(s.fg3_made ?? s.fg3Made ?? 0); 
          gFg3a += Number(s.fg3_attempted ?? s.fg3Attempted ?? 0);
          gFtm  += Number(s.ft_made ?? s.ftMade ?? 0);   
          gFta  += Number(s.ft_attempted ?? s.ftAttempted ?? 0);
          gOffReb += Number(s.off_reb ?? s.offReb ?? s.rebounds_offensive ?? 0); 
          gTo   += Number(s.turnovers ?? s.tov ?? 0);
        });

        const gFga = gFg2a + gFg3a;
        const gFgm = gFg2m + gFg3m;
        const gEfgNum = gFga > 0 ? Number((((gFgm + 0.5 * gFg3m) / gFga) * 100).toFixed(1)) : 0;
        const gPoss = (gFga + 0.44 * gFta + gTo) || 70;
        const gTovNum = gPoss > 0 ? Number(((gTo / gPoss) * 100).toFixed(1)) : 0;
        const gFtRateNum = gFga > 0 ? Number((gFtm / gFga).toFixed(2)) : 0;

        const venueLower = String(g.venue || '').toLowerCase();
        const isHome = venueLower === 'home' || venueLower === 'local' || g.is_home || g.isHome;
        const venueText = isHome ? this.t("local", "Local") : this.t("visitor", "Visitante");
        const opponentText = g.opponent || g.opponent_name || g.opponentName || this.t("opponent", "Rival");
        const formattedDate = g.date ? (I18n.formatDate ? I18n.formatDate(g.date) : g.date) : '-';

        return {
          id: g.id,
          date: g.date || '',
          formattedDate,
          opponentText,
          venueText,
          teamScore,
          oppScore,
          isWin,
          diff,
          efg: gEfgNum,
          tovPct: gTovNum,
          offReb: gOffReb,
          ftRate: gFtRateNum
        };
      });

      // Ordenación para vista de equipo
      teamDataList.sort((a, b) => {
        let valA = a[this.teamSortField];
        let valB = b[this.teamSortField];
        if (this.teamSortField === "date") {
          valA = new Date(a.date || 0).getTime();
          valB = new Date(b.date || 0).getTime();
        }
        if (typeof valA === "string") {
          return this.teamSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.teamSortAsc ? (valA - valB) : (valB - valA);
      });

      const teamRows = teamDataList.map(g => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 12px 14px; font-weight: 700; color: #0f172a;">
            vs ${g.opponentText}
            <div style="font-size: 11px; color: #64748b; font-weight: 500;">${g.formattedDate} · ${g.venueText}</div>
          </td>
          <td style="padding: 12px; text-align: center;">
            <span style="font-weight: 900; color: ${g.isWin ? '#16a34a' : '#dc2626'}; background: #f8fafc; padding: 4px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${g.teamScore} - ${g.oppScore}
            </span>
          </td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #7c3aed;">${g.efg > 0 ? `${g.efg.toFixed(1)}%` : "-"}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${g.tovPct > 0 ? `${g.tovPct.toFixed(1)}%` : "-"}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #2563eb;">${g.offReb}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #16a34a;">${g.ftRate > 0 ? g.ftRate.toFixed(2) : "-"}</td>
        </tr>
      `).join("");

      desktopTableMarkup = `
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th class="th-sort-team" data-field="date" style="padding: 12px 14px; cursor: pointer;">
                ${this.t("games", "PARTIDO").toUpperCase()} ${getSortArrow('date', this.teamSortField, this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="diff" style="padding: 12px; text-align: center; cursor: pointer;">
                ${this.t("score", "RESULTADO").toUpperCase()} ${getSortArrow('diff', this.teamSortField, this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="efg" style="padding: 12px; text-align: center; color: #7c3aed; cursor: pointer;">
                <span class="has-tooltip">
                  eFG% <span class="info-badge">?</span>
                  <span class="tooltip-box">Effective Field Goal %: Mide la eficacia de tiro premiando en un 50% el triple. Fórmula: [(FGM + 0.5 × 3PM) / FGA].</span>
                </span>
                ${getSortArrow('efg', this.teamSortField, this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="tovPct" style="padding: 12px; text-align: center; color: #dc2626; cursor: pointer;">
                <span class="has-tooltip">
                  TOV% <span class="info-badge">?</span>
                  <span class="tooltip-box">Turnover Ratio: Porcentaje estimado de posesiones que terminan en pérdida de balón. Fórmula: [TOV / Posesiones].</span>
                </span>
                ${getSortArrow('tovPct', this.teamSortField, this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="offReb" style="padding: 12px; text-align: center; color: #2563eb; cursor: pointer;">
                <span class="has-tooltip">
                  REB OFF <span class="info-badge">?</span>
                  <span class="tooltip-box">Rebotes ofensivos capturados por el equipo en el partido.</span>
                </span>
                ${getSortArrow('offReb', this.teamSortField, this.teamSortAsc)}
              </th>
              <th class="th-sort-team" data-field="ftRate" style="padding: 12px; text-align: center; color: #16a34a; cursor: pointer;">
                <span class="has-tooltip">
                  FT RATE <span class="info-badge">?</span>
                  <span class="tooltip-box">Free Throw Rate: Tiros libres convertidos en relación con los tiros de campo intentados. Fórmula: [FTM / FGA].</span>
                </span>
                ${getSortArrow('ftRate', this.teamSortField, this.teamSortAsc)}
              </th>
            </tr>
          </thead>
          <tbody>${teamRows}</tbody>
        </table>
      `;

      mobileCardsMarkup = teamDataList.map(g => `
        <div class="adv-card-mobile card" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
            <strong style="color: #0f172a;">vs ${g.opponentText}</strong>
            <span style="padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; background: ${g.isWin ? '#dcfce7' : '#fee2e2'}; color: ${g.isWin ? '#15803d' : '#b91c1c'};">${g.teamScore} - ${g.oppScore}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #7c3aed; font-size: 14px;">${g.efg.toFixed(1)}%</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">TOV%</span><strong style="color: #dc2626; font-size: 14px;">${g.tovPct.toFixed(1)}%</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">RO</span><strong style="color: #2563eb; font-size: 14px;">${g.offReb}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">FTR</span><strong style="color: #16a34a; font-size: 14px;">${g.ftRate.toFixed(2)}</strong></div>
          </div>
        </div>
      `).join("");

    } else {
      // VISTA DE JUGADORES (CÁLCULO EXACTO BASADO EN PARTIDOS DISPUTADOS MIN > 0)
      const playerDataList = players.map(p => {
        const pStats = (allStats || []).filter(s => String(s.player_id ?? s.playerId) === String(p.id));
        const activeStats = pStats.filter(s => Number(s.minutes ?? s.minutesPlayed ?? 0) > 0);
        const gp = activeStats.length;
        
        let pPts = 0, pFg2m = 0, pFg2a = 0, pFg3m = 0, pFg3a = 0, pAst = 0, pTo = 0, pVal = 0;
        
        activeStats.forEach(s => {
          const fg2m = Number(s.fg2_made ?? s.fg2Made ?? 0);
          const fg2a = Number(s.fg2_attempted ?? s.fg2Attempted ?? 0);
          const fg3m = Number(s.fg3_made ?? s.fg3Made ?? 0);
          const fg3a = Number(s.fg3_attempted ?? s.fg3Attempted ?? 0);
          const ftm = Number(s.ft_made ?? s.ftMade ?? 0);

          pFg2m += fg2m; 
          pFg2a += fg2a;
          pFg3m += fg3m; 
          pFg3a += fg3a;
          pAst  += Number(s.assists ?? s.ast ?? 0);   
          pTo   += Number(s.turnovers ?? s.tov ?? 0);
          
          pPts += (s.points !== undefined && s.points !== null && Number(s.points) > 0) ? Number(s.points) : (fg2m * 2 + fg3m * 3 + ftm);
          pVal += this._calculateFibaVal(s);
        });

        const pFga = pFg2a + pFg3a;
        const pFgm = pFg2m + pFg3m;
        const pEfgNum = pFga > 0 ? Number((((pFgm + 0.5 * pFg3m) / pFga) * 100).toFixed(1)) : 0.0;
        const astToNum = pTo > 0 ? Number((pAst / pTo).toFixed(1)) : pAst;
        
        // VAL / PJ calculado sobre partidos disputados (MIN > 0)
        const valAvgNum = gp > 0 ? Number((pVal / gp).toFixed(1)) : 0.0;

        const fullName = `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name || 'Jugador';
        const jerseyNum = p.jersey !== undefined && p.jersey !== null ? Number(p.jersey) : 99;

        return {
          id: p.id,
          jerseyNum,
          fullName,
          position: p.primary_position || p.primaryPosition || 'Jugador',
          gp,
          pts: pPts,
          efg: pEfgNum,
          valAvg: valAvgNum,
          astTo: astToNum,
          tov: pTo
        };
      });

      // Ordenación para vista de jugadores
      playerDataList.sort((a, b) => {
        let valA = a[this.playerSortField];
        let valB = b[this.playerSortField];
        if (this.playerSortField === "name") {
          valA = a.fullName.toLowerCase();
          valB = b.fullName.toLowerCase();
          return this.playerSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return this.playerSortAsc ? (Number(valA) - Number(valB)) : (Number(valB) - Number(valA));
      });

      const playerRows = playerDataList.map(p => `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px; cursor: pointer;" onclick="window.location.hash='#/player/${p.id}'">
          <td style="padding: 12px 14px; font-weight: 700; color: #0f172a;">#${p.jerseyNum !== 99 ? p.jerseyNum : '-'} ${p.fullName}</td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #0f172a;">${p.pts}</td>
          <td style="padding: 12px; text-align: center; font-weight: 800; color: #7c3aed;">${p.efg.toFixed(1)}%</td>
          <td style="padding: 12px; text-align: center; font-weight: 900; color: #a855f7; font-size: 14px;">${p.valAvg.toFixed(1)}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #166534;">${p.astTo.toFixed(1)}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #dc2626;">${p.tov}</td>
        </tr>
      `).join("");

      desktopTableMarkup = `
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th class="th-sort-player" data-field="name" style="padding: 12px 14px; cursor: pointer;">
                ${this.t("players", "JUGADOR").toUpperCase()} ${getSortArrow('name', this.playerSortField, this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="pts" style="padding: 12px; text-align: center; cursor: pointer;">
                <span class="has-tooltip">
                  ${this.t("total_points", "PTS TOTALES").toUpperCase()} <span class="info-badge">?</span>
                  <span class="tooltip-box">Puntos totales acumulados: 2×T2C + 3×T3C + TLC.</span>
                </span>
                ${getSortArrow('pts', this.playerSortField, this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="efg" style="padding: 12px; text-align: center; color: #7c3aed; cursor: pointer;">
                <span class="has-tooltip">
                  eFG% ACUM. <span class="info-badge">?</span>
                  <span class="tooltip-box">Porcentaje de tiro efectivo acumulado. Fórmula: [(FGM + 0.5 × 3PM) / FGA].</span>
                </span>
                ${getSortArrow('efg', this.playerSortField, this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="valAvg" style="padding: 12px; text-align: center; color: #a855f7; cursor: pointer;">
                <span class="has-tooltip">
                  VAL / PJ <span class="info-badge">?</span>
                  <span class="tooltip-box">Valoración Oficial FIBA por Partido: (PTS + REB + AST + ROB + TAP + FP_REC) - (TC_FALL + TL_FALL + PER + TAP_REC + FP_COM) dividido entre los partidos disputados (MIN > 0).</span>
                </span>
                ${getSortArrow('valAvg', this.playerSortField, this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="astTo" style="padding: 12px; text-align: center; color: #166534; cursor: pointer;">
                <span class="has-tooltip">
                  RATIO AST/TO <span class="info-badge">?</span>
                  <span class="tooltip-box">Ratio de pase: Asistencias repartidas por cada pérdida de balón cometida. Fórmula: [AST / TOV].</span>
                </span>
                ${getSortArrow('astTo', this.playerSortField, this.playerSortAsc)}
              </th>
              <th class="th-sort-player" data-field="tov" style="padding: 12px; text-align: center; color: #dc2626; cursor: pointer;">
                <span class="has-tooltip">
                  ${this.t("turnovers", "PÉRDIDAS").toUpperCase()} <span class="info-badge">?</span>
                  <span class="tooltip-box">Total acumulado de pérdidas de balón en la temporada.</span>
                </span>
                ${getSortArrow('tov', this.playerSortField, this.playerSortAsc)}
              </th>
            </tr>
          </thead>
          <tbody>${playerRows}</tbody>
        </table>
      `;

      mobileCardsMarkup = playerDataList.map(p => `
        <div class="adv-card-mobile card" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; display: flex; flex-direction: column; gap: 8px; cursor: pointer;" onclick="window.location.hash='#/player/${p.id}'">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px;">
            <strong style="color: #0f172a;">#${p.jerseyNum !== 99 ? p.jerseyNum : '-'} ${p.fullName}</strong>
            <span style="font-size: 11px; color: #475569; font-weight: 600;">${p.position}</span>
          </div>
          <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">PTS</span><strong style="font-size: 14px; color: #0f172a;">${p.pts}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">eFG%</span><strong style="color: #7c3aed; font-size: 14px;">${p.efg.toFixed(1)}%</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">VAL/PJ</span><strong style="color: #a855f7; font-size: 14px;">${p.valAvg.toFixed(1)}</strong></div>
            <div><span style="font-size: 9px; font-weight: 800; color: #64748b; display: block;">AST/TO</span><strong style="color: #166534; font-size: 14px;">${p.astTo.toFixed(1)}</strong></div>
          </div>
        </div>
      `).join("");
    }

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">

        <!-- Header y Selector de Modo -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">
              📈 ${this.t("advanced_stats", "Estadísticas Avanzadas")} & Four Factors
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">
              ${this.t("advanced_subtitle", "Factores clave de rendimiento y métricas de eficiencia.")}
            </p>
          </div>

          <!-- TOGGLE EQUIPO / JUGADORES -->
          <div style="background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; gap: 4px;">
            <button id="btn-mode-team" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.viewMode === 'team' ? '#0f172a' : 'transparent'}; color: ${this.viewMode === 'team' ? '#ffffff' : '#334155'};">
              🏀 ${this.t("team", "Equipo")}
            </button>
            <button id="btn-mode-players" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.viewMode === 'players' ? '#0f172a' : 'transparent'}; color: ${this.viewMode === 'players' ? '#ffffff' : '#334155'};">
              👤 ${this.t("players", "Jugadores")}
            </button>
          </div>
        </div>

        <!-- TARJETAS DE FOUR FACTORS GLOBALES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                EFECTIVE FG (eFG%) <span class="info-badge">?</span>
                <span class="tooltip-box">Effective Field Goal %: Mide la eficacia de tiro bonificando en un 50% los triples anotados. Fórmula: [(FGM + 0.5 × 3PM) / FGA].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #7c3aed; margin-top: 4px;">${efg}%</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("efg_desc", "Eficiencia en tiros de campo")}</div>
          </div>

          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                TURNOVER RATIO (TOV%) <span class="info-badge">?</span>
                <span class="tooltip-box">Turnover Percentage: Porcentaje de posesiones propias que terminan en pérdida de balón. Fórmula: [TOV / Posesiones].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 4px;">${tovPct}%</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("tov_desc", "Pérdidas estimadas por 100 pos.")}</div>
          </div>

          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                REBOTE OFENSIVO (ORB%) <span class="info-badge">?</span>
                <span class="tooltip-box">Offensive Rebound %: Porcentaje de rebotes ofensivos capturados sobre los rechaces en ataque disponibles. Fórmula: [ORB / (ORB + Opp DRB)].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #2563eb; margin-top: 4px;">${orbPct}%</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("orb_desc", "Porcentaje de rechaces ofensivos")}</div>
          </div>

          <div class="card" style="padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">
              <span class="has-tooltip">
                FREE THROW RATE (FTR) <span class="info-badge">?</span>
                <span class="tooltip-box">Free Throw Rate: Capacidad de generar puntos desde el tiro libre por cada tiro de campo lanzado. Fórmula: [FTM / FGA].</span>
              </span>
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #16a34a; margin-top: 4px;">${ftRate}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${this.t("ftr_desc", "Tiros libres anotados por TC")}</div>
          </div>
        </div>

        <!-- TABLA DESKTOP / TARJETAS MÓVIL -->
        <div class="desktop-only" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; overflow-x: visible; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          ${desktopTableMarkup}
        </div>

        <div class="mobile-only mobile-adv-grid" style="display: flex; flex-direction: column; gap: 12px;">
          ${mobileCardsMarkup}
        </div>

      </div>

      <style>
        .has-tooltip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .info-badge {
          background: #cbd5e1;
          color: #334155;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 800;
          transition: all 0.2s ease;
        }
        .has-tooltip:hover .info-badge {
          background: #f97316;
          color: #ffffff;
        }
        .tooltip-box {
          visibility: hidden;
          opacity: 0;
          width: 250px;
          background-color: #0f172a;
          color: #ffffff;
          text-align: center;
          border-radius: 8px;
          padding: 10px 12px;
          position: absolute;
          z-index: 9999 !important;
          bottom: 135%;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
          text-transform: none;
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
          transition: opacity 0.2s ease, visibility 0.2s ease;
          pointer-events: none;
        }
        .tooltip-box::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -6px;
          border-width: 6px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }
        .has-tooltip:hover .tooltip-box {
          visibility: visible;
          opacity: 1;
        }

        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `;

    // Listeners para cambio de vista
    container.querySelector("#btn-mode-team")?.addEventListener("click", () => {
      this.viewMode = "team";
      this.render(containerId);
    });

    container.querySelector("#btn-mode-players")?.addEventListener("click", () => {
      this.viewMode = "players";
      this.render(containerId);
    });

    // Listeners de ordenación en vista de Equipo
    container.querySelectorAll(".th-sort-team").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-field");
        if (this.teamSortField === field) {
          this.teamSortAsc = !this.teamSortAsc;
        } else {
          this.teamSortField = field;
          this.teamSortAsc = false;
        }
        this.render(containerId);
      });
    });

    // Listeners de ordenación en vista de Jugadores
    container.querySelectorAll(".th-sort-player").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-field");
        if (this.playerSortField === field) {
          this.playerSortAsc = !this.playerSortAsc;
        } else {
          this.playerSortField = field;
          this.playerSortAsc = false;
        }
        this.render(containerId);
      });
    });
  }
}

export default AdvancedStatsView;