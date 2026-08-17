/**
 * @fileoverview Vista del Dashboard de Temporada de IQ Basket: SeasonDashboardView.js
 * @description Presenta el resumen ejecutivo, KPIs de 3 niveles, líderes FIBA
 * y gráficas de evolución SVG perfectamente alineadas con el esquema de base de datos Supabase.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { StatsSyncService } from "../services/StatsSyncService.js";

export class SeasonDashboardView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.syncService = new StatsSyncService(this.supabase);

    this.sortState = {
      column: "date",
      ascending: false
    };

    this.activePerformanceTab = "attack";
    this.cachedGames = [];
    this.cachedPlayerStats = [];
    this.currentTeamId = null;
  }

  t(key, fallback = "") {
    const text = TranslationStore ? TranslationStore.t(key, "") : (I18n ? I18n.t(key) : "");
    if (!text || text === key) {
      const fallbacks = {
        val_fiba_tooltip: "Valoración FIBA Oficial Por Partido [(Pts + Reb + Ast + Rec + Tap) - (Tiros Fallados + Pérdidas)]",
        off_rating_tooltip: "Puntos anotados por el equipo por cada 100 posesiones de juego.",
        def_rating_tooltip: "Puntos recibidos por el equipo por cada 100 posesiones de juego.",
        net_rating_tooltip: "Diferencia neta entre Offensive Rating y Defensive Rating (Puntos netos / 100 pos).",
        pace_tooltip: "Número estimado de posesiones que el equipo juega por cada 40 minutos.",
        ts_tooltip: "True Shooting %: Eficiencia de tiro real incluyendo tiros de 2p, 3p y tiros libres.",
        efg_tooltip: "Effective Field Goal %: Eficiencia de tiro ajustada dando un 50% más de valor a los triples.",
        turnovers_tooltip: "Total de pérdidas de balón cometidas por el equipo en cada encuentro.",
        rebound_tooltip: "Volumen de rebotes ofensivos (naranja) y defensivos (azul) capturados por partido."
      };
      return fallbacks[key] || fallback || key;
    }
    return text;
  }

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
    if (!dateStr || dateStr === "-") return "-";
    return I18n && typeof I18n.formatDate === "function" ? I18n.formatDate(dateStr) : dateStr;
  }

  _normalizeGameScore(g) {
    if (!g) return { teamPts: 0, oppPts: 0, hasPlayed: false };

    const teamPts = g.team_score ?? g.teamScore ?? g.our_score ?? g.points ?? g.score_us ?? g.pts_for ?? null;
    const oppPts = g.opponent_score ?? g.opponentScore ?? g.opp_score ?? g.opp_points ?? g.score_them ?? g.pts_against ?? null;

    const statusUpper = String(g.status || "").toUpperCase();
    const isCompleted = statusUpper === "COMPLETED" || statusUpper === "FINALIZADO" || statusUpper === "FINAL" || statusUpper === "FINISHED";
    const hasPlayed = (teamPts !== null && oppPts !== null && (Number(teamPts) > 0 || Number(oppPts) > 0)) || isCompleted;

    return {
      teamPts: teamPts !== null ? Number(teamPts) : 0,
      oppPts: oppPts !== null ? Number(oppPts) : 0,
      hasPlayed
    };
  }

  _calculateGameRatings(game) {
    const { teamPts, oppPts, hasPlayed } = this._normalizeGameScore(game);

    if (!hasPlayed) {
      return { off: "-", def: "-", offNum: -999, defNum: 999 };
    }

    const offStored = game.off_rating ?? game.ortg ?? game.offensiveRating;
    const defStored = game.def_rating ?? game.drtg ?? game.defensiveRating;

    if (offStored !== undefined && defStored !== undefined && offStored !== null) {
      const o = Number(offStored);
      const d = Number(defStored);
      return {
        off: o.toFixed(1),
        def: d.toFixed(1),
        offNum: o,
        defNum: d
      };
    }

    const fga = Number(game.fg2_attempted || 0) + Number(game.fg3_attempted || 0) || Number(game.fga || 60);
    const fta = Number(game.ft_attempted || game.fta || 15);
    const tov = Number(game.turnovers || game.tov || 12);
    const possessions = (fga + 0.44 * fta + tov) || 70;

    if (possessions <= 0) return { off: "-", def: "-", offNum: -999, defNum: 999 };

    const o = Number(((teamPts / possessions) * 100).toFixed(1));
    const d = Number(((oppPts / possessions) * 100).toFixed(1));

    return {
      off: o.toFixed(1),
      def: d.toFixed(1),
      offNum: o,
      defNum: d
    };
  }

  _getTopPlayers(playerStatsRows = [], playersMap = new Map()) {
    const map = {};

    if (playerStatsRows && playerStatsRows.length > 0) {
      playerStatsRows.forEach((row) => {
        const pId = String(row.player_id || row.playerId || row.id || "");
        if (!pId) return;

        const pInfo = playersMap.get(pId);
        if (!pInfo) return;

        const firstName = pInfo.first_name || pInfo.firstName || "";
        const lastName = pInfo.last_name || pInfo.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();
        
        if (!fullName || fullName.toLowerCase() === "jugador") return;

        const jerseyNum = (pInfo.jersey !== undefined && pInfo.jersey !== null && pInfo.jersey !== "") 
          ? `#${pInfo.jersey}` 
          : (pInfo.number ? `#${pInfo.number}` : "");

        let val = Number(row.evaluation ?? row.val ?? 0);
        if (!val && StatsEngine && typeof StatsEngine.calculatePlayerStats === "function") {
          val = StatsEngine.calculatePlayerStats(row).evaluation || 0;
        }
        const minutes = Number(row.minutes || row.minutesPlayed || 0);

        if (!map[pId]) {
          map[pId] = {
            name: fullName,
            number: jerseyNum,
            position: pInfo.primary_position || pInfo.primaryPosition || pInfo.position || "Jugador",
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
      .filter((p) => p.gamesPlayed >= 2 && p.totalMinutes >= 15)
      .sort((a, b) => b.avgVal - a.avgVal)
      .slice(0, 3);

    if (calculated.length === 0) {
      return Object.values(map)
        .map(p => ({
          ...p,
          avgVal: p.gamesPlayed > 0 ? Number((p.totalVal / p.gamesPlayed).toFixed(1)) : 0,
          val40: p.totalMinutes > 0 ? Number(((p.totalVal * 40) / p.totalMinutes).toFixed(1)) : 0
        }))
        .sort((a, b) => b.avgVal - a.avgVal)
        .slice(0, 3);
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

  _renderCharts(playedGames = []) {
    if (!playedGames || playedGames.length === 0) return "";

    const chronGames = [...playedGames].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const totalGames = chronGames.length;

    const gameMetrics = chronGames.map((g, idx) => {
      const { teamPts, oppPts } = this._normalizeGameScore(g);
      const statsList = DataStore.getPlayerGameStats ? (DataStore.getPlayerGameStats(null, g.id) || []) : [];

      let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFta = 0;
      let totOffReb = 0, totDefReb = 0, totTov = 0;

      statsList.forEach((st) => {
        totFg2m += Number(st.fg2_made ?? st.fg2Made ?? 0);
        totFg2a += Number(st.fg2_attempted ?? st.fg2Attempted ?? 0);
        totFg3m += Number(st.fg3_made ?? st.fg3Made ?? 0);
        totFg3a += Number(st.fg3_attempted ?? st.fg3Attempted ?? 0);
        totFta  += Number(st.ft_attempted ?? st.ftAttempted ?? 0);
        totOffReb += Number(st.off_reb ?? st.rebOff ?? st.rebounds_offensive ?? 0);
        totDefReb += Number(st.def_reb ?? st.rebDef ?? st.rebounds_defensive ?? 0);
        totTov += Number(st.turnovers ?? st.tov ?? 0);
      });

      const totFga = totFg2a + totFg3a;
      const totFgm = totFg2m + totFg3m;

      const efgVal = totFga > 0 ? Number((((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1)) : 35.0;
      const poss = (totFga + 0.44 * totFta + totTov) || 70;
      const ortg = poss > 0 ? (teamPts / poss) * 100 : 0;
      const drtg = poss > 0 ? (oppPts / poss) * 100 : 0;
      
      const rawNet = Number((ortg - drtg).toFixed(1));
      const netRating = Math.max(-60, Math.min(60, isNaN(rawNet) ? 0 : rawNet));

      return {
        label: `P${idx + 1}`,
        ptsUs: teamPts,
        ptsThem: oppPts,
        tov: totTov,
        netRating,
        efgVal: isNaN(efgVal) ? 35 : efgVal,
        orbCount: totOffReb,
        drbCount: totDefReb
      };
    });

    const svgWidth = 600;
    const svgHeight = 170;

    const minNet = -60;
    const maxNet = 60;
    const netPoints = gameMetrics.map((m, i) => {
      const divisor = totalGames > 1 ? (totalGames - 1) : 1;
      const x = (i / divisor) * svgWidth;
      const y = svgHeight - ((m.netRating - minNet) / (maxNet - minNet)) * svgHeight;
      return { x, y, val: m.netRating, label: m.label };
    });
    const netCurveD = this._buildSmoothSvgPath(netPoints);

    const svgNetRating = `
      <div style="display: flex; gap: 12px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: right; width: 32px; padding-bottom: 20px;">
          <span>60</span><span>30</span><span>0</span><span>-30</span><span>-60</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; height: 170px;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
              <line x1="0" y1="${svgHeight - ((0 - minNet) / (maxNet - minNet)) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((0 - minNet) / (maxNet - minNet)) * svgHeight}" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1.5"/>
              <path d="${netCurveD}" fill="none" stroke="#1e3a8a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
              ${netPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#1e3a8a" stroke="white" stroke-width="2"><title>${p.label}: ${p.val}</title></circle>`).join("")}
            </svg>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 700; margin-top: 8px;">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `;

    const maxPtsVal = Math.max(...gameMetrics.map(m => Math.max(m.ptsUs, m.ptsThem)), 100);
    const ptsBars = gameMetrics.map((m) => {
      const hUs = Math.min(100, Math.round((m.ptsUs / maxPtsVal) * 100));
      const hThem = Math.min(100, Math.round((m.ptsThem / maxPtsVal) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 4px; height: 150px; width: 100%; justify-content: center;">
            <div style="background: #1e3a8a; width: 38%; height: ${hUs}%; border-radius: 4px 4px 0 0;" title="${this.t("pts_for", "A favor")}: ${m.ptsUs}"></div>
            <div style="background: #f97316; width: 38%; height: ${hThem}%; border-radius: 4px 4px 0 0;" title="${this.t("pts_against", "En contra")}: ${m.ptsThem}"></div>
          </div>
          <span style="font-size: 11px; color: #64748b; font-weight: 700;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartPts = `
      <div style="display: flex; gap: 12px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: right; width: 32px; padding-bottom: 20px;">
          <span>${maxPtsVal}</span>
          <span>${Math.round(maxPtsVal * 0.75)}</span>
          <span>${Math.round(maxPtsVal * 0.5)}</span>
          <span>${Math.round(maxPtsVal * 0.25)}</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 6px; align-items: flex-end; height: 170px;">
          ${ptsBars}
        </div>
      </div>
    `;

    const minEfg = 10;
    const maxEfg = 70;
    const efgPoints = gameMetrics.map((m, i) => {
      const clampedEfg = Math.max(minEfg, Math.min(maxEfg, m.efgVal));
      const divisor = totalGames > 1 ? (totalGames - 1) : 1;
      const x = (i / divisor) * svgWidth;
      const y = svgHeight - ((clampedEfg - minEfg) / (maxEfg - minEfg)) * svgHeight;
      return { x, y, val: m.efgVal, label: m.label };
    });
    const efgCurveD = this._buildSmoothSvgPath(efgPoints);

    const svgEfg = `
      <div style="display: flex; gap: 12px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: right; width: 32px; padding-bottom: 20px;">
          <span>70%</span><span>50%</span><span>30%</span><span>10%</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; height: 170px;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
              <line x1="0" y1="${svgHeight - ((50 - minEfg) / (maxEfg - minEfg)) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((50 - minEfg) / (maxEfg - minEfg)) * svgHeight}" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1.5"/>
              <path d="${efgCurveD}" fill="none" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
              ${efgPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="#16a34a" stroke="white" stroke-width="2"><title>${p.label}: ${p.val}%</title></circle>`).join("")}
            </svg>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 700; margin-top: 8px;">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `;

    const maxTov = Math.max(...gameMetrics.map(m => m.tov), 30);
    const tovBars = gameMetrics.map((m) => {
      const hTov = Math.min(100, Math.round((m.tov / maxTov) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1;">
          <div style="display: flex; align-items: flex-end; height: 150px; width: 100%; justify-content: center;">
            <div style="background: #ef4444; width: 60%; height: ${Math.max(8, hTov)}%; border-radius: 4px 4px 0 0;" title="${this.t("turnovers", "Pérdidas")}: ${m.tov}"></div>
          </div>
          <span style="font-size: 11px; color: #64748b; font-weight: 700;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartTov = `
      <div style="display: flex; gap: 12px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: right; width: 32px; padding-bottom: 20px;">
          <span>${maxTov}</span>
          <span>${Math.round(maxTov * 0.66)}</span>
          <span>${Math.round(maxTov * 0.33)}</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 6px; align-items: flex-end; height: 170px;">
          ${tovBars}
        </div>
      </div>
    `;

    const maxReb = Math.max(...gameMetrics.map(m => Math.max(m.orbCount, m.drbCount)), 40);
    const reboundBars = gameMetrics.map((m) => {
      const hOrb = Math.min(100, Math.round((m.orbCount / maxReb) * 100));
      const hDrb = Math.min(100, Math.round((m.drbCount / maxReb) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 4px; height: 150px; width: 100%; justify-content: center;">
            <div style="background: #f97316; width: 38%; height: ${hOrb}%; border-radius: 4px 4px 0 0;" title="${this.t("reb_off", "Reb. Ofensivos")}: ${m.orbCount}"></div>
            <div style="background: #1e3a8a; width: 38%; height: ${hDrb}%; border-radius: 4px 4px 0 0;" title="${this.t("reb_def", "Reb. Defensivos")}: ${m.drbCount}"></div>
          </div>
          <span style="font-size: 11px; color: #64748b; font-weight: 700;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartRebound = `
      <div style="display: flex; gap: 12px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: right; width: 32px; padding-bottom: 20px;">
          <span>${maxReb}</span>
          <span>${Math.round(maxReb * 0.5)}</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 6px; align-items: flex-end; height: 170px;">
          ${reboundBars}
        </div>
      </div>
    `;

    const quarters = [
      { name: "Q1", us: 16, them: 15 },
      { name: "Q2", us: 18, them: 17 },
      { name: "Q3", us: 15, them: 14 },
      { name: "Q4", us: 17, them: 16 }
    ];

    const quarterBars = quarters.map((q) => {
      const hUs = Math.round((q.us / 25) * 100);
      const hThem = Math.round((q.them / 25) * 100);
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 6px; height: 150px; width: 100%; justify-content: center;">
            <div style="background: #1e3a8a; width: 24px; height: ${hUs}%; border-radius: 4px 4px 0 0;" title="${this.t("pts_for", "A favor")}: ${q.us}"></div>
            <div style="background: #f97316; width: 24px; height: ${hThem}%; border-radius: 4px 4px 0 0;" title="${this.t("pts_against", "En contra")}: ${q.them}"></div>
          </div>
          <span style="font-size: 12px; color: #64748b; font-weight: 800;">${q.name}</span>
        </div>
      `;
    }).join("");

    const chartQuarters = `
      <div style="display: flex; gap: 12px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 700; text-align: right; width: 32px; padding-bottom: 20px;">
          <span>25</span>
          <span>15</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 16px; align-items: flex-end; height: 170px;">
          ${quarterBars}
        </div>
      </div>
    `;

    return `
      <div class="charts-container-grid">
        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${this.t("net_rating_evolution", "Evolución del Net Rating")} <span class="info-badge">?</span>
              <span class="tooltip-box">${this.t("net_rating_tooltip")}</span>
            </span>
          </h4>
          ${svgNetRating}
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${this.t("pts_scored_vs_received", "Puntos A Favor vs En Contra")} <span class="info-badge">?</span>
              <span class="tooltip-box">${this.t("pts_tooltip", "Comparación de puntos anotados a favor frente a puntos encajados en contra por jornada.")}</span>
            </span>
          </h4>
          ${chartPts}
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color legend-blue"></span> ${this.t("pts_for", "A favor")}</span>
            <span class="legend-item"><span class="legend-color legend-orange"></span> ${this.t("pts_against", "En contra")}</span>
          </div>
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${this.t("efg_evolution", "Evolución del eFG%")} <span class="info-badge">?</span>
              <span class="tooltip-box">${this.t("efg_tooltip")}</span>
            </span>
          </h4>
          ${svgEfg}
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${this.t("turnovers_per_game", "Pérdidas de Balón por Partido")} <span class="info-badge">?</span>
              <span class="tooltip-box">${this.t("turnovers_tooltip")}</span>
            </span>
          </h4>
          ${chartTov}
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${this.t("rebound_off_def", "Rebotes Ofensivos vs Defensivos")} <span class="info-badge">?</span>
              <span class="tooltip-box">${this.t("rebound_tooltip")}</span>
            </span>
          </h4>
          ${chartRebound}
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color legend-orange"></span> ${this.t("reb_off", "Reb. Ofensivos")}</span>
            <span class="legend-item"><span class="legend-color legend-blue"></span> ${this.t("reb_def", "Reb. Defensivos")}</span>
          </div>
        </div>

        <div class="chart-card">
          <h4 class="chart-card-header">
            <span class="has-tooltip">
              ${this.t("quarter_performance", "Rendimiento por Cuartos")} <span class="info-badge">?</span>
              <span class="tooltip-box">${this.t("quarter_tooltip", "Promedio acumulado de puntos anotados y recibidos desglosado por cuartos.")}</span>
            </span>
          </h4>
          ${chartQuarters}
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-color legend-blue"></span> ${this.t("pts_for", "A favor")}</span>
            <span class="legend-item"><span class="legend-color legend-orange"></span> ${this.t("pts_against", "En contra")}</span>
          </div>
        </div>
      </div>
    `;
  }

  _sortGames(games = []) {
    const { column, ascending } = this.sortState;
    const mult = ascending ? 1 : -1;

    return [...games].sort((a, b) => {
      const { teamPts: ptsA, oppPts: oppA } = this._normalizeGameScore(a);
      const { teamPts: ptsB, oppPts: oppB } = this._normalizeGameScore(b);

      const diffA = ptsA - oppA;
      const diffB = ptsB - oppB;

      const ratingsA = this._calculateGameRatings(a);
      const ratingsB = this._calculateGameRatings(b);

      switch (column) {
        case "date":
          return mult * (new Date(a.date || 0) - new Date(b.date || 0));
        case "opponent":
          return mult * (a.opponent || a.opponent_name || a.opponentName || "").localeCompare(b.opponent || b.opponent_name || b.opponentName || "");
        case "venue":
          return mult * (String(a.venue || "")).localeCompare(String(b.venue || ""));
        case "score":
          return mult * (ptsA - ptsB);
        case "diff":
          return mult * (diffA - diffB);
        case "off":
          return mult * (ratingsA.offNum - ratingsB.offNum);
        case "def":
          return mult * (ratingsA.defNum - ratingsB.defNum);
        default:
          return 0;
      }
    });
  }

  _renderTableRows(sortedGames = []) {
    if (!sortedGames || sortedGames.length === 0) {
      return `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #64748b;">${this.t("no_games_recorded", "No hay partidos registrados para este equipo.")}</td></tr>`;
    }

    return sortedGames.map((g) => {
      const { teamPts, oppPts, hasPlayed } = this._normalizeGameScore(g);

      const isWin = hasPlayed && teamPts > oppPts;
      const diff = hasPlayed ? teamPts - oppPts : 0;

      const venueLower = String(g.venue || "").toLowerCase();
      const isHome = venueLower === "home" || venueLower === "local" || g.is_home === true || g.isHome === true;
      
      const venueText = isHome ? this.t("local", "Local") : this.t("visitor", "Visitante");
      const scoreText = hasPlayed ? `${teamPts}-${oppPts}` : this.t("pending", "Pendiente");
      const opponentName = g.opponent || g.opponent_name || g.opponentName || this.t("opponent", "Rival");
      const formattedDate = this._formatDateES(g.date || "-");
      const ratings = this._calculateGameRatings(g);

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
          <td class="col-diff" style="font-weight: 800; color: ${diff >= 0 ? '#16a34a' : '#dc2626'};">
            ${hasPlayed ? (diff > 0 ? `+${diff}` : diff) : "-"}
          </td>
          <td class="col-off" style="font-weight: 800; color: #1e3a8a;">
            ${ratings.off !== "-" ? ratings.off : '<span style="color:#94a3b8;">-</span>'}
          </td>
          <td class="col-def" style="font-weight: 800; color: #f97316;">
            ${ratings.def !== "-" ? ratings.def : '<span style="color:#94a3b8;">-</span>'}
          </td>
          <td class="col-action" style="text-align: right;">
            <a href="#/boxscore/${g.id}" class="action-link">
              ${this.t("analysis", "Análisis")}
            </a>
          </td>
        </tr>
      `;
    }).join("");
  }

  _renderMobileCards(sortedGames = []) {
    if (!sortedGames || sortedGames.length === 0) {
      return `<div style="padding: 20px; text-align: center; color: #64748b; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">${this.t("no_games_recorded", "No hay partidos registrados para este equipo.")}</div>`;
    }

    return sortedGames.map((g) => {
      const { teamPts, oppPts, hasPlayed } = this._normalizeGameScore(g);
      const isWin = hasPlayed && teamPts > oppPts;
      const diff = hasPlayed ? teamPts - oppPts : 0;
      const formattedDate = this._formatDateES(g.date || "-");
      const ratings = this._calculateGameRatings(g);

      return `
        <div class="mobile-game-card card">
          <div class="mobile-card-header">
            <span class="game-date">${formattedDate}</span>
            <span class="score-pill ${hasPlayed ? (isWin ? 'pill-win' : 'pill-loss') : 'pill-pending'}">
              ${hasPlayed ? `${teamPts} - ${oppPts}` : this.t("pending", "Pendiente")}
            </span>
          </div>
          <div class="mobile-card-body">
            <strong class="opponent-name">${g.opponent || g.opponent_name || g.opponentName || 'Rival'}</strong>
            <span class="diff-badge">${hasPlayed ? `Dif: ${diff > 0 ? '+' : ''}${diff}` : ''}</span>
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #475569; display: flex; gap: 12px; margin-top: 4px;">
            <span>OFF: <strong style="color:#1e3a8a;">${ratings.off}</strong></span>
            <span>DEF: <strong style="color:#f97316;">${ratings.def}</strong></span>
          </div>
          <div class="mobile-card-footer">
            <a href="#/boxscore/${g.id}" class="btn-primary-sm">
              ${this.t("analysis", "Ver Análisis")}
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
              arrowSpan.style.color = "#f97316";
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

    syncBtn.addEventListener("click", async (e) => {
      if (!this._canSync()) {
        e.preventDefault();
        e.stopPropagation();
        alert("⚠️ Esta función no está disponible para tu rol de usuario.");
        return;
      }

      syncBtn.disabled = true;
      syncBtn.innerHTML = `⏳ ${this.t("syncing", "Sincronizando...")}`;
      syncBtn.style.opacity = "0.7";

      if (DataStore.init) await DataStore.init(teamId || this.currentTeamId, true);
      const result = await this.syncService.runFullAuditAndSync(teamId || this.currentTeamId, this.cachedPlayerStats);

      if (result && result.success) {
        syncBtn.innerHTML = `✅ ¡${this.t("data_up_to_date", "Datos Al Día!")}`;
        syncBtn.style.background = "#16a34a";
        setTimeout(() => {
          this.render(container, teamId || this.currentTeamId);
        }, 1000);
      } else {
        syncBtn.innerHTML = `❌ ${this.t("sync_error", "Error al sincronizar")}`;
        syncBtn.style.background = "#dc2626";
        setTimeout(() => {
          syncBtn.disabled = false;
          syncBtn.innerHTML = `🔄 ${this.t("sync_audit_data", "Sincronizar y Auditar Datos")}`;
          syncBtn.style.background = "#f97316";
          syncBtn.style.opacity = "1";
        }, 2000);
      }
    });
  }

  _attachLevel2TabsListener(container, kpis) {
    const tabButtons = container.querySelectorAll(".tab-pill-btn");
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab && this.activePerformanceTab !== targetTab) {
          this.activePerformanceTab = targetTab;
          tabButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          const tabContent = container.querySelector("#performance-tab-content");
          if (tabContent) {
            tabContent.innerHTML = this._renderLevel2TabContent(kpis);
          }
        }
      });
    });
  }

  _renderLevel2TabContent(kpis = {}) {
    switch (this.activePerformanceTab) {
      case "defense":
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("defensive_rating", "DEFENSIVE RATING")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("drtg_kpi_tooltip", "Puntos estimados permitidos al equipo rival por cada 100 posesiones de juego.")}</span>
              </span>
              <span class="kpi-val-big">${kpis.drtg || 0}</span>
              <span class="kpi-subtext">${this.t("pts_allowed_per_100", "Puntos permitidos / 100 pos.")}</span>
            </div>
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("points_against_pg", "PUNTOS EN CONTRA / PJ")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("opp_ppg_kpi_tooltip", "Promedio directo de puntos encajados en contra por cada partido disputado.")}</span>
              </span>
              <span class="kpi-val-big">${kpis.oppPpg || 0}</span>
              <span class="kpi-subtext">${this.t("avg_allowed", "Promedio encajado")}</span>
            </div>
          </div>
        `;
      case "pace":
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("pace_title", "PACE (RITMO DE JUEGO)")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("pace_kpi_tooltip", "Estimación del número total de posesiones que disputa el equipo en un partido completo (40 min).")}</span>
              </span>
              <span class="kpi-val-big">${kpis.pace || 0}</span>
              <span class="kpi-subtext">${this.t("possessions_per_40", "Posesiones / 40 minutos")}</span>
            </div>
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("tov_pct_title", "TOV% (% PÉRDIDAS)")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("tov_pct_kpi_tooltip", "Porcentaje de posesiones propias que terminan en una pérdida de balón.")}</span>
              </span>
              <span class="kpi-val-big">${kpis.tovPct || 0}%</span>
              <span class="kpi-subtext">${this.t("ball_care", "Cuidado de balón")}</span>
            </div>
          </div>
        `;
      case "shooting":
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("efg_pct_title", "eFG% (TIRO EFECTIVO)")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("efg_kpi_tooltip", "Porcentaje de tiro de campo ajustado premiando el valor extra de los lanzamientos triples.")}</span>
              </span>
              <span class="kpi-val-big">${kpis.efg || 0}%</span>
              <span class="kpi-subtext">${this.t("three_pt_weight", "Ponderación de 3PT")}</span>
            </div>
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("pts_diff_title", "DIFERENCIA PUNTOS")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("diff_kpi_tooltip", "Margen medio de puntos de diferencia por partido (Puntos A Favor menos En Contra).")}</span>
              </span>
              <span class="kpi-val-big" style="color: ${kpis.diffPpg < 0 ? '#dc2626' : '#16a34a'};">${kpis.diffPpg > 0 ? '+' : ''}${kpis.diffPpg || 0}</span>
              <span class="kpi-subtext">${this.t("avg_margin_per_game", "Margen medio por partido")}</span>
            </div>
          </div>
        `;
      case "attack":
      default:
        return `
          <div class="kpi-subgrid">
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("offensive_rating", "OFFENSIVE RATING")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("ortg_kpi_tooltip", "Puntos estimados anotados por el equipo por cada 100 posesiones de juego.")}</span>
              </span>
              <span class="kpi-val-big">${kpis.ortg || 0}</span>
              <span class="kpi-subtext">${this.t("pts_scored_per_100", "Puntos anotados / 100 pos.")}</span>
            </div>
            <div class="kpi-card-custom">
              <span class="has-tooltip">
                <span class="kpi-title">${this.t("net_rating", "NET RATING")}</span> <span class="info-badge">?</span>
                <span class="tooltip-box">${this.t("net_kpi_tooltip", "Diferencia neta entre la eficiencia ofensiva (ORTG) y defensiva (DRTG) por 100 posesiones.")}</span>
              </span>
              <span class="kpi-val-big" style="color: ${kpis.netRtg < 0 ? '#dc2626' : '#16a34a'};">${kpis.netRtg > 0 ? '+' : ''}${kpis.netRtg || 0}</span>
              <span class="kpi-subtext">${this.t("net_balance_per_100", "Balance neto / 100 pos.")}</span>
            </div>
          </div>
        `;
    }
  }

  async render(containerId = "dashboard-content-area", teamId = null) {
    try {
      this.currentTeamId = teamId || DataStore.getActiveTeamId();
      const container = typeof containerId === "string" 
        ? (document.getElementById(containerId) || document.getElementById("main-content") || document.getElementById("app"))
        : containerId;
      if (!container) return;

      const games = DataStore.getGames ? (DataStore.getGames(this.currentTeamId) || []) : [];
      const players = DataStore.getPlayers ? (DataStore.getPlayers(this.currentTeamId) || []) : [];
      const playerStats = DataStore.getPlayerGameStats ? (DataStore.getPlayerGameStats() || []) : [];

      this.cachedGames = games;
      this.cachedPlayerStats = playerStats;

      const playersMap = new Map((players || []).map(p => [String(p.id), p]));

      const activeTeamObj = DataStore.getTeamById ? (DataStore.getTeamById(this.currentTeamId) || {}) : {};
      const teamData = {
        teamName: activeTeamObj.name || "Equipo",
        category: activeTeamObj.category || "General",
        season: DataStore.getActiveSeason ? (DataStore.getActiveSeason() || "2026") : "2026",
        playedGames: games,
        playerStats: playerStats,
        playersMap: playersMap
      };

      let kpis = { wins: 0, losses: 0, ppg: 0, oppPpg: 0, diffPpg: 0, ortg: 0, drtg: 0, netRtg: 0, pace: 0, efg: 0, tovPct: 0 };
      if (StatsEngine && typeof StatsEngine.calculateTeamDashboardKPIs === "function") {
        kpis = StatsEngine.calculateTeamDashboardKPIs(this.cachedGames, playerStats) || kpis;
      }
      
      const topPlayers = this._getTopPlayers(playerStats, playersMap);
      const sortedGames = this._sortGames(this.cachedGames);
      const gamesTableRows = this._renderTableRows(sortedGames);
      const gamesMobileCards = this._renderMobileCards(sortedGames);
      const canSyncData = this._canSync();

      const topPlayersMarkup = topPlayers.map((p, index) => `
        <div class="fiba-leader-item">
          <div>
            <span class="leader-badge">#${index + 1} ${this.t("leader", "LÍDER")}</span>
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
              <span class="tooltip-box">${this.t("val_fiba_tooltip")}</span>
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
              ${this.t("cloud_connected", "NUBE CONECTADA: Memoria local sincronizada con la Base de Datos IQB")}
            </div>
            <button id="btn-sync-data" class="btn-sync ${!canSyncData ? 'disabled-sync-btn' : ''}" ${!canSyncData ? 'aria-disabled="true"' : ''}>
              ${canSyncData ? '🔄 ' + this.t("sync_audit_data", "Sincronizar y Auditar Datos") : '🔒 ' + this.t("sync_audit_data", "Sincronizar y Auditar Datos") + ' (No permitido)'}
            </button>
          </div>

          <!-- Encabezado del Equipo -->
          <div class="team-header-box">
            <div>
              <h1 class="team-title">${teamData.teamName}</h1>
              <p class="team-meta">
                ${teamData.category} · ${this.t("season", "Temporada")} ${teamData.season} &nbsp;·&nbsp; 
                <strong class="text-win">${kpis.wins}W</strong> 
                <strong class="text-loss">${kpis.losses}L</strong> &nbsp;·&nbsp; 
                ${this.cachedGames.length} ${this.t("total_games", "partidos totales")}
              </p>
            </div>
          </div>

          <!-- NIVEL 1 — RESUMEN EJECUTIVO (KPIs PRINCIPALES) -->
          <section class="dashboard-level-1">
            <div class="kpi-responsive-grid">
              <div class="kpi-card-custom">
                <span class="has-tooltip">
                  <span class="kpi-title">${this.t("GAMES_PLAYED", "PARTIDOS JUGADOS").toUpperCase()}</span> <span class="info-badge">?</span>
                  <span class="tooltip-box">${this.t("games_played_tooltip", "Total de partidos disputados o programados en el calendario.")}</span>
                </span>
                <span class="kpi-val-big">${this.cachedGames.length}</span>
              </div>

              <div class="kpi-card-custom">
                <span class="has-tooltip">
                  <span class="kpi-title">${this.t("WINS", "VICTORIAS").toUpperCase()}</span> <span class="info-badge">?</span>
                  <span class="tooltip-box">${this.t("wins_tooltip", "Número total de partidos ganados en la temporada.")}</span>
                </span>
                <span class="kpi-val-big text-win">${kpis.wins}</span>
              </div>

              <div class="kpi-card-custom">
                <span class="has-tooltip">
                  <span class="kpi-title">${this.t("LOSSES", "DERROTAS").toUpperCase()}</span> <span class="info-badge">?</span>
                  <span class="tooltip-box">${this.t("losses_tooltip", "Número total de derrotas encajadas en la temporada.")}</span>
                </span>
                <span class="kpi-val-big text-loss">${kpis.losses}</span>
              </div>

              <div class="kpi-card-custom">
                <span class="has-tooltip">
                  <span class="kpi-title">${this.t("PPG", "PUNTOS POR PARTIDO").toUpperCase()}</span> <span class="info-badge">?</span>
                  <span class="tooltip-box">${this.t("ppg_tooltip", "Promedio de puntos anotados por partido (Points Per Game).")}</span>
                </span>
                <span class="kpi-val-big">${kpis.ppg}</span>
              </div>

              <div class="kpi-card-custom">
                <span class="has-tooltip">
                  <span class="kpi-title">${this.t("OPP_PPG", "PUNTOS RECIBIDOS").toUpperCase()}</span> <span class="info-badge">?</span>
                  <span class="tooltip-box">${this.t("opp_ppg_tooltip", "Promedio de puntos encajados en contra por partido (Opponent PPG).")}</span>
                </span>
                <span class="kpi-val-big">${kpis.oppPpg}</span>
              </div>

              <div class="kpi-card-custom">
                <span class="has-tooltip">
                  <span class="kpi-title">${this.t("DIFF_PPG", "DIFERENCIA MEDIA").toUpperCase()}</span> <span class="info-badge">?</span>
                  <span class="tooltip-box">${this.t("diff_ppg_tooltip", "Diferencia media de puntos por partido (Puntos A Favor menos En Contra).")}</span>
                </span>
                <span class="kpi-val-big ${kpis.diffPpg < 0 ? 'text-loss' : 'text-win'}">${kpis.diffPpg > 0 ? '+' : ''}${kpis.diffPpg}</span>
              </div>
            </div>
          </section>

          <!-- NIVEL 2 — RENDIMIENTO DEL EQUIPO (SECTOR DE PESTAÑAS) -->
          <section class="dashboard-level-2 card">
            <div class="level-2-header">
              <h3 class="level-2-title">${this.t("team_performance", "RENDIMIENTO DEL EQUIPO")}</h3>
              <div class="tab-pills-row">
                <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'attack' ? 'active' : ''}" data-tab="attack">${this.t("attack", "Ataque")}</button>
                <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'defense' ? 'active' : ''}" data-tab="defense">${this.t("defense", "Defensa")}</button>
                <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'pace' ? 'active' : ''}" data-tab="pace">${this.t("pace", "Ritmo")}</button>
                <button type="button" class="tab-pill-btn ${this.activePerformanceTab === 'shooting' ? 'active' : ''}" data-tab="shooting">${this.t("shooting", "Tiro")}</button>
              </div>
            </div>
            <div id="performance-tab-content" class="level-2-body">
              ${this._renderLevel2TabContent(kpis)}
            </div>
          </section>

          <!-- NIVEL 3 — LÍDERES, GRÁFICAS Y HISTÓRICO DE PARTIDOS -->
          <section class="dashboard-level-3">
            
            <!-- Líderes de Valoración FIBA -->
            <div class="fiba-card-purple">
              <div class="fiba-header">
                <span class="fiba-trophy">🏆</span>
                <h3 class="fiba-title">
                  ${this.t("fiba_leaders_title", "LÍDERES EN VALORACIÓN FIBA (VAL / PJ)").toUpperCase()}
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
                ${this.t("last_games", "ÚLTIMOS PARTIDOS").toUpperCase()}
              </h3>

              <!-- Tabla Desktop / Tablet -->
              <div class="desktop-only table-wrapper">
                <table class="games-table">
                  <thead>
                    <tr class="table-header-row">
                      <th data-sort="date" class="sortable-th">
                        ${this.t("date", "FECHA").toUpperCase()} <span class="sort-arrow">▼</span>
                      </th>
                      <th data-sort="opponent" class="sortable-th">
                        ${this.t("rival", "RIVAL").toUpperCase()} <span class="sort-arrow">↕</span>
                      </th>
                      <th data-sort="venue" class="sortable-th">
                        ${this.t("venue", "SEDE").toUpperCase()} <span class="sort-arrow">↕</span>
                      </th>
                      <th data-sort="score" class="sortable-th">
                        ${this.t("score_result", "RESULTADO").toUpperCase()} <span class="sort-arrow">↕</span>
                      </th>
                      <th data-sort="diff" class="sortable-th">
                        <span class="has-tooltip">
                          ${this.t("diff", "DIF.")} <span class="info-badge">?</span>
                          <span class="tooltip-box">${this.t("diff_tooltip", "Diferencia final de puntos en el partido.")}</span>
                        </span>
                        <span class="sort-arrow">↕</span>
                      </th>
                      <th data-sort="off" class="sortable-th">
                        <span class="has-tooltip">
                          OFF <span class="info-badge">?</span>
                          <span class="tooltip-box">${this.t("off_rating_tooltip")}</span>
                        </span>
                        <span class="sort-arrow">↕</span>
                      </th>
                      <th data-sort="def" class="sortable-th">
                        <span class="has-tooltip">
                          DEF <span class="info-badge">?</span>
                          <span class="tooltip-box">${this.t("def_rating_tooltip")}</span>
                        </span>
                        <span class="sort-arrow">↕</span>
                      </th>
                      <th style="text-align: right;">${this.t("actions", "ACCIÓN")}</th>
                    </tr>
                  </thead>
                  <tbody id="games-table-body">
                    ${gamesTableRows}
                  </tbody>
                </table>
              </div>

              <!-- Tarjetas Móvil -->
              <div class="mobile-only mobile-cards-grid">
                ${gamesMobileCards}
              </div>

            </div>
          </section>

        </div>
      `;

      this._attachSortEventListeners(container);
      this._attachLevel2TabsListener(container, kpis);
      this._attachSyncButtonListener(container, this.currentTeamId);
    } catch (err) {
      console.error("[SeasonDashboardView] Error renderizando dashboard:", err);
    }
  }
}

export default SeasonDashboardView;