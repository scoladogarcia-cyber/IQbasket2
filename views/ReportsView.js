/**
 * @fileoverview Vista del Módulo de Informes Estadísticos y Scouting (ReportsView.js).
 * @description Gestión de reportes analíticos de partido, temporada completa e individual.
 * 
 * Capacidades integrales:
 * 1. Diagnóstico de partido con métricas colectivas avanzadas, Four Factors, fortalezas y debilidades.
 * 2. Radiografía de temporada con tablas ordenables por métricas por partido y proyecciones a 40 minutos.
 * 3. Ficha individual de jugador con histórico de partidos, promedios y gráfica de evolución FIBA.
 * 4. Panel de exportación configurable a PDF Élite (portada, selección personalizada de partidos/plantilla y gráficas SVG).
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";
import { AdvancedTeamStatsCalculator } from "../domain/stats/AdvancedTeamStatsCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { ReportExporter } from "../services/ReportExporter.js";
import { I18n } from "../services/I18nService.js";

export class ReportsView {
  /**
   * Crea una instancia de ReportsView.
   * @param {Object} [authController=null] - Controlador de autenticación y roles RBAC.
   */
  constructor(authController = null) {
    this.auth = authController;
    
    // Modos de pantalla: 'game' (Partido), 'season' (Temporada), 'player' (Jugador)
    this.reportMode = "game"; 
    this.selectedGameId = null;
    this.selectedPlayerId = null;

    // Modo de métrica de temporada: 'per_game' (Por Partido) o 'per_40' (Por 40 Minutos)
    this.seasonMetricMode = "per_game"; 

    // Estado de configuración de exportación
    this.exportGamesScope = "all"; // 'current', 'custom', 'all'
    this.exportPlayersScope = "all"; // 'none', 'current', 'custom', 'all'
    this.selectedExportGameIds = [];
    this.selectedExportPlayerIds = [];
    this.includeChartsInPDF = true;

    // Estado de ordenación de tablas
    this.sortField = "val";
    this.sortAsc = false;
    this.seasonSortField = "valPJ";
    this.seasonSortAsc = false;
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _canExport() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("SCOUT") ||
      this.auth.hasRole("ENTRENADOR") ||
      this.auth.hasRole("ANALISTA")
    );
  }

  // =========================================================================
  // AUXILIARES DE CÁLCULO ESTADÍSTICO
  // =========================================================================
  _getSelectedGameData() {
    const activeTeamId = DataStore.getActiveTeamId();
    const games = DataStore.getGames(activeTeamId) || DataStore.getGames() || [];
    if (games.length === 0) return null;

    if (!this.selectedGameId || !games.some(g => String(g.id) === String(this.selectedGameId))) {
      this.selectedGameId = games[0].id;
    }

    const game = games.find(g => String(g.id) === String(this.selectedGameId)) || games[0];
    const statsList = DataStore.getPlayerGameStats(null, game.id) || [];
    const periodScores = DataStore.getGamePeriodScores(game.id) || [];
    const players = DataStore.getPlayers(activeTeamId) || DataStore.getPlayers() || [];
    const playersMap = new Map(players.map(p => [String(p.id), p]));

    let teamPts = Number(game.team_score ?? game.teamScore ?? game.our_score ?? 0);
    let oppPts = Number(game.opponent_score ?? game.opponentScore ?? game.opp_score ?? 0);

    let totFga = 0, totFg3m = 0, totFta = 0, totTov = 0, totReb = 0, totStl = 0, totAst = 0;
    const playersList = [];

    statsList.forEach(st => {
      const pInfo = playersMap.get(String(st.player_id ?? st.playerId)) || {};
      const computed = BoxScoreCalculator.calculatePlayerBoxScore(st);

      const fg2a = Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
      const fg3a = Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
      totFga += (fg2a + fg3a);
      totFg3m += Number(st.fg3_made ?? st.fg3Made ?? 0);
      totFta += Number(st.ft_attempted ?? st.ftAttempted ?? 0);
      totTov += Number(st.turnovers ?? st.tov ?? 0);
      totReb += (Number(st.off_reb ?? st.offReb ?? 0) + Number(st.def_reb ?? st.defReb ?? 0));
      totStl += Number(st.steals ?? st.stl ?? 0);
      totAst += Number(st.assists ?? st.ast ?? 0);

      playersList.push({
        id: st.player_id ?? st.playerId,
        name: `#${pInfo.jersey ?? pInfo.number ?? '?'} ${pInfo.first_name || pInfo.firstName || ''} ${pInfo.last_name || pInfo.lastName || ''}`.trim() || 'Jugador',
        min: Number(st.minutes ?? st.minutesPlayed ?? 0),
        pts: computed.points || 0,
        reb: computed.rebounds || 0,
        ast: Number(st.assists ?? st.ast ?? 0),
        tov: Number(st.turnovers ?? st.tov ?? 0),
        val: computed.pir || 0,
        gs: computed.gameScore || 0
      });
    });

    playersList.sort((a, b) => {
      let valA = a[this.sortField];
      let valB = b[this.sortField];
      if (typeof valA === "string") {
        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return this.sortAsc ? valA - valB : valB - valA;
    });

    const poss = Math.round(
      (AdvancedTeamStatsCalculator && typeof AdvancedTeamStatsCalculator.estimatePossessions === "function")
        ? AdvancedTeamStatsCalculator.estimatePossessions(totFga, totFta, 0, totTov)
        : (totFga + 0.44 * totFta + totTov)
    ) || 70;

    const offRtg = poss > 0 ? Number(((teamPts / poss) * 100).toFixed(1)) : 70.0;
    const defRtg = poss > 0 ? Number(((oppPts / poss) * 100).toFixed(1)) : 70.0;
    const netRtg = Number((offRtg - defRtg).toFixed(1));

    const strengths = [];
    const weaknesses = [];

    if (totStl >= 10) strengths.push(`Dominio defensivo en recuperación de balón: ${totStl} robos totales.`);
    if (totAst >= 10) strengths.push(`Circulación fluida de balón: ${totAst} asistencias repartidas.`);
    if (totReb >= 30) strengths.push(`Control del rebote colectivo: ${totReb} capturas totales.`);
    if (strengths.length === 0) strengths.push("Aportación coral de la plantilla y ritmo competitivo constante.");

    if (totTov > 18) weaknesses.push(`Volumen elevado de pérdidas de balón (${totTov} TO), concediendo opciones en transición.`);
    if (totFg3m / Math.max(1, totFga) < 0.15) weaknesses.push("Baja efectividad en el lanzamiento exterior, permitiendo colapsar la pintura al rival.");
    if (netRtg < 0) weaknesses.push(`Net Rating negativo (${netRtg}), requiriendo mayor eficiencia en el retorno por posesión.`);

    return {
      game,
      teamPts,
      oppPts,
      diffPts: teamPts - oppPts,
      poss,
      offRtg,
      defRtg,
      netRtg,
      playersList,
      strengths,
      weaknesses,
      statsList,
      periodScores
    };
  }

  /**
   * Obtiene las estadísticas de plantilla acumuladas, mostrando VAL/PJ y VAL/40
   */
  _getSeasonPer40StatsList() {
    const activeTeamId = DataStore.getActiveTeamId();
    const players = DataStore.getPlayers(activeTeamId) || DataStore.getPlayers() || [];
    const allStats = DataStore.getPlayerGameStats() || [];

    const list = players.map(p => {
      const pStList = allStats.filter(s => String(s.player_id ?? s.playerId) === String(p.id));
      const seasonAgg = (StatsAggregator && typeof StatsAggregator.aggregatePlayerSeasonStats === "function") 
        ? StatsAggregator.aggregatePlayerSeasonStats(pStList) 
        : null;

      const gamesCount = pStList.length;
      let tMin = 0, tPts = 0, tReb = 0, tAst = 0, tStl = 0, tTov = 0, tVal = 0;
      
      pStList.forEach(st => {
        const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
        tMin += Number(st.minutes ?? st.minutesPlayed ?? 0);
        tPts += comp.points || 0;
        tReb += comp.rebounds || 0;
        tAst += Number(st.assists ?? st.ast ?? 0);
        tStl += Number(st.steals ?? st.stl ?? 0);
        tTov += Number(st.turnovers ?? st.tov ?? 0);
        tVal += comp.pir || 0;
      });

      const multPJ = gamesCount > 0 ? 1 / gamesCount : 0;
      const mult40 = tMin > 0 ? 40 / tMin : 0;

      return {
        id: p.id,
        name: `#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim() || p.name || 'Jugador',
        gamesCount,
        min: tMin,
        avgMin: (tMin * multPJ).toFixed(1),
        
        ptsPJ: seasonAgg?.averages?.ppg !== undefined ? seasonAgg.averages.ppg : Number((tPts * multPJ).toFixed(1)),
        rebPJ: seasonAgg?.averages?.rpg !== undefined ? seasonAgg.averages.rpg : Number((tReb * multPJ).toFixed(1)),
        astPJ: seasonAgg?.averages?.apg !== undefined ? seasonAgg.averages.apg : Number((tAst * multPJ).toFixed(1)),
        stlPJ: seasonAgg?.averages?.spg !== undefined ? seasonAgg.averages.spg : Number((tStl * multPJ).toFixed(1)),
        tovPJ: seasonAgg?.totals?.tov !== undefined ? Number((seasonAgg.totals.tov * multPJ).toFixed(1)) : Number((tTov * multPJ).toFixed(1)),
        valPJ: seasonAgg?.averages?.pir !== undefined ? seasonAgg.averages.pir : Number((tVal * multPJ).toFixed(1)),

        pts40: Number((tPts * mult40).toFixed(1)),
        reb40: Number((tReb * mult40).toFixed(1)),
        ast40: Number((tAst * mult40).toFixed(1)),
        stl40: Number((tStl * mult40).toFixed(1)),
        tov40: Number((tTov * mult40).toFixed(1)),
        val40: Number((tVal * mult40).toFixed(1))
      };
    });

    list.sort((a, b) => {
      let valA = a[this.seasonSortField];
      let valB = b[this.seasonSortField];
      if (typeof valA === "string") {
        return this.seasonSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return this.seasonSortAsc ? valA - valB : valB - valA;
    });

    return list;
  }

  // =========================================================================
  // GENERADORES DE GRÁFICAS SVG VECTORIALES
  // =========================================================================
  
  _generateQuarterChartSVG(periodScores = []) {
    const quarters = [1, 2, 3, 4];
    const defaultScores = [
      { q: "Q1", team: 18, opp: 17 },
      { q: "Q2", team: 20, opp: 18 },
      { q: "Q3", team: 12, opp: 19 },
      { q: "Q4", team: 16, opp: 19 }
    ];

    const data = quarters.map(qNum => {
      const found = periodScores.find(p => Number(p.period_number ?? p.periodNumber) === qNum);
      return {
        q: `Q${qNum}`,
        team: found ? Number(found.team_score ?? found.teamScore ?? 0) : defaultScores[qNum - 1].team,
        opp: found ? Number(found.opponent_score ?? found.opponentScore ?? 0) : defaultScores[qNum - 1].opp
      };
    });

    const width = 600;
    const height = 130;
    const padding = 20;

    return `
      <div style="margin: 16px 0;">
        <div style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 6px; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
          <span>RENDIMIENTO POR CUARTOS</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: 120px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#94a3b8" stroke-width="1.5" />
          ${data.map((d, i) => {
            const xGroup = padding + 40 + i * 130;
            const hTeam = Math.min(80, d.team * 3);
            const hOpp = Math.min(80, d.opp * 3);
            return `
              <rect x="${xGroup}" y="${height - padding - hTeam}" width="22" height="${hTeam}" fill="#1e3a8a" rx="3" />
              <text x="${xGroup + 11}" y="${height - padding - hTeam - 4}" font-size="9" font-weight="800" fill="#1e3a8a" text-anchor="middle">${d.team}</text>

              <rect x="${xGroup + 26}" y="${height - padding - hOpp}" width="22" height="${hOpp}" fill="#f97316" rx="3" />
              <text x="${xGroup + 37}" y="${height - padding - hOpp - 4}" font-size="9" font-weight="800" fill="#f97316" text-anchor="middle">${d.opp}</text>

              <text x="${xGroup + 24}" y="${height - 6}" font-size="10" font-weight="800" fill="#64748b" text-anchor="middle">${d.q}</text>
            `;
          }).join("")}
        </svg>
        <div style="display: flex; justify-content: center; gap: 16px; font-size: 10px; font-weight: 800; margin-top: 4px;">
          <span style="color: #1e3a8a;">■ Nosotros</span>
          <span style="color: #f97316;">■ Rival</span>
        </div>
      </div>
    `;
  }

  _generateSVGChart(dataPoints, strokeColor = "#1e3a8a", title = "", tooltipText = "") {
    const width = 600;
    const height = 130;
    const padding = 25;

    if (!dataPoints || dataPoints.length === 0) return "";

    let maxVal = Math.max(...dataPoints.map(d => d.val), 10);
    let minVal = Math.min(...dataPoints.map(d => d.val), 0);
    const rangeY = (maxVal - minVal) || 1;

    const points = dataPoints.map((pt, i) => {
      const x = padding + (i / Math.max(1, dataPoints.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((pt.val - minVal) / rangeY) * (height - 2 * padding);
      return { x, y, val: pt.val, label: pt.label };
    });

    let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cx = (p1.x + p2.x) / 2;
      pathD += ` C ${cx.toFixed(1)},${p1.y.toFixed(1)} ${cx.toFixed(1)},${p2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return `
      <div style="margin: 16px 0;">
        ${title ? `
          <div style="font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 6px; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
            <span>${title}</span>
            ${tooltipText ? `
              <span class="has-tooltip">
                <span class="info-badge">?</span>
                <span class="tooltip-box">${tooltipText}</span>
              </span>
            ` : ''}
          </div>
        ` : ''}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: 120px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#94a3b8" stroke-width="1.5" />
          <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" />
          ${points.map(p => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${strokeColor}" stroke="#ffffff" stroke-width="1.5" />
            <text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" font-size="9" font-weight="800" fill="#0f172a" text-anchor="middle">${p.val}</text>
            <text x="${p.x.toFixed(1)}" y="${height - 8}" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">${p.label}</text>
          `).join("")}
        </svg>
      </div>
    `;
  }

  _renderSeasonColectiveCharts() {
    const activeTeamId = DataStore.getActiveTeamId();
    const games = (DataStore.getGames(activeTeamId) || []).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    
    const ptsTrend = [];
    const tovTrend = [];
    const valTrend = [];
    const efgTrend = [];

    games.forEach((g, idx) => {
      const stats = DataStore.getPlayerGameStats(null, g.id) || [];
      let totPts = Number(g.team_score ?? g.teamScore ?? g.our_score ?? 0);
      let totTov = 0, totVal = 0, totFga = 0, totFg3m = 0, totFg2m = 0;

      stats.forEach(st => {
        const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
        totTov += Number(st.turnovers ?? st.tov ?? 0);
        totVal += comp.pir || 0;
        totFg2m += Number(st.fg2_made ?? st.fg2Made ?? 0);
        totFg3m += Number(st.fg3_made ?? st.fg3Made ?? 0);
        totFga += (Number(st.fg2_attempted || 0) + Number(st.fg3_attempted || 0));
      });

      const fgm = totFg2m + totFg3m;
      const efg = totFga > 0 ? Math.round(((fgm + 0.5 * totFg3m) / totFga) * 100) : 35;

      ptsTrend.push({ label: `P${idx + 1}`, val: totPts });
      tovTrend.push({ label: `P${idx + 1}`, val: totTov });
      valTrend.push({ label: `P${idx + 1}`, val: totVal });
      efgTrend.push({ label: `P${idx + 1}`, val: efg });
    });

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
          📈 EVOLUCIÓN GLOBAL Y RENDIMIENTO ACUMULADO DEL EQUIPO
        </h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          <div>${this._generateSVGChart(ptsTrend, "#1e3a8a", "Puntos Anotados por Partido", "Evolución cronológica de la anotación a favor del equipo por jornada.")}</div>
          <div>${this._generateSVGChart(efgTrend, "#9333ea", "Efectividad de Tiro Efectivo (eFG%)", "Mide la eficacia de lanzamiento bonificando en un 50% los triples anotados.")}</div>
          <div>${this._generateSVGChart(tovTrend, "#dc2626", "Pérdidas de Balón (TO)", "Volumen total de balones perdidos en cada partido disputado.")}</div>
          <div>${this._generateSVGChart(valTrend, "#16a34a", "Valoración FIBA Colectiva", "Suma total de la valoración FIBA generada por la plantilla por jornada.")}</div>
        </div>

        ${this._renderGamesLegendTable(games)}
      </div>
    `;
  }

  _renderGamesLegendTable(gamesList = []) {
    if (!gamesList || gamesList.length === 0) return "";

    const sortedGames = [...gamesList].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const rows = sortedGames.map((g, i) => `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
        <td style="padding: 6px 10px; font-weight: 800; color: #1e3a8a;">P${i + 1}</td>
        <td style="padding: 6px 10px; color: #64748b;">${g.date ? (I18n.formatDate ? I18n.formatDate(g.date) : g.date) : '-'}</td>
        <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;">vs ${g.opponent || g.opponentName || 'Rival'}</td>
        <td style="padding: 6px 10px; text-align: center;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #475569;">${g.venue || 'Local'}</span></td>
        <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #0f172a;">${g.team_score ?? g.teamScore ?? 0} - ${g.opponent_score ?? g.opponentScore ?? 0}</td>
      </tr>
    `).join("");

    return `
      <div style="margin-top: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; overflow-x: auto;">
        <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
          📌 LEYENDA DE PARTIDOS (P1 - P${sortedGames.length})
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; font-size: 10px; font-weight: 800; color: #64748b; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">
              <th style="padding: 6px 10px;">CÓDIGO</th>
              <th style="padding: 6px 10px;">FECHA</th>
              <th style="padding: 6px 10px;">RIVAL</th>
              <th style="padding: 6px 10px; text-align: center;">SEDE</th>
              <th style="padding: 6px 10px; text-align: center;">MARCADOR</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // =========================================================================
  // EXPORTADOR A PDF ÉLITE
  // =========================================================================
  _exportToPDFDirect() {
    const activeTeamId = DataStore.getActiveTeamId();
    const games = (DataStore.getGames(activeTeamId) || []).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const players = DataStore.getPlayers(activeTeamId) || [];
    const playersMap = new Map(players.map(p => [String(p.id), p]));
    const teamObj = DataStore.getTeamById(activeTeamId) || {};
    const teamName = teamObj.name || "Equipo Oficial";
    const dateStr = (I18n && typeof I18n.formatDate === "function") ? I18n.formatDate(new Date().toISOString().split("T")[0]) : new Date().toLocaleDateString();

    let targetGames = games;
    if (this.exportGamesScope === "current" && this.selectedGameId) {
      targetGames = games.filter(g => String(g.id) === String(this.selectedGameId));
    } else if (this.exportGamesScope === "custom" && this.selectedExportGameIds.length > 0) {
      targetGames = games.filter(g => this.selectedExportGameIds.includes(String(g.id)));
    }

    let targetPlayers = players;
    if (this.exportPlayersScope === "none") {
      targetPlayers = [];
    } else if (this.exportPlayersScope === "current" && this.selectedPlayerId) {
      targetPlayers = players.filter(p => String(p.id) === String(this.selectedPlayerId));
    } else if (this.exportPlayersScope === "custom" && this.selectedExportPlayerIds.length > 0) {
      targetPlayers = players.filter(p => this.selectedExportPlayerIds.includes(String(p.id)));
    }

    let pdfHtml = `
      <div style="page-break-after: always; text-align: center; padding-top: 100px; font-family: system-ui, sans-serif;">
        <div style="font-size: 32px; font-weight: 900; color: #1e3a8a; letter-spacing: 2px;">IQ Basket Stats</div>
        <div style="font-size: 14px; font-weight: 800; color: #f97316; margin-top: 6px; text-transform: uppercase;">
          INFORME DE SCOUTING AVANZADO Y RENDIMIENTO ÉLITE
        </div>
        
        <div style="margin: 50px auto; width: 120px; height: 4px; background: #1e3a8a; border-radius: 2px;"></div>

        <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin-bottom: 8px;">${teamName}</h1>
        <div style="font-size: 13px; color: #64748b; font-weight: 600;">
          Partidos incluidos: ${targetGames.length} · Jugadores analizados: ${targetPlayers.length} · Fecha: ${dateStr}
        </div>

        <div style="margin-top: 160px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Documento Técnico Oficial para Cuerpo Técnico<br/>
          © IQ Basket, 2026
        </div>
      </div>
    `;

    let pageNum = 2;

    if (this.exportGamesScope === "all" && this.includeChartsInPDF) {
      pdfHtml += `
        <div style="page-break-after: always; padding-top: 10px;">
          <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; font-size: 11px; color: #64748b;">
            <strong>IQ Basket Stats</strong> · EVALUACIÓN COLECTIVA DE TEMPORADA
          </div>
          ${this._renderSeasonColectiveCharts()}
          <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: right;">Página ${pageNum}</div>
        </div>
      `;
      pageNum++;
    }

    targetGames.forEach((g, idx) => {
      const statsList = DataStore.getPlayerGameStats(null, g.id) || [];
      const periodScores = DataStore.getGamePeriodScores(g.id) || [];
      const teamPts = g.team_score ?? g.teamScore ?? g.our_score ?? 0;
      const oppPts = g.opponent_score ?? g.opponentScore ?? g.opp_score ?? 0;

      let rowsPdf = statsList.map(st => {
        const pInfo = playersMap.get(String(st.player_id ?? st.playerId)) || {};
        const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
        return `
          <tr>
            <td style="text-align: left; font-weight: 700;">#${pInfo.jersey ?? pInfo.number ?? '?'} ${pInfo.first_name || pInfo.firstName || ''} ${pInfo.last_name || pInfo.lastName || ''}</td>
            <td>${st.minutes ?? st.minutesPlayed ?? 0}</td>
            <td style="font-weight: 800;">${comp.points || 0}</td>
            <td>${comp.rebounds || 0}</td>
            <td>${st.assists ?? st.ast ?? 0}</td>
            <td>${st.steals ?? st.stl ?? 0}</td>
            <td style="color: #dc2626;">${st.turnovers ?? st.tov ?? 0}</td>
            <td style="font-weight: 900; color: #1e3a8a;">${comp.pir || 0}</td>
          </tr>
        `;
      }).join("");

      pdfHtml += `
        <div style="page-break-after: always; padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; font-size: 11px; color: #64748b;">
            <strong>IQ Basket Stats</strong>
            <span>PARTIDO ${idx + 1} DE ${targetGames.length} · ${g.date ? (I18n.formatDate ? I18n.formatDate(g.date) : g.date) : ''}</span>
          </div>

          <h2 style="margin: 16px 0 4px 0; font-size: 18px; color: #0f172a;">vs ${g.opponent || g.opponentName || 'Rival'} (${g.venue || 'Local'})</h2>
          <div style="display: inline-block; background: #1e3a8a; color: white; padding: 4px 16px; border-radius: 20px; font-weight: 800; font-size: 14px; margin-bottom: 16px;">
            Resultado: ${teamPts} - ${oppPts}
          </div>

          ${this.includeChartsInPDF ? this._generateQuarterChartSVG(periodScores) : ''}

          <table class="data-table" style="width:100%; border-collapse:collapse; text-align:center;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                <th style="text-align: left; padding:8px;">JUGADOR</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>PER</th><th>VAL</th>
              </tr>
            </thead>
            <tbody>${rowsPdf}</tbody>
          </table>

          <div style="margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: right;">Página ${pageNum}</div>
        </div>
      `;
      pageNum++;
    });

    targetPlayers.forEach(player => {
      const pStats = (DataStore.getPlayerGameStats() || []).filter(s => String(s.player_id ?? s.playerId) === String(player.id));
      const playerGames = [];

      pStats.forEach((st) => {
        const g = games.find(x => String(x.id) === String(st.game_id ?? st.gameId));
        if (g) playerGames.push(g);
      });

      let tMin = 0, tPts = 0, tReb = 0, tAst = 0, tVal = 0;
      const valTrend = [];

      const rows = pStats.map((st, idx) => {
        const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
        tMin += Number(st.minutes ?? st.minutesPlayed ?? 0);
        tPts += comp.points || 0;
        tReb += comp.rebounds || 0;
        tAst += Number(st.assists ?? st.ast ?? 0);
        tVal += comp.pir || 0;
        valTrend.push({ label: `P${idx + 1}`, val: comp.pir || 0 });

        return `
          <tr>
            <td style="font-weight:700; color:#1e3a8a;">P${idx + 1}</td>
            <td>${st.minutes ?? st.minutesPlayed ?? 0}'</td>
            <td style="font-weight: 800;">${comp.points || 0}</td>
            <td>${comp.rebounds || 0}</td>
            <td>${st.assists ?? st.ast ?? 0}</td>
            <td>${st.steals ?? st.stl ?? 0}</td>
            <td style="color:#dc2626;">${st.turnovers ?? st.tov ?? 0}</td>
            <td style="font-weight: 900; color:#1e3a8a;">${comp.pir || 0}</td>
          </tr>
        `;
      }).join("");

      pdfHtml += `
        <div style="page-break-after: always; padding-top: 10px;">
          <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; font-size: 11px; color: #64748b; display:flex; justify-content:space-between;">
            <strong>IQ Basket Stats</strong>
            <span>ANÁLISIS INDIVIDUAL DE JUGADOR</span>
          </div>

          <h2 style="margin: 16px 0 4px 0; font-size: 22px; color: #0f172a;">#${player.jersey ?? player.number ?? '-'} ${player.first_name || player.firstName || ''} ${player.last_name || player.lastName || ''}</h2>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 16px;">Posición: ${player.primary_position || player.primaryPosition || 'Jugador'} · Partidos Disputados: ${pStats.length}</div>

          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex:1; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
              <span style="font-size:10px; color:#64748b;">PTS/Partido</span>
              <strong style="display:block; font-size:18px; color:#1e3a8a;">${(tPts / Math.max(1, pStats.length)).toFixed(1)}</strong>
            </div>
            <div style="flex:1; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
              <span style="font-size:10px; color:#64748b;">REB/Partido</span>
              <strong style="display:block; font-size:18px; color:#1e3a8a;">${(tReb / Math.max(1, pStats.length)).toFixed(1)}</strong>
            </div>
            <div style="flex:1; border:1px solid #e2e8f0; padding:10px; border-radius:8px; text-align:center;">
              <span style="font-size:10px; color:#64748b;">VAL/Partido</span>
              <strong style="display:block; font-size:18px; color:#16a34a;">${(tVal / Math.max(1, pStats.length)).toFixed(1)}</strong>
            </div>
          </div>

          ${this.includeChartsInPDF ? this._generateSVGChart(valTrend, "#16a34a", "EVOLUCIÓN DE VALORACIÓN FIBA POR PARTIDO") : ''}
          ${this._renderGamesLegendTable(playerGames)}

          <h3 style="font-size: 12px; font-weight: 800; color: #475569; margin-top: 16px; margin-bottom: 8px;">DETALLE DE ESTADÍSTICAS POR PARTIDO</h3>
          <table class="data-table" style="width:100%; border-collapse:collapse; text-align:center;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                <th style="padding:8px;">CÓDIGO</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>PER</th><th>VAL</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8">Sin datos</td></tr>'}</tbody>
          </table>

          <div style="margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: right;">Página ${pageNum}</div>
        </div>
      `;
      pageNum++;
    });

    if (ReportExporter && typeof ReportExporter.printReport === "function") {
      ReportExporter.printReport(`Informe_Elite_IQBasket`, pdfHtml);
    } else {
      window.print();
    }
  }

  // =========================================================================
  // RENDERIZADO INTERFAZ INTERACTIVA
  // =========================================================================
  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    const activeTeamId = DataStore.getActiveTeamId();
    const games = DataStore.getGames(activeTeamId) || DataStore.getGames() || [];
    const players = DataStore.getPlayers(activeTeamId) || DataStore.getPlayers() || [];
    const gameData = this._getSelectedGameData();
    const seasonList = this._getSeasonPer40StatsList();

    if (!this.selectedPlayerId && players.length > 0) {
      this.selectedPlayerId = players[0].id;
    }

    const { game, teamPts, oppPts, diffPts, poss, offRtg, defRtg, netRtg, playersList, strengths, weaknesses, periodScores } = gameData || {
      game: {}, teamPts: 0, oppPts: 0, diffPts: 0, poss: 70, offRtg: 0, defRtg: 0, netRtg: 0, playersList: [], strengths: [], weaknesses: [], periodScores: []
    };
    const isWin = diffPts > 0;

    const gameOptionsMarkup = games.map(g => `
      <option value="${g.id}" ${String(g.id) === String(this.selectedGameId) ? 'selected' : ''}>
        vs ${g.opponent || g.opponentName || 'Rival'} (${g.date ? (I18n.formatDate ? I18n.formatDate(g.date) : g.date) : ''}) - ${g.team_score ?? g.teamScore ?? 0} : ${g.opponent_score ?? g.opponentScore ?? 0}
      </option>
    `).join("");

    const playerOptionsMarkup = players.map(p => `
      <option value="${p.id}" ${String(p.id) === String(this.selectedPlayerId) ? 'selected' : ''}>
        #${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}
      </option>
    `).join("");

    const getSortArrow = (field, currentField, isAsc) => {
      if (currentField !== field) return "↕";
      return isAsc ? "↑" : "↓";
    };

    const playersTableMarkup = (playersList || []).map(p => `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${p.name}</td>
        <td style="padding: 10px; text-align: center; color: #64748b;">${p.min}'</td>
        <td style="padding: 10px; text-align: center; font-weight: 800; color: #0f172a;">${p.pts}</td>
        <td style="padding: 10px; text-align: center; color: #64748b;">${p.reb}</td>
        <td style="padding: 10px; text-align: center; color: #64748b;">${p.ast}</td>
        <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 700;">${p.tov}</td>
        <td style="padding: 10px; text-align: center; font-weight: 900; color: #a855f7;">${p.val}</td>
        <td style="padding: 10px; text-align: center; font-weight: 900; color: #f97316;">${p.gs}</td>
      </tr>
    `).join("");

    const seasonTableMarkup = seasonList.map(p => {
      const isPer40 = this.seasonMetricMode === "per_40";
      const pts = isPer40 ? p.pts40 : p.ptsPJ;
      const reb = isPer40 ? p.reb40 : p.rebPJ;
      const ast = isPer40 ? p.ast40 : p.astPJ;
      const stl = isPer40 ? p.stl40 : p.stlPJ;
      const tov = isPer40 ? p.tov40 : p.tovPJ;
      const val = isPer40 ? p.val40 : p.valPJ;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${p.name}</td>
          <td style="padding: 10px; text-align: center; color: #64748b;">${p.gamesCount} PJ (${p.min}')</td>
          <td style="padding: 10px; text-align: center; font-weight: 800; color: #0f172a;">${pts}</td>
          <td style="padding: 10px; text-align: center; color: #64748b;">${reb}</td>
          <td style="padding: 10px; text-align: center; color: #64748b;">${ast}</td>
          <td style="padding: 10px; text-align: center; color: #16a34a; font-weight: 700;">${stl}</td>
          <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: 700;">${tov}</td>
          <td style="padding: 10px; text-align: center; font-weight: 900; color: #1e3a8a;">
            ${val} 
            <span style="font-size:10px; font-weight:700; color:#94a3b8;">
              ${isPer40 ? '(VAL/40)' : '(VAL/PJ)'}
            </span>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); padding-bottom: 40px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">
            ${this.t("reports_module", "Módulo de Informes")}
          </h1>

          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button id="btn-mode-game" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.reportMode === 'game' ? '#1e3a8a' : '#ffffff'}; color: ${this.reportMode === 'game' ? '#ffffff' : '#334155'};">
              📄 Por Partido
            </button>
            <button id="btn-mode-season" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.reportMode === 'season' ? '#1e3a8a' : '#ffffff'}; color: ${this.reportMode === 'season' ? '#ffffff' : '#334155'};">
              📅 Resumen Temporada
            </button>
            <button id="btn-mode-player" style="padding: 8px 14px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 44px; background: ${this.reportMode === 'player' ? '#1e3a8a' : '#ffffff'}; color: ${this.reportMode === 'player' ? '#ffffff' : '#334155'};">
              👤 Ficha Individual
            </button>
          </div>
        </div>

        <!-- PANEL DE CONFIGURACIÓN Y EXPORTACIÓN PDF -->
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              ⚙️ CONFIGURACIÓN DE INFORMES Y EXPORTACIÓN A PDF
            </div>
            <button id="btn-trigger-pdf" style="padding: 10px 18px; border-radius: 8px; border: none; font-size: 13px; font-weight: 800; cursor: pointer; background: #16a34a; color: #ffffff; display: flex; align-items: center; gap: 6px; min-height: 44px;">
              📥 Exportar PDF Élite
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
              <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; display: block; margin-bottom: 8px;">
                1. Partidos a incluir en el Informe
              </span>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: #0f172a;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-games-scope" value="current" ${this.exportGamesScope === 'current' ? 'checked' : ''} />
                  <span>Partido Seleccionado Actualmente</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-games-scope" value="all" ${this.exportGamesScope === 'all' ? 'checked' : ''} />
                  <span>Todos los partidos de la Temporada (${games.length})</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-games-scope" value="custom" ${this.exportGamesScope === 'custom' ? 'checked' : ''} />
                  <span>Selección personalizada de partidos</span>
                </label>
              </div>

              ${this.exportGamesScope === 'custom' ? `
                <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                  ${games.map((g, i) => `
                    <label style="font-size: 11px; font-weight: 700; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                      <input type="checkbox" class="chk-export-game" value="${g.id}" ${this.selectedExportGameIds.includes(String(g.id)) ? 'checked' : ''} />
                      P${i + 1}
                    </label>
                  `).join("")}
                </div>
              ` : ''}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
              <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; display: block; margin-bottom: 8px;">
                2. Fichas Individuales de Jugadores a incluir
              </span>
              <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: #0f172a;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-players-scope" value="none" ${this.exportPlayersScope === 'none' ? 'checked' : ''} />
                  <span>Sin fichas individuales</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-players-scope" value="current" ${this.exportPlayersScope === 'current' ? 'checked' : ''} />
                  <span>Jugador Seleccionado Actualmente</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-players-scope" value="all" ${this.exportPlayersScope === 'all' ? 'checked' : ''} />
                  <span>Toda la Plantilla (${players.length} jugadores)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; min-height: 36px;">
                  <input type="radio" name="radio-players-scope" value="custom" ${this.exportPlayersScope === 'custom' ? 'checked' : ''} />
                  <span>Seleccionar Jugadores concretos</span>
                </label>
              </div>

              ${this.exportPlayersScope === 'custom' ? `
                <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                  ${players.map(p => `
                    <label style="font-size: 11px; font-weight: 700; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                      <input type="checkbox" class="chk-export-player" value="${p.id}" ${this.selectedExportPlayerIds.includes(String(p.id)) ? 'checked' : ''} />
                      #${p.jersey ?? p.number ?? ''} ${p.first_name || p.firstName || ''}
                    </label>
                  `).join("")}
                </div>
              ` : ''}
            </div>

          </div>

          <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px; font-size: 12px;">
            <input type="checkbox" id="chk-include-charts" ${this.includeChartsInPDF ? 'checked' : ''} />
            <label for="chk-include-charts" style="font-weight: 700; color: #334155; cursor: pointer;">
              📈 Incluir Gráficas Vectoriales SVG de Evolución y Tendencia Colectiva en el PDF
            </label>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
          ${this.reportMode === 'game' ? `
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">SELECCIONAR PARTIDO:</label>
              <select id="select-report-game" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: #ffffff; color: #0f172a; outline: none; cursor: pointer; min-height: 44px;">
                ${gameOptionsMarkup}
              </select>
            </div>
          ` : ''}

          ${this.reportMode === 'player' ? `
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <label style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">SELECCIONAR JUGADOR:</label>
              <select id="select-report-player" style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: #ffffff; color: #0f172a; outline: none; cursor: pointer; min-height: 44px;">
                ${playerOptionsMarkup}
              </select>
            </div>
          ` : ''}

          ${this.reportMode === 'season' ? `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div style="font-size: 13px; font-weight: 800; color: #1e3a8a;">
                📊 RADIOGRAFÍA COLECTIVA Y ANÁLISIS ACUMULADO (${games.length} Partidos)
              </div>
              <div style="background: #f1f5f9; padding: 4px; border-radius: 8px; display: flex; gap: 4px;">
                <button id="btn-season-pergame" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; min-height: 36px; background: ${this.seasonMetricMode === 'per_game' ? '#ffffff' : 'transparent'}; color: ${this.seasonMetricMode === 'per_game' ? '#1e3a8a' : '#64748b'};">
                  Por Partido (VAL/PJ)
                </button>
                <button id="btn-season-per40" style="padding: 6px 12px; border-radius: 6px; border: none; font-size: 11px; font-weight: 800; cursor: pointer; min-height: 36px; background: ${this.seasonMetricMode === 'per_40' ? '#ffffff' : 'transparent'}; color: ${this.seasonMetricMode === 'per_40' ? '#1e3a8a' : '#64748b'};">
                  Por 40 Min (VAL/40)
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- MODO PARTIDO -->
        ${this.reportMode === 'game' && gameData ? `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;">${game.opponent || game.opponentName || 'Rival'}</h2>
                  <span style="background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">${game.venue || 'Local'}</span>
                  <span style="background: ${isWin ? '#dcfce7' : '#fee2e2'}; color: ${isWin ? '#15803d' : '#dc2626'}; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">${isWin ? 'Victoria' : 'Derrota'}</span>
                </div>
                <span style="font-size: 12px; color: #64748b; margin-top: 4px; display: block;">${game.date ? (I18n.formatDate ? I18n.formatDate(game.date) : game.date) : ''} · Jornada</span>
              </div>

              <div style="text-align: right;">
                <span style="font-size: 32px; font-weight: 900; color: ${isWin ? '#16a34a' : '#dc2626'};">${teamPts} - ${oppPts}</span>
                <span style="display: block; font-size: 11px; color: #64748b; font-weight: 700;">Diferencia: ${diffPts > 0 ? '+' : ''}${diffPts}</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px;">
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <span class="has-tooltip">
                  <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Offensive Rating</span>
                  <span class="info-badge">?</span>
                  <span class="tooltip-box">Puntos anotados por nuestro equipo por cada 100 posesiones en este partido.</span>
                </span>
                <strong style="font-size: 22px; font-weight: 900; color: #0f172a; display: block; margin-top: 4px;">${offRtg}</strong>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <span class="has-tooltip">
                  <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Defensive Rating</span>
                  <span class="info-badge">?</span>
                  <span class="tooltip-box">Puntos permitidos al rival por cada 100 posesiones en este partido.</span>
                </span>
                <strong style="font-size: 22px; font-weight: 900; color: #0f172a; display: block; margin-top: 4px;">${defRtg}</strong>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <span class="has-tooltip">
                  <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Net Rating</span>
                  <span class="info-badge">?</span>
                  <span class="tooltip-box">Margen de eficiencia neto por cada 100 posesiones (Offensive Rating - Defensive Rating).</span>
                </span>
                <strong style="font-size: 22px; font-weight: 900; color: ${netRtg < 0 ? '#dc2626' : '#16a34a'}; display: block; margin-top: 4px;">${netRtg > 0 ? '+' : ''}${netRtg}</strong>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;">
                <span class="has-tooltip">
                  <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Posesiones</span>
                  <span class="info-badge">?</span>
                  <span class="tooltip-box">Estimación total de posesiones de balón jugadas en el partido: Tiros de Campo + (0.44 x Tiros Libres) + Pérdidas.</span>
                </span>
                <strong style="font-size: 22px; font-weight: 900; color: #0f172a; display: block; margin-top: 4px;">${poss}</strong>
              </div>
            </div>

            ${this._generateQuarterChartSVG(periodScores)}
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 20px; overflow-x: auto;">
            <h3 style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-top: 0; margin-bottom: 16px;">JUGADORES</h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                  <th class="btn-sort-head" data-field="name" style="padding: 10px 12px; cursor: pointer;">JUGADOR ${getSortArrow('name', this.sortField, this.sortAsc)}</th>
                  <th class="btn-sort-head" data-field="min" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      MIN <span class="info-badge">?</span>
                      <span class="tooltip-box">Minutos jugados en pista.</span>
                    </span>
                    ${getSortArrow('min', this.sortField, this.sortAsc)}
                  </th>
                  <th class="btn-sort-head" data-field="pts" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      PTS <span class="info-badge">?</span>
                      <span class="tooltip-box">Puntos totales anotados (Tiros de 2 + Triples + Tiros Libres).</span>
                    </span>
                    ${getSortArrow('pts', this.sortField, this.sortAsc)}
                  </th>
                  <th class="btn-sort-head" data-field="reb" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      REB <span class="info-badge">?</span>
                      <span class="tooltip-box">Rebotes totales capturados (Ofensivos + Defensivos).</span>
                    </span>
                    ${getSortArrow('reb', this.sortField, this.sortAsc)}
                  </th>
                  <th class="btn-sort-head" data-field="ast" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      AST <span class="info-badge">?</span>
                      <span class="tooltip-box">Pases de canasta directos convertidos por compañeros.</span>
                    </span>
                    ${getSortArrow('ast', this.sortField, this.sortAsc)}
                  </th>
                  <th class="btn-sort-head" data-field="tov" style="padding: 10px; text-align: center; color: #ef4444; cursor: pointer;">
                    <span class="has-tooltip">
                      PER <span class="info-badge">?</span>
                      <span class="tooltip-box">Balones perdidos por mal pase, bote o falta en ataque.</span>
                    </span>
                    ${getSortArrow('tov', this.sortField, this.sortAsc)}
                  </th>
                  <th class="btn-sort-head" data-field="val" style="padding: 10px; text-align: center; color: #a855f7; cursor: pointer;">
                    <span class="has-tooltip">
                      VAL FIBA <span class="info-badge">?</span>
                      <span class="tooltip-box">Valoración Oficial FIBA: (Pts + Reb + Ast + Rob + Tap + FR) - (Tiros Fallados + TO + FC).</span>
                    </span>
                    ${getSortArrow('val', this.sortField, this.sortAsc)}
                  </th>
                  <th class="btn-sort-head" data-field="gs" style="padding: 10px; text-align: center; color: #f97316; cursor: pointer;">
                    <span class="has-tooltip">
                      GS <span class="info-badge">?</span>
                      <span class="tooltip-box">Game Score (John Hollinger): Ponderación de impacto global del jugador en pista.</span>
                    </span>
                    ${getSortArrow('gs', this.sortField, this.sortAsc)}
                  </th>
                </tr>
              </thead>
              <tbody>${playersTableMarkup}</tbody>
            </table>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
            <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #15803d;">✔ FORTALEZAS CLAVE</h4>
              <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #166534; line-height: 1.5;">
                ${strengths.map(s => `<li>${s}</li>`).join("")}
              </ul>
            </div>

            <div style="background: #ffffff; border: 1px solid #fecaca; border-radius: 12px; padding: 16px;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #dc2626;">⚠ PROBLEMAS DETECTADOS</h4>
              <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #991b1b; line-height: 1.5;">
                ${weaknesses.map(w => `<li>${w}</li>`).join("")}
              </ul>
            </div>
          </div>
        ` : ''}

        <!-- MODO TEMPORADA -->
        ${this.reportMode === 'season' ? `
          ${this._renderSeasonColectiveCharts()}

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; margin-bottom: 20px; overflow-x: auto;">
            <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 0; display: flex; align-items: center; gap: 6px;">
              <span>1. DIAGNÓSTICO DEL SISTEMA COLECTIVO (FOUR FACTORS)</span>
              <span class="has-tooltip">
                <span class="info-badge">?</span>
                <span class="tooltip-box">Evaluación del equipo según los 4 Factores de Dean Oliver: eFG%, TOV%, Control del Rebote y Ratio de Tiro Libre.</span>
              </span>
            </h3>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              Diagnóstico colectivo basado en el compendio oficial de la temporada. La base competitiva descansa en el rebote y en la presión defensiva.
            </p>

            <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 24px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>2. TABLA COMPARATIVA DE PLANTILLA (${this.seasonMetricMode === 'per_game' ? 'POR PARTIDO' : 'POR 40 MINUTOS'})</span>
              <span class="has-tooltip">
                <span class="info-badge">?</span>
                <span class="tooltip-box">Promedios acumulados de cada jugador. Puedes alternar entre métricas Por Partido (PJ) o Proyección a 40 Minutos.</span>
              </span>
              <span style="font-size: 11px; color: #64748b; font-weight: 600; margin-left: auto;"> (Haz clic en la cabecera para ordenar)</span>
            </h3>

            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; margin-top: 10px;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-weight: 800; color: #475569;">
                  <th class="btn-sort-season" data-field="name" style="padding: 10px; cursor: pointer;">JUGADOR ${getSortArrow('name', this.seasonSortField, this.seasonSortAsc)}</th>
                  
                  <th class="btn-sort-season" data-field="min" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      MIN <span class="info-badge">?</span>
                      <span class="tooltip-box">Partidos Jugados y Minutos Totales disputados en la temporada.</span>
                    </span>
                    ${getSortArrow('min', this.seasonSortField, this.seasonSortAsc)}
                  </th>

                  <th class="btn-sort-season" data-field="${this.seasonMetricMode === 'per_game' ? 'ptsPJ' : 'pts40'}" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      PTS <span class="info-badge">?</span>
                      <span class="tooltip-box">Puntos promediados por encuentro (${this.seasonMetricMode === 'per_game' ? 'Por Partido' : 'Proyección 40 Min'}).</span>
                    </span>
                    ${getSortArrow(this.seasonMetricMode === 'per_game' ? 'ptsPJ' : 'pts40', this.seasonSortField, this.seasonSortAsc)}
                  </th>

                  <th class="btn-sort-season" data-field="${this.seasonMetricMode === 'per_game' ? 'rebPJ' : 'reb40'}" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      REB <span class="info-badge">?</span>
                      <span class="tooltip-box">Rebotes totales promediados (${this.seasonMetricMode === 'per_game' ? 'Por Partido' : 'Proyección 40 Min'}).</span>
                    </span>
                    ${getSortArrow(this.seasonMetricMode === 'per_game' ? 'rebPJ' : 'reb40', this.seasonSortField, this.seasonSortAsc)}
                  </th>

                  <th class="btn-sort-season" data-field="${this.seasonMetricMode === 'per_game' ? 'astPJ' : 'ast40'}" style="padding: 10px; text-align: center; cursor: pointer;">
                    <span class="has-tooltip">
                      AST <span class="info-badge">?</span>
                      <span class="tooltip-box">Asistencias repartidas (${this.seasonMetricMode === 'per_game' ? 'Por Partido' : 'Proyección 40 Min'}).</span>
                    </span>
                    ${getSortArrow(this.seasonMetricMode === 'per_game' ? 'astPJ' : 'ast40', this.seasonSortField, this.seasonSortAsc)}
                  </th>

                  <th class="btn-sort-season" data-field="${this.seasonMetricMode === 'per_game' ? 'stlPJ' : 'stl40'}" style="padding: 10px; text-align: center; color: #16a34a; cursor: pointer;">
                    <span class="has-tooltip">
                      ROB <span class="info-badge">?</span>
                      <span class="tooltip-box">Balones recuperados (${this.seasonMetricMode === 'per_game' ? 'Por Partido' : 'Proyección 40 Min'}).</span>
                    </span>
                    ${getSortArrow(this.seasonMetricMode === 'per_game' ? 'stlPJ' : 'stl40', this.seasonSortField, this.seasonSortAsc)}
                  </th>

                  <th class="btn-sort-season" data-field="${this.seasonMetricMode === 'per_game' ? 'tovPJ' : 'tov40'}" style="padding: 10px; text-align: center; color: #ef4444; cursor: pointer;">
                    <span class="has-tooltip">
                      PER <span class="info-badge">?</span>
                      <span class="tooltip-box">Pérdidas de balón promediadas (${this.seasonMetricMode === 'per_game' ? 'Por Partido' : 'Proyección 40 Min'}).</span>
                    </span>
                    ${getSortArrow(this.seasonMetricMode === 'per_game' ? 'tovPJ' : 'tov40', this.seasonSortField, this.seasonSortAsc)}
                  </th>

                  <th class="btn-sort-season" data-field="${this.seasonMetricMode === 'per_game' ? 'valPJ' : 'val40'}" style="padding: 10px; text-align: center; color: #1e3a8a; cursor: pointer;">
                    <span class="has-tooltip">
                      VAL FIBA <span class="info-badge">?</span>
                      <span class="tooltip-box">Valoración FIBA oficial promediada por encuentro (${this.seasonMetricMode === 'per_game' ? 'Por Partido' : 'Proyección 40 Min'}).</span>
                    </span>
                    ${getSortArrow(this.seasonMetricMode === 'per_game' ? 'valPJ' : 'val40', this.seasonSortField, this.seasonSortAsc)}
                  </th>
                </tr>
              </thead>
              <tbody>${seasonTableMarkup}</tbody>
            </table>
          </div>
        ` : ''}

        <!-- MODO FICHA INDIVIDUAL DE JUGADOR -->
        ${this.reportMode === 'player' ? `
          ${(() => {
            const p = players.find(x => String(x.id) === String(this.selectedPlayerId)) || players[0];
            if (!p) return `<div style="padding:20px; color:#64748b;">Selecciona un jugador</div>`;

            const pStats = (DataStore.getPlayerGameStats() || []).filter(s => String(s.player_id ?? s.playerId) === String(p.id));
            const playerGames = [];

            pStats.forEach((st) => {
              const g = games.find(x => String(x.id) === String(st.game_id ?? st.gameId));
              if (g) playerGames.push(g);
            });

            let tMin = 0, tPts = 0, tReb = 0, tAst = 0, tVal = 0;
            const valTrend = [];

            const rows = pStats.map((st, i) => {
              const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
              tMin += Number(st.minutes ?? st.minutesPlayed ?? 0);
              tPts += comp.points || 0;
              tReb += comp.rebounds || 0;
              tAst += Number(st.assists ?? st.ast ?? 0);
              tVal += comp.pir || 0;
              valTrend.push({ label: `P${i + 1}`, val: comp.pir || 0 });

              return `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12px;">
                  <td style="padding: 8px 12px; font-weight: 700; color: #1e3a8a;">P${i + 1}</td>
                  <td style="padding: 8px; text-align: center;">${st.minutes ?? st.minutesPlayed ?? 0}'</td>
                  <td style="padding: 8px; text-align: center; font-weight: 800;">${comp.points || 0}</td>
                  <td style="padding: 8px; text-align: center;">${comp.rebounds || 0}</td>
                  <td style="padding: 8px; text-align: center;">${st.assists ?? st.ast ?? 0}</td>
                  <td style="padding: 8px; text-align: center;">${st.steals ?? st.stl ?? 0}</td>
                  <td style="padding: 8px; text-align: center; color: #dc2626;">${st.turnovers ?? st.tov ?? 0}</td>
                  <td style="padding: 8px; text-align: center; font-weight: 900; color: #1e3a8a;">${comp.pir || 0}</td>
                </tr>
              `;
            }).join("");

            return `
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; margin-bottom: 20px; overflow-x: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <div>
                    <h2 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;">#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}</h2>
                    <span style="font-size: 12px; color: #64748b;">Posición: ${p.primary_position || p.primaryPosition || 'Jugador'} · ${pStats.length} partidos jugados</span>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center;">
                    <span class="has-tooltip">
                      <span style="font-size: 10px; color: #64748b; font-weight: 800;">PTS / Partido</span>
                      <span class="info-badge">?</span>
                      <span class="tooltip-box">Promedio de puntos anotados por partido en la temporada.</span>
                    </span>
                    <strong style="display: block; font-size: 18px; color: #1e3a8a; margin-top: 4px;">${(tPts / Math.max(1, pStats.length)).toFixed(1)}</strong>
                  </div>

                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center;">
                    <span class="has-tooltip">
                      <span style="font-size: 10px; color: #64748b; font-weight: 800;">REB / Partido</span>
                      <span class="info-badge">?</span>
                      <span class="tooltip-box">Promedio de rebotes capturados (ofensivos y defensivos) por encuentro.</span>
                    </span>
                    <strong style="display: block; font-size: 18px; color: #1e3a8a; margin-top: 4px;">${(tReb / Math.max(1, pStats.length)).toFixed(1)}</strong>
                  </div>

                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center;">
                    <span class="has-tooltip">
                      <span style="font-size: 10px; color: #64748b; font-weight: 800;">AST / Partido</span>
                      <span class="info-badge">?</span>
                      <span class="tooltip-box">Promedio de asistencias repartidas por jornada.</span>
                    </span>
                    <strong style="display: block; font-size: 18px; color: #1e3a8a; margin-top: 4px;">${(tAst / Math.max(1, pStats.length)).toFixed(1)}</strong>
                  </div>

                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; text-align: center;">
                    <span class="has-tooltip">
                      <span style="font-size: 10px; color: #64748b; font-weight: 800;">VAL / Partido</span>
                      <span class="info-badge">?</span>
                      <span class="tooltip-box">Valoración Oficial FIBA promediada por partido. Coincide exactamente con la métrica del Dashboard.</span>
                    </span>
                    <strong style="display: block; font-size: 18px; color: #16a34a; margin-top: 4px;">${(tVal / Math.max(1, pStats.length)).toFixed(1)}</strong>
                  </div>
                </div>

                ${this.includeChartsInPDF ? this._generateSVGChart(valTrend, "#16a34a", "EVOLUCIÓN DE VALORACIÓN FIBA POR PARTIDO", "Tendencia de valoración individual del jugador a lo largo de las jornadas (P1, P2... Pn).") : ''}
                ${this._renderGamesLegendTable(playerGames)}

                <h3 style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-top: 16px; margin-bottom: 12px;">HISTÓRICO EN LA TEMPORADA</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="background: #f1f5f9; font-size: 11px; font-weight: 800; color: #475569;">
                      <th style="padding: 8px 12px;">CÓDIGO</th>
                      <th style="padding: 8px; text-align: center;">MIN</th>
                      <th style="padding: 8px; text-align: center;">PTS</th>
                      <th style="padding: 8px; text-align: center;">REB</th>
                      <th style="padding: 8px; text-align: center;">AST</th>
                      <th style="padding: 8px; text-align: center;">ROB</th>
                      <th style="padding: 8px; text-align: center; color: #dc2626;">PER</th>
                      <th style="padding: 8px; text-align: center; color: #1e3a8a;">VAL FIBA</th>
                    </tr>
                  </thead>
                  <tbody>${rows || '<tr><td colspan="8" style="padding: 12px; text-align: center; color: #64748b;">Sin datos</td></tr>'}</tbody>
                </table>
              </div>
            `;
          })()}
        ` : ''}

      </div>
    `;

    // Asignación de Listeners
    container.querySelectorAll(".btn-sort-head").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-field");
        if (this.sortField === field) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortField = field;
          this.sortAsc = false;
        }
        this.render(containerId);
      });
    });

    container.querySelectorAll(".btn-sort-season").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-field");
        if (this.seasonSortField === field) {
          this.seasonSortAsc = !this.seasonSortAsc;
        } else {
          this.seasonSortField = field;
          this.seasonSortAsc = false;
        }
        this.render(containerId);
      });
    });

    container.querySelector("#btn-season-pergame")?.addEventListener("click", () => {
      this.seasonMetricMode = "per_game";
      this.seasonSortField = "valPJ";
      this.render(containerId);
    });

    container.querySelector("#btn-season-per40")?.addEventListener("click", () => {
      this.seasonMetricMode = "per_40";
      this.seasonSortField = "val40";
      this.render(containerId);
    });

    container.querySelectorAll('input[name="radio-games-scope"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.exportGamesScope = e.target.value;
        this.render(containerId);
      });
    });

    container.querySelectorAll('input[name="radio-players-scope"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.exportPlayersScope = e.target.value;
        this.render(containerId);
      });
    });

    container.querySelectorAll(".chk-export-game").forEach(chk => {
      chk.addEventListener("change", () => {
        const val = String(chk.value);
        if (chk.checked) {
          if (!this.selectedExportGameIds.includes(val)) this.selectedExportGameIds.push(val);
        } else {
          this.selectedExportGameIds = this.selectedExportGameIds.filter(id => id !== val);
        }
      });
    });

    container.querySelectorAll(".chk-export-player").forEach(chk => {
      chk.addEventListener("change", () => {
        const val = String(chk.value);
        if (chk.checked) {
          if (!this.selectedExportPlayerIds.includes(val)) this.selectedExportPlayerIds.push(val);
        } else {
          this.selectedExportPlayerIds = this.selectedExportPlayerIds.filter(id => id !== val);
        }
      });
    });

    container.querySelector("#chk-include-charts")?.addEventListener("change", (e) => {
      this.includeChartsInPDF = e.target.checked;
    });

    container.querySelector("#btn-trigger-pdf")?.addEventListener("click", () => {
      this._exportToPDFDirect();
    });

    container.querySelector("#select-report-game")?.addEventListener("change", (e) => {
      this.selectedGameId = e.target.value;
      this.render(containerId);
    });

    container.querySelector("#select-report-player")?.addEventListener("change", (e) => {
      this.selectedPlayerId = e.target.value;
      this.render(containerId);
    });

    container.querySelector("#btn-mode-game")?.addEventListener("click", () => {
      this.reportMode = "game";
      this.render(containerId);
    });

    container.querySelector("#btn-mode-season")?.addEventListener("click", () => {
      this.reportMode = "season";
      this.render(containerId);
    });

    container.querySelector("#btn-mode-player")?.addEventListener("click", () => {
      this.reportMode = "player";
      this.render(containerId);
    });
  }
}

export default ReportsView;