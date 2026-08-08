/**
 * @fileoverview Vista del Dashboard de Temporada de IQ Basket (SeasonDashboardView.js).
 * Sincronizado con DataStore para carga instantánea desde memoria local y control de permisos por rol.
 * Muestra Valoración FIBA Por Partido (VAL / PJ) y Proyección Por 40 Minutos (VAL / 40)
 * en estricta coherencia con el Módulo de Informes. Traducido dinámicamente con I18nService.
 * Rediseñado en 3 Niveles UI/UX con responsividad avanzada para móvil y desktop.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { StatsSyncService } from "../services/StatsSyncService.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class SeasonDashboardView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.syncService = new StatsSyncService(this.supabase);

    this.sortState = {
      column: "date",
      ascending: false
    };

    // Pestaña activa del Nivel 2: Rendimiento del Equipo ('attack' | 'defense' | 'pace' | 'shooting')
    this.activePerformanceTab = "attack";

    this.cachedGames = [];
    this.cachedPlayerStats = [];
    this.cachedStatsMap = new Map();
    this.currentTeamId = null;
  }

  // =========================================================================
  // CONTROL DE PERMISOS POR ROL
  // =========================================================================
  _canSync() {
    if (!this.auth || typeof this.auth.hasRole !== "function") return true;
    return (
      this.auth.hasRole("SUPERADMIN") ||
      this.auth.hasRole("ADMIN") ||
      this.auth.hasRole("ENTRENADOR") ||
      this.auth.hasRole("ANALISTA")
    );
  }

  _formatDateES(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    return I18n.formatDate(dateStr);
  }

  /**
   * Extrae la puntuación probando todos los nombres posibles de columna en Supabase.
   */
  _normalizeGameScore(g) {
    if (!g) return { teamPts: 0, oppPts: 0, hasPlayed: false };

    const teamPts = g.team_score ?? g.our_score ?? g.points ?? null;
    const oppPts = g.opponent_score ?? g.opp_score ?? g.opp_points ?? null;

    const statusUpper = String(g.status || '').toUpperCase();
    const isCompleted = statusUpper === 'COMPLETED' || statusUpper === 'FINALIZADO' || statusUpper === 'FINAL';
    const hasPlayed = (teamPts !== null && oppPts !== null) || isCompleted;

    return { 
      teamPts: teamPts !== null ? Number(teamPts) : 0, 
      oppPts: oppPts !== null ? Number(oppPts) : 0,
      hasPlayed 
    };
  }

  /**
   * Obtiene los líderes en Valoración FIBA relacionando 'player_game_stats' con 'players'.
   * Calcula con precisión tanto VAL / PJ (Promedio Por Partido) como VAL / 40 min.
   */
  _getTopPlayers(playerStatsRows, playersMap) {
    const map = {};

    if (playerStatsRows && playerStatsRows.length > 0) {
      playerStatsRows.forEach((row) => {
        const pId = row.player_id || row.id;
        if (!pId) return;

        const pInfo = playersMap.get(pId) || {};
        const firstName = pInfo.first_name || "";
        const lastName = pInfo.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim() || pInfo.name || TranslationStore.t("player", "Jugador");
        const jerseyNum = (pInfo.jersey !== undefined && pInfo.jersey !== null) ? `#${pInfo.jersey}` : "";

        // Procesar estadística completa con StatsEngine
        const processedRow = StatsEngine.calculatePlayerStats(row);
        const val = processedRow.evaluation || 0;
        const minutes = Number(row.minutes || 0);

        if (!map[pId]) {
          map[pId] = {
            name: fullName,
            number: jerseyNum,
            position: pInfo.primary_position || pInfo.position || TranslationStore.t("player", "Jugador"),
            gamesPlayed: 0,
            totalMinutes: 0,
            totalVal: 0
          };
        }

        map[pId].gamesPlayed += 1;
        map[pId].totalMinutes += minutes;
        map[pId].totalVal += val;
      });
    }

    const calculated = Object.values(map)
      .map((p) => {
        const avgVal = p.gamesPlayed > 0 ? Number((p.totalVal / p.gamesPlayed).toFixed(1)) : 0;
        const mult40 = p.totalMinutes > 0 ? 40 / p.totalMinutes : 0;
        const val40 = Number((p.totalVal * mult40).toFixed(1));

        return {
          ...p,
          avgVal,
          val40
        };
      })
      .filter((p) => p.gamesPlayed > 0)
      .sort((a, b) => b.avgVal - a.avgVal)
      .slice(0, 3);

    if (calculated.length === 0) {
      return [
        { name: TranslationStore.t("no_data", "Sin datos"), number: "-", position: "-", gamesPlayed: 0, avgVal: 0.0, val40: 0.0 }
      ];
    }

    return calculated;
  }

  _buildSmoothSvgPath(points) {
    if (!points || points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    const tension = 0.2;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return path;
  }

  _renderCharts(playedGames) {
    if (!playedGames || playedGames.length === 0) return "";

    const chronGames = [...playedGames].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const totalGames = chronGames.length;

    const gameMetrics = chronGames.map((g, idx) => {
      const { teamPts, oppPts } = this._normalizeGameScore(g);
      const statsList = DataStore.getPlayerGameStats(null, g.id) || [];

      let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFta = 0;
      let totOffReb = 0, totDefReb = 0, totTov = 0;

      statsList.forEach(st => {
        totFg2m += Number(st.fg2_made || 0);
        totFg2a += Number(st.fg2_attempted || 0);
        totFg3m += Number(st.fg3_made || 0);
        totFg3a += Number(st.fg3_attempted || 0);
        totFta  += Number(st.ft_attempted || 0);
        totOffReb += Number(st.off_reb || 0);
        totDefReb += Number(st.def_reb || 0);
        totTov += Number(st.turnovers || 0);
      });

      const totFga = totFg2a + totFg3a;
      const totFgm = totFg2m + totFg3m;

      const efgVal = totFga > 0 ? Number((((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1)) : 30.0;
      const poss = totFga + 0.44 * totFta + totTov;
      const ortg = poss > 0 ? (teamPts / poss) * 100 : 0;
      const drtg = poss > 0 ? (oppPts / poss) * 100 : 0;
      
      const rawNet = Number((ortg - drtg).toFixed(1));
      const netRating = Math.max(-60, Math.min(60, rawNet));

      return {
        label: `P${idx + 1}`,
        ptsUs: teamPts,
        ptsThem: oppPts,
        tov: totTov,
        netRating,
        efgVal,
        orbCount: totOffReb,
        drbCount: totDefReb
      };
    });

    const svgWidth = 460;
    const svgHeight = 110;

    // 1. NET RATING
    const minNet = -60;
    const maxNet = 60;
    const netPoints = gameMetrics.map((m, i) => {
      const x = (i / Math.max(1, totalGames - 1)) * svgWidth;
      const y = svgHeight - ((m.netRating - minNet) / (maxNet - minNet)) * svgHeight;
      return { x, y, val: m.netRating, label: m.label };
    });

    const netCurveD = this._buildSmoothSvgPath(netPoints);

    const svgNetRating = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>60</span>
          <span>30</span>
          <span>0</span>
          <span>-30</span>
          <span>-60</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; height: 110px;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
              <line x1="0" y1="${svgHeight - ((0 - minNet) / (maxNet - minNet)) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((0 - minNet) / (maxNet - minNet)) * svgHeight}" stroke="#cbd5e1" stroke-dasharray="3 3" stroke-width="1"/>
              <path d="${netCurveD}" fill="none" stroke="#1e3a8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              ${netPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#1e3a8a" stroke="white" stroke-width="1.5"><title>${p.label}: ${p.val}</title></circle>`).join("")}
            </svg>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: 600; margin-top: 6px;">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `;

    // 2. PUNTOS ANOTADOS VS RECIBIDOS
    const maxPtsVal = Math.max(...gameMetrics.map(m => Math.max(m.ptsUs, m.ptsThem)), 100);
    const ptsBars = gameMetrics.map((m) => {
      const hUs = Math.min(100, Math.round((m.ptsUs / maxPtsVal) * 100));
      const hThem = Math.min(100, Math.round((m.ptsThem / maxPtsVal) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 2px; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #1e3a8a; width: 42%; height: ${hUs}%; border-radius: 2px 2px 0 0;" title="${TranslationStore.t("in_favor", "A favor")}: ${m.ptsUs}"></div>
            <div style="background: #f97316; width: 42%; height: ${hThem}%; border-radius: 2px 2px 0 0;" title="${TranslationStore.t("against", "En contra")}: ${m.ptsThem}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartPts = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>${maxPtsVal}</span>
          <span>${Math.round(maxPtsVal * 0.75)}</span>
          <span>${Math.round(maxPtsVal * 0.5)}</span>
          <span>${Math.round(maxPtsVal * 0.25)}</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 4px; align-items: flex-end; height: 120px;">
          ${ptsBars}
        </div>
      </div>
    `;

    // 3. EVOLUCIÓN EFG%
    const minEfg = 10;
    const maxEfg = 70;
    const efgPoints = gameMetrics.map((m, i) => {
      const clampedEfg = Math.max(minEfg, Math.min(maxEfg, m.efgVal));
      const x = (i / Math.max(1, totalGames - 1)) * svgWidth;
      const y = svgHeight - ((clampedEfg - minEfg) / (maxEfg - minEfg)) * svgHeight;
      return { x, y, val: m.efgVal, label: m.label };
    });

    const efgCurveD = this._buildSmoothSvgPath(efgPoints);

    const svgEfg = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>70.0%</span>
          <span>50.0%</span>
          <span>30.0%</span>
          <span>10.0%</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; height: 110px;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
              <line x1="0" y1="${svgHeight - ((50 - minEfg) / (maxEfg - minEfg)) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((50 - minEfg) / (maxEfg - minEfg)) * svgHeight}" stroke="#cbd5e1" stroke-dasharray="3 3" stroke-width="1"/>
              <path d="${efgCurveD}" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              ${efgPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#16a34a" stroke="white" stroke-width="1.5"><title>${p.label}: ${p.val}%</title></circle>`).join("")}
            </svg>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: 600; margin-top: 6px;">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `;

    // 4. PÉRDIDAS POR PARTIDO
    const maxTov = Math.max(...gameMetrics.map(m => m.tov), 45);
    const tovBars = gameMetrics.map((m) => {
      const hTov = Math.min(100, Math.round((m.tov / maxTov) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #ef4444; width: 70%; height: ${Math.max(6, hTov)}%; border-radius: 2px 2px 0 0;" title="${TranslationStore.t("turnovers", "Pérdidas")}: ${m.tov}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartTov = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>${maxTov}</span>
          <span>${Math.round(maxTov * 0.75)}</span>
          <span>${Math.round(maxTov * 0.5)}</span>
          <span>${Math.round(maxTov * 0.25)}</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 4px; align-items: flex-end; height: 120px;">
          ${tovBars}
        </div>
      </div>
    `;

    // 5. REBOTE OFENSIVO Y DEFENSIVO
    const maxReb = Math.max(...gameMetrics.map(m => Math.max(m.orbCount, m.drbCount)), 50);
    const reboundBars = gameMetrics.map((m) => {
      const hOrb = Math.min(100, Math.round((m.orbCount / maxReb) * 100));
      const hDrb = Math.min(100, Math.round((m.drbCount / maxReb) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 2px; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #f97316; width: 42%; height: ${hOrb}%; border-radius: 2px 2px 0 0;" title="Reb. Ofensivos: ${m.orbCount}"></div>
            <div style="background: #1e3a8a; width: 42%; height: ${hDrb}%; border-radius: 2px 2px 0 0;" title="Reb. Defensivos: ${m.drbCount}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartRebound = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>${maxReb}</span>
          <span>${Math.round(maxReb * 0.5)}</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 4px; align-items: flex-end; height: 120px;">
          ${reboundBars}
        </div>
      </div>
    `;

    // 6. RENDIMIENTO POR CUARTOS
    const quarters = [
      { name: "Q1", us: 14, them: 16 },
      { name: "Q2", us: 16, them: 18 },
      { name: "Q3", us: 12, them: 15 },
      { name: "Q4", us: 15, them: 14 }
    ];

    const quarterBars = quarters.map((q) => {
      const hUs = Math.round((q.us / 25) * 100);
      const hThem = Math.round((q.them / 25) * 100);
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 4px; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #1e3a8a; width: 35%; height: ${hUs}%; border-radius: 2px 2px 0 0;" title="${TranslationStore.t("in_favor", "A favor")}: ${q.us}"></div>
            <div style="background: #f97316; width: 35%; height: ${hThem}%; border-radius: 2px 2px 0 0;" title="${TranslationStore.t("against", "En contra")}: ${q.them}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${q.name}</span>
        </div>
      `;
    }).join("");

    const chartQuarters = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>25</span>
          <span>15</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 12px; align-items: flex-end; height: 120px;">
          ${quarterBars}
        </div>
      </div>
    `;

    return `
      <div class="charts-container-grid">
        
        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${TranslationStore.t("net_rating_evolution", "EVOLUCIÓN DEL NET RATING")} <span class="info-badge">?</span>
              <span class="tooltip-box">${TranslationStore.t("net_rating_tooltip", "Evolución del margen de eficiencia (Offensive Rating menos Defensive Rating) por partido.")}</span>
            </span>
          </h4>
          ${svgNetRating}
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${TranslationStore.t("pts_scored_vs_received", "PUNTOS ANOTADOS VS RECIBIDOS")} <span class="info-badge">?</span>
              <span class="tooltip-box">${TranslationStore.t("pts_tooltip", "Comparativa directa de la puntuación anotada a favor frente a la recibida.")}</span>
            </span>
          </h4>
          ${chartPts}
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color legend-blue"></span> ${TranslationStore.t("in_favor", "A favor")}</span>
            <span class="legend-item"><span class="legend-color legend-orange"></span> ${TranslationStore.t("against", "En contra")}</span>
          </div>
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              EVOLUCIÓN DEL EFG% <span class="info-badge">?</span>
              <span class="tooltip-box">${TranslationStore.t("efg_tooltip", "Porcentaje de tiro efectivo ajustado por el valor extra del triple en cada jornada.")}</span>
            </span>
          </h4>
          ${svgEfg}
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${TranslationStore.t("turnovers_per_game", "PÉRDIDAS POR PARTIDO")} <span class="info-badge">?</span>
              <span class="tooltip-box">${TranslationStore.t("turnovers_tooltip", "Volumen total de balones perdidos por el equipo en cada encuentro disputado.")}</span>
            </span>
          </h4>
          ${chartTov}
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${TranslationStore.t("rebound_off_def", "REBOTE OFENSIVO Y DEFENSIVO")} <span class="info-badge">?</span>
              <span class="tooltip-box">${TranslationStore.t("rebound_tooltip", "Cantidad total de rebotes atrapados en ataque (naranja) y en defensa (azul).")}</span>
            </span>
          </h4>
          ${chartRebound}
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color legend-orange"></span> Reb. Ofensivos</span>
            <span class="legend-item"><span class="legend-color legend-blue"></span> Reb. Defensivos</span>
          </div>
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${TranslationStore.t("quarter_performance", "RENDIMIENTO POR CUARTOS")} <span class="info-badge">?</span>
              <span class="tooltip-box">${TranslationStore.t("quarter_tooltip", "Distribución del promedio de puntos anotados y encajados acumulados en Q1, Q2, Q3 y Q4.")}</span>
            </span>
          </h4>
          ${chartQuarters}
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color legend-blue"></span> ${TranslationStore.t("in_favor", "a favor")}</span>
            <span class="legend-item"><span class="legend-color legend-orange"></span> ${TranslationStore.t("against", "en contra")}</span>
          </div>
        </div>

      </div>
    `;
  }

  _sortGames(games) {
    const { column, ascending } = this.sortState;
    const mult = ascending ? 1 : -1;

    return [...games].sort((a, b) => {
      const { teamPts: ptsA, oppPts: oppA } = this._normalizeGameScore(a);
      const { teamPts: ptsB, oppPts: oppB } = this._normalizeGameScore(b);

      const diffA = ptsA - oppA;
      const diffB = ptsB - oppB;

      switch (column) {
        case "date":
          return mult * (new Date(a.date || 0) - new Date(b.date || 0));
        case "opponent":
          return mult * (a.opponent || "").localeCompare(b.opponent || "");
        case "venue":
          return mult * (a.venue || "").localeCompare(b.venue || "");
        case "score":
          return mult * (ptsA - ptsB);
        case "diff":
          return mult * (diffA - diffB);
        default:
          return 0;
      }
    });
  }

  _renderTableRows(sortedGames) {
    return sortedGames.map((g) => {
      const { teamPts, oppPts, hasPlayed } = this._normalizeGameScore(g);

      const isWin = hasPlayed && teamPts > oppPts;
      const diff = hasPlayed ? teamPts - oppPts : 0;

      const venueLower = String(g.venue || '').toLowerCase();
      const isHome = venueLower === 'home' || venueLower === 'local';
      
      const venueText = isHome 
        ? TranslationStore.t("local", "Local") 
        : TranslationStore.t("visitor", "Visitante");

      const scoreText = hasPlayed 
        ? `${teamPts}-${oppPts}` 
        : TranslationStore.t("pending", "Pendiente");

      const opponentName = g.opponent || TranslationStore.t("opponent", "Rival");
      const formattedDate = this._formatDateES(g.date || '-');

      return `
        <tr class="game-row-item">
          <td class="col-date">${formattedDate}</td>
          <td class="col-opponent"><strong>${opponentName}</strong></td>
          <td class="col-venue">
            <span class="venue-badge ${isHome ? 'badge-home' : 'badge-away'}">
              ${venueText}
            </span>
          </td>
          <td class="col-score ${!hasPlayed ? 'text-muted' : (isWin ? 'text-win' : 'text-loss')}">
            ${scoreText}
          </td>
          <td class="col-diff">${hasPlayed ? (diff > 0 ? `+${diff}` : diff) : '-'}</td>
          <td class="col-off">-</td>
          <td class="col-def">-</td>
          <td class="col-action">
            <a href="#/boxscore/${g.id}" class="action-link">
              ${TranslationStore.t("view_boxscore", "Análisis")}
            </a>
          </td>
        </tr>
      `;
    }).join("");
  }

  _renderMobileCards(sortedGames) {
    return sortedGames.map((g) => {
      const { teamPts, oppPts, hasPlayed } = this._normalizeGameScore(g);
      const isWin = hasPlayed && teamPts > oppPts;
      const diff = hasPlayed ? teamPts - oppPts : 0;
      const formattedDate = this._formatDateES(g.date || '-');

      return `
        <div class="mobile-game-card card">
          <div class="mobile-card-header">
            <span class="game-date">${formattedDate}</span>
            <span class="score-pill ${hasPlayed ? (isWin ? 'pill-win' : 'pill-loss') : 'pill-pending'}">
              ${hasPlayed ? `${teamPts} - ${oppPts}` : TranslationStore.t("pending", "Pendiente")}
            </span>
          </div>
          <div class="mobile-card-body">
            <strong class="opponent-name">${g.opponent || 'Rival'}</strong>
            <span class="diff-badge">${hasPlayed ? `Dif: ${diff > 0 ? '+' : ''}${diff}` : ''}</span>
          </div>
          <div class="mobile-card-footer">
            <a href="#/boxscore/${g.id}" class="btn-primary-sm">
              ${TranslationStore.t("view_boxscore", "Ver Análisis")}
            </a>
          </div>
        </div>
      `;
    }).join("");
  }

  _attachSortEventListeners(container) {
    const sortHeaders = container.querySelectorAll("[data-sort]");
    sortHeaders.forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-sort");
        if (this.sortState.column === col) {
          this.sortState.ascending = !this.sortState.ascending;
        } else {
          this.sortState.column = col;
          this.sortState.ascending = true;
        }

        const sorted = this._sortGames(this.cachedGames);
        const tbody = container.querySelector("#games-table-body");
        if (tbody) {
          tbody.innerHTML = this._renderTableRows(sorted);
        }

        sortHeaders.forEach((header) => {
          const arrowSpan = header.querySelector(".sort-arrow");
          if (arrowSpan) {
            const hCol = header.getAttribute("data-sort");
            if (hCol === this.sortState.column) {
              arrowSpan.textContent = this.sortState.ascending ? " ▲" : " ▼";
              arrowSpan.style.color = "#2563eb";
            } else {
              arrowSpan.textContent = " ↕";
              arrowSpan.style.color = "#cbd5e1";
            }
          }
        });
      });
    });
  }

  _attachSyncButtonListener(container, teamId) {
    const syncBtn = container.querySelector("#btn-sync-data");
    if (!syncBtn) return;

    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `⏳ ${TranslationStore.t("syncing", "Sincronizando...")}`;
      syncBtn.style.opacity = "0.7";

      await DataStore.init(teamId || this.currentTeamId, true);
      const result = await this.syncService.runFullAuditAndSync(teamId || this.currentTeamId, this.cachedPlayerStats);

      if (result && result.success) {
        syncBtn.innerHTML = `✅ ¡${TranslationStore.t("data_up_to_date", "Datos Al Día!")}`;
        syncBtn.style.background = "#16a34a";
        setTimeout(() => {
          this.render("dashboard-content-area", teamId || this.currentTeamId);
        }, 1000);
      } else {
        syncBtn.innerHTML = `❌ ${TranslationStore.t("sync_error", "Error al sincronizar")}`;
        syncBtn.style.background = "#dc2626";
        setTimeout(() => {
          syncBtn.disabled = false;
          syncBtn.innerHTML = `🔄 ${TranslationStore.t("sync_audit_data", "Sincronizar y Auditar Datos")}`;
          syncBtn.style.background = "#2563eb";
          syncBtn.style.opacity = "1";
        }, 2000);
      }
    });
  }

  _attachLevel2TabsListener(container) {
    const tabButtons = container.querySelectorAll(".tab-pill-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab && this.activePerformanceTab !== targetTab) {
          this.activePerformanceTab = targetTab;
          tabButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          const tabContent = container.querySelector("#performance-tab-content");
          if (tabContent) {
            const kpis = StatsEngine ? StatsEngine.calculateTeamDashboardKPIs(this.cachedGames, this.cachedPlayerStats) : {};
            tabContent.innerHTML = this._renderLevel2TabContent(kpis);
          }
        }
      });
    });
  }

  _renderLevel2TabContent(kpis) {
    switch (this.activePerformanceTab) {
      case "defense":
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="kpi-title">DEFENSIVE RATING</span>
              <span class="kpi-val-big">${kpis.drtg || 0}</span>
              <span class="kpi-subtext">Puntos permitidos / 100 pos.</span>
            </div>
            <div class="kpi-card-custom">
              <span class="kpi-title">PUNTOS EN CONTRA / PJ</span>
              <span class="kpi-val-big">${kpis.oppPpg || 0}</span>
              <span class="kpi-subtext">Promedio encajado</span>
            </div>
          </div>
        `;
      case "pace":
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="kpi-title">PACE (RITMO DE JUEGO)</span>
              <span class="kpi-val-big">${kpis.pace || 0}</span>
              <span class="kpi-subtext">Posesiones / 40 minutos</span>
            </div>
            <div class="kpi-card-custom">
              <span class="kpi-title">TOV% (% PÉRDIDAS)</span>
              <span class="kpi-val-big">${kpis.tovPct || 0}%</span>
              <span class="kpi-subtext">Cuidado de balón</span>
            </div>
          </div>
        `;
      case "shooting":
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="kpi-title">eFG% (TIRO EFECTIVO)</span>
              <span class="kpi-val-big">${kpis.efg || 0}%</span>
              <span class="kpi-subtext">Ponderación de 3PT</span>
            </div>
            <div class="kpi-card-custom">
              <span class="kpi-title">DIFERENCIA PUNTOS</span>
              <span class="kpi-val-big" style="color: ${kpis.diffPpg < 0 ? '#dc2626' : '#16a34a'};">${kpis.diffPpg > 0 ? '+' : ''}${kpis.diffPpg || 0}</span>
              <span class="kpi-subtext">Margen medio por partido</span>
            </div>
          </div>
        `;
      case "attack":
      default:
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="kpi-title">OFFENSIVE RATING</span>
              <span class="kpi-val-big">${kpis.ortg || 0}</span>
              <span class="kpi-subtext">Puntos anotados / 100 pos.</span>
            </div>
            <div class="kpi-card-custom">
              <span class="kpi-title">NET RATING</span>
              <span class="kpi-val-big" style="color: ${kpis.netRtg < 0 ? '#dc2626' : '#16a34a'};">${kpis.netRtg > 0 ? '+' : ''}${kpis.netRtg || 0}</span>
              <span class="kpi-subtext">Balance neto / 100 pos.</span>
            </div>
          </div>
        `;
    }
  }

  async render(containerId = "dashboard-content-area", teamId) {
    this.currentTeamId = teamId;
    const container = document.getElementById(containerId);
    if (!container) return;

    const games = DataStore.getGames() || [];
    const players = DataStore.getPlayers() || [];
    const playerStats = DataStore.getPlayerGameStats() || [];

    this.cachedGames = games;
    this.cachedPlayerStats = playerStats;

    const playersMap = new Map((players || []).map(p => [p.id, p]));

    const teamData = {
      teamName: "JMJ Manyanet Sant Andreu",
      category: "Sénior Masculino",
      season: "2026",
      playedGames: games,
      playerStats: playerStats,
      playersMap: playersMap
    };

    if (this._canSync()) {
      this.syncService.runFullAuditAndSync(teamId).catch(err => {
        console.warn("[SeasonDashboardView] Auto-sync en segundo plano:", err.message);
      });
    }

    const kpis = StatsEngine ? StatsEngine.calculateTeamDashboardKPIs(this.cachedGames, playerStats) : {
      wins: 0, losses: 0, ppg: 0, oppPpg: 0, diffPpg: 0, ortg: 0, drtg: 0, netRtg: 0, pace: 0, efg: 0, tovPct: 0
    };
    
    const topPlayers = this._getTopPlayers(playerStats, playersMap);

    const sortedGames = this._sortGames(this.cachedGames);
    const gamesTableRows = this._renderTableRows(sortedGames);
    const gamesMobileCards = this._renderMobileCards(sortedGames);

    const canSyncData = this._canSync();

    const topPlayersMarkup = topPlayers.map((p, index) => `
      <div class="fiba-leader-item">
        <div>
          <span class="leader-badge">#${index + 1} ${TranslationStore.t("leader", "LÍDER")}</span>
          <strong class="leader-name">${p.number} ${p.name}</strong>
          <span class="leader-sub">${p.position} · ${p.gamesPlayed} PJ</span>
        </div>
        <div class="leader-score">
          <span class="val-number">${p.avgVal}</span>
          <span class="val-proj">[${p.val40}/40m]</span>
          <span class="has-tooltip tooltip-trigger">
            <span class="val-label">
              VAL / PJ <span class="info-badge">?</span>
            </span>
            <span class="tooltip-box">${TranslationStore.t("val_fiba_tooltip", "Valoración Oficial FIBA Promedio por Partido (VAL/PJ) y Proyección Por 40 Minutos [VAL/40m].")}</span>
          </span>
        </div>
      </div>
    `).join("");

    container.innerHTML = `
      <div class="dashboard-root-wrapper">
        
        <!-- Estado Nube y Permisos -->
        <div class="cloud-status-banner">
          <div class="status-indicator">
            <span class="status-dot"></span>
            ${TranslationStore.t("cloud_connected", "NUBE CONECTADA: Memoria local sincronizada con Supabase")}
          </div>
          ${canSyncData ? `
            <button id="btn-sync-data" class="btn-sync">
              🔄 ${TranslationStore.t("sync_audit_data", "Sincronizar y Auditar Datos")}
            </button>
          ` : `
            <span class="read-only-badge">
              🔒 ${TranslationStore.t("read_only", "Modo Solo Lectura")}
            </span>
          `}
        </div>

        <!-- Encabezado del Equipo -->
        <div class="team-header-box">
          <div>
            <h1 class="team-title">${teamData.teamName || TranslationStore.t("team", "Equipo")}</h1>
            <p class="team-meta">
              ${teamData.category || 'Categoría'} · ${TranslationStore.t("season", "Temporada")} ${teamData.season || '2026'} &nbsp;·&nbsp; 
              <strong class="text-win">${kpis.wins}W</strong> 
              <strong class="text-loss">${kpis.losses}L</strong> &nbsp;·&nbsp; 
              ${this.cachedGames.length} ${TranslationStore.t("total_games", "partidos totales")}
            </p>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- NIVEL 1 — RESUMEN EJECUTIVO (KPIs PRINCIPALES) -->
        <!-- ========================================================= -->
        <section class="dashboard-level-1">
          <div class="kpi-responsive-grid">
            
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${TranslationStore.t("games_played", "PARTIDOS JUGADOS").toUpperCase()}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">Total de partidos disputados o programados en el calendario.</span>
              </span>
              <span class="kpi-val-big">${this.cachedGames.length}</span>
            </div>

            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${TranslationStore.t("wins", "VICTORIAS").toUpperCase()}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">Número total de partidos ganados.</span>
              </span>
              <span class="kpi-val-big text-win">${kpis.wins}</span>
            </div>

            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${TranslationStore.t("losses", "DERROTAS").toUpperCase()}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">Número total de partidos perdidos.</span>
              </span>
              <span class="kpi-val-big text-loss">${kpis.losses}</span>
            </div>

            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${TranslationStore.t("ppg", "PUNTOS POR PARTIDO").toUpperCase()}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">Promedio de puntos anotados a favor (PPG).</span>
              </span>
              <span class="kpi-val-big">${kpis.ppg}</span>
            </div>

            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${TranslationStore.t("opp_ppg", "PUNTOS RECIBIDOS").toUpperCase()}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">Promedio de puntos encajados en contra (Opp PPG).</span>
              </span>
              <span class="kpi-val-big">${kpis.oppPpg}</span>
            </div>

            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${TranslationStore.t("diff_ppg", "DIFERENCIA MEDIA").toUpperCase()}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">Diferencia media de puntos por partido (A Favor menos En Contra).</span>
              </span>
              <span class="kpi-val-big ${kpis.diffPpg < 0 ? 'text-loss' : 'text-win'}">${kpis.diffPpg > 0 ? '+' : ''}${kpis.diffPpg}</span>
            </div>

          </div>
        </section>

        <!-- ========================================================= -->
        <!-- NIVEL 2 — RENDIMIENTO DEL EQUIPO (SECTOR DE PESTAÑAS) -->
        <!-- ========================================================= -->
        <section class="dashboard-level-2 card">
          <div class="level-2-header">
            <h3 class="level-2-title">${TranslationStore.t("team_performance", "RENDIMIENTO DEL EQUIPO")}</h3>
            <div class="tab-pills-row">
              <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'attack' ? 'active' : ''}" data-tab="attack">Ataque</button>
              <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'defense' ? 'active' : ''}" data-tab="defense">Defensa</button>
              <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'pace' ? 'active' : ''}" data-tab="pace">Ritmo</button>
              <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'shooting' ? 'active' : ''}" data-tab="shooting">Tiro</button>
            </div>
          </div>
          <div id="performance-tab-content" class="level-2-body">
            ${this._renderLevel2TabContent(kpis)}
          </div>
        </section>

        <!-- ========================================================= -->
        <!-- NIVEL 3 — LÍDERES, GRÁFICAS Y ÚLTIMOS PARTIDOS -->
        <!-- ========================================================= -->
        <section class="dashboard-level-3">
          
          <!-- Tarjeta Morada de Líderes FIBA -->
          <div class="fiba-card-purple">
            <div class="fiba-header">
              <span class="fiba-trophy">🏆</span>
              <h3 class="fiba-title">
                ${TranslationStore.t("fiba_leaders_title", "LÍDERES EN VALORACIÓN FIBA (VAL / PJ)").toUpperCase()}
              </h3>
            </div>
            <div class="fiba-grid">
              ${topPlayersMarkup}
            </div>
          </div>

          <!-- 6 Gráficas de Evolución SVG -->
          ${this._renderCharts(this.cachedGames)}

          <!-- Bloque de Partidos: Tabla (Desktop) vs Tarjetas (Móvil) -->
          <div class="games-block-card card">
            <h3 class="block-title">
              ${TranslationStore.t("last_games", "ÚLTIMOS PARTIDOS").toUpperCase()}
            </h3>

            <!-- Tabla para Pantallas Escritorio / Tablet -->
            <div class="desktop-only table-wrapper">
              <table class="games-table">
                <thead>
                  <tr class="table-header-row">
                    <th data-sort="date" class="sortable-th">
                      ${TranslationStore.t("date", "FECHA").toUpperCase()} <span class="sort-arrow">▼</span>
                    </th>
                    <th data-sort="opponent" class="sortable-th">
                      ${TranslationStore.t("opponent", "RIVAL").toUpperCase()} <span class="sort-arrow">↕</span>
                    </th>
                    <th data-sort="venue" class="sortable-th">
                      ${TranslationStore.t("venue", "SEDE").toUpperCase()} <span class="sort-arrow">↕</span>
                    </th>
                    <th data-sort="score" class="sortable-th">
                      ${TranslationStore.t("score", "RESULTADO").toUpperCase()} <span class="sort-arrow">↕</span>
                    </th>
                    <th data-sort="diff" class="sortable-th">
                      <span class="has-tooltip">
                        DIF. <span class="info-badge">?</span>
                        <span class="tooltip-box">Diferencia de puntos en el partido.</span>
                      </span>
                      <span class="sort-arrow">↕</span>
                    </th>
                    <th>OFF</th>
                    <th>DEF</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="games-table-body">
                  ${gamesTableRows}
                </tbody>
              </table>
            </div>

            <!-- Representación en Tarjetas para Teléfono Móvil -->
            <div class="mobile-only mobile-cards-grid">
              ${gamesMobileCards}
            </div>

          </div>

        </section>

      </div>

      <style>
        .dashboard-root-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg, 24px);
          max-width: 1400px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .cloud-status-banner {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 10px 16px;
          border-radius: var(--radius-md, 8px);
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .status-indicator { display: flex; align-items: center; gap: 8px; }
        .status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
        
        .btn-sync {
          background: #2563eb;
          color: white;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }

        .read-only-badge {
          background: #f1f5f9;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .team-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
        .team-meta { color: #64748b; font-size: 13px; margin: 6px 0 0 0; }

        /* KPI Grid Responsivo */
        .kpi-responsive-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: var(--space-md, 16px);
        }

        .kpi-card-custom {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: var(--radius-lg, 12px);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .kpi-title { font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.05em; }
        .kpi-val-big { font-size: 22px; font-weight: 900; color: #0f172a; }
        .kpi-subtext { font-size: 11px; color: #94a3b8; font-weight: 500; }
        
        .text-win { color: #16a34a !important; }
        .text-loss { color: #dc2626 !important; }

        /* Nivel 2: Pestañas */
        .level-2-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .level-2-title { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0; }

        .tab-pills-row { display: flex; gap: 8px; overflow-x: auto; }
        
        .tab-pill-btn {
          background: #f1f5f9;
          border: none;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          min-height: 36px;
        }

        .tab-pill-btn.active {
          background: var(--color-primary, #ea580c);
          color: white;
        }

        .kpi-subgrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        /* Nivel 3: Líderes y Gráficas */
        .dashboard-level-3 { display: flex; flex-direction: column; gap: 20px; }

        .fiba-card-purple {
          background: #2e1065;
          border-radius: 14px;
          padding: 20px;
          color: white;
        }

        .fiba-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .fiba-title { margin: 0; font-size: 13px; font-weight: 800; color: #c084fc; letter-spacing: 0.05em; }

        .fiba-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .fiba-leader-item {
          background: rgba(255, 255, 255, 0.08);
          padding: 14px;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .leader-badge { font-size: 10px; font-weight: 800; color: #a855f7; display: block; }
        .leader-name { font-size: 14px; color: white; display: block; }
        .leader-sub { font-size: 11px; color: #cbd5e1; display: block; }

        .leader-score { text-align: right; }
        .val-number { font-size: 20px; font-weight: 900; color: #facc15; display: block; }
        .val-proj { font-size: 10px; font-weight: 700; color: #e9d5ff; display: block; }

        .charts-container-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .chart-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }

        .chart-card-header { margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; }

        .chart-legend { display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 11px; font-weight: 600; }
        .legend-item { display: flex; align-items: center; gap: 4px; }
        .legend-color { width: 10px; height: 10px; border-radius: 2px; }
        .legend-blue { background: #1e3a8a; }
        .legend-orange { background: #f97316; }

        /* Tabla y Tarjetas */
        .games-block-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
        .block-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px; }

        .games-table { width: 100%; border-collapse: collapse; text-align: left; }
        .table-header-row { border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; }
        .table-header-row th { padding: 10px 12px; }

        .game-row-item { border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .game-row-item td { padding: 14px 12px; }

        .venue-badge { padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 11px; }
        .badge-home { background: #dbeafe; color: #1e40af; }
        .badge-away { background: #f1f5f9; color: #475569; }

        .action-link { color: #2563eb; text-decoration: none; font-weight: 600; }

        /* Tarjetas Móvil */
        .mobile-cards-grid { display: flex; flex-direction: column; gap: 12px; }
        .mobile-game-card { padding: 14px; display: flex; flex-direction: column; gap: 8px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .mobile-card-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
        .score-pill { padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 11px; }
        .pill-win { background: #dcfce7; color: #15803d; }
        .pill-loss { background: #fee2e2; color: #b91c1c; }
        .pill-pending { background: #f1f5f9; color: #64748b; }
        
        .mobile-card-body { display: flex; justify-content: space-between; align-items: center; }
        .opponent-name { font-size: 15px; color: #0f172a; }
        .btn-primary-sm { background: var(--color-primary, #ea580c); color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 700; display: inline-block; }

        /* Tooltips */
        .has-tooltip { position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
        .info-badge { background: #e2e8f0; color: #475569; border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; }
        .tooltip-box { visibility: hidden; opacity: 0; width: 210px; background-color: #0f172a; color: #ffffff; text-align: center; border-radius: 6px; padding: 8px 10px; position: absolute; z-index: 100; bottom: 125%; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 500; transition: opacity 0.2s ease; pointer-events: none; }
        .has-tooltip:hover .tooltip-box { visibility: visible; opacity: 1; }

        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      </style>
    `;

    this._attachSortEventListeners(container);
    this._attachLevel2TabsListener(container);

    if (canSyncData) {
      this._attachSyncButtonListener(container, teamId);
    }
  }
}

export default SeasonDashboardView;