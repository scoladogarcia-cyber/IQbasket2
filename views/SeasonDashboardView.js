/**
 * @fileoverview Vista del Dashboard de Temporada de IQ Basket: SeasonDashboardView.js
 * @description Presenta el resumen ejecutivo, KPIs de 3 niveles, líderes FIBA,
 * 6 gráficas analíticas SVG y bloque de insights automáticos.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { selectScopedPlayerStatsV81 } from "../domain/stats/StatScopeV81.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";
import { AdvancedTeamStatsCalculator } from "../domain/stats/AdvancedTeamStatsCalculator.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { StatsSyncService } from "../services/StatsSyncService.js";
import { Permission } from "../security/PermissionService.js";
import { interpolateLanguageV80 } from "../services/i18n/BundledLanguageCatalogV80.js";

export class SeasonDashboardView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.syncService = new StatsSyncService(this.supabase, this.auth);

    this.sortState = {
      column: "date",
      ascending: false
    };

    this.cachedGames = [];
    this.cachedPlayerStats = [];
    this.currentTeamId = null;
    // Feature locale catalog is lazy-loaded before render; no initial-bundle penalty.
    this.dashboardLocalePack = null;
  }

  /**
   * Resolve view-specific copy through its on-demand catalog, falling back to
   * shared translations only for legacy consumers. Never translate sport data.
   */
  t(key, fallback = "", params = {}) {
    const locale = I18n.getLocale?.() || "es";
    const alias = key.startsWith("dashboard.v86.") ? key.slice("dashboard.v86.".length) : key;
    const value = this.dashboardLocalePack?.[locale]?.[alias]
      ?? this.dashboardLocalePack?.es?.[alias]
      ?? TranslationStore.t(key, params, fallback);
    return interpolateLanguageV80(value || fallback || key, params);
  }

  _canSync(teamId = null) {
    return Boolean(this.auth?.canPreview?.(Permission.SYNC_DATA, {
      teamId: teamId || this.currentTeamId || null
    }));
  }

  _formatDateES(dateStr) {
    if (!dateStr || dateStr === "-") return "-";
    return I18n && typeof I18n.formatDate === "function" ? I18n.formatDate(dateStr) : dateStr;
  }

  /** Historical API name; metric is the canonical PIR, not FIBA EFF. */
  _calculateFibaVal(st = {}) {
    return BoxScoreCalculator.calculatePlayerBoxScore(st).pir;
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

  /** Only publish persisted, attributable ratings; no guessed 60 FGA/70 poss. */
  _calculateGameRatings(game) {
    const unavailable={off:"-",def:"-",offNum:-999,defNum:999};
    if (!this._normalizeGameScore(game).hasPlayed) return unavailable;
    const offRaw=game.off_rating ?? game.ortg ?? game.offensiveRating;
    const defRaw=game.def_rating ?? game.drtg ?? game.defensiveRating;
    if(offRaw===null||offRaw===undefined||defRaw===null||defRaw===undefined) return unavailable;
    const off=Number(offRaw),def=Number(defRaw);
    if(!Number.isFinite(off)||!Number.isFinite(def))return unavailable;
    return {off:off.toFixed(1),def:def.toFixed(1),offNum:off,defNum:def};
  }

  _getTopPlayers(playerStatsRows = [], playersMap = new Map()) {
    const map = {};

    if (playerStatsRows && playerStatsRows.length > 0) {
      playerStatsRows.forEach((row) => {
        const pId = String(row.player_id ?? row.playerId ?? "");
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

        const minutes = Number(row.minutes || row.minutesPlayed || 0);

        // SOLO SE CONTABILIZA SI EL JUGADOR DISPUTÓ MINUTOS (> 0)
        if (minutes <= 0) return;

        const val = this._calculateFibaVal(row);

        if (!map[pId]) {
          map[pId] = {
            name: fullName,
            number: jerseyNum,
            position: pInfo.primary_position || pInfo.primaryPosition || pInfo.position || this.t("dashboard.v86.player"),
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
        return {
          ...p,
          avgVal
        };
      })
      .filter((p) => p.gamesPlayed >= 1)
      .sort((a, b) => b.avgVal - a.avgVal)
      .slice(0, 3);

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

  _renderEvidenceInsights(kpis = {}, games = []) {
    if (!Array.isArray(games) || games.length === 0) {
      return `
        <div class="insight-item">
          <div><strong>ℹ️ ${this.t("dashboard.v86.noGamesInsight")}</strong></div>
          <span>${this.t("dashboard.v86.noGamesDetail")}</span>
        </div>
      `;
    }

    const items = [];
    const tovPct = Number(kpis.tovPct);
    const netRtg = Number(kpis.netRtg);

    if (Number.isFinite(tovPct) && tovPct > 0) {
      if (tovPct > 18) {
        items.push(`
          <div class="insight-item insight-warning">
            <div><strong>⚠️ ${this.t("dashboard.v86.highTurnovers")}</strong> <span class="insight-badge badge-alerta">${this.t("dashboard.v86.badgeFact")}</span></div>
            <span>${this.t("dashboard.v86.highTurnoversDetail","",{pct:tovPct.toFixed(1)})}</span>
          </div>
        `);
      } else {
        items.push(`
          <div class="insight-item">
            <div><strong>✅ ${this.t("dashboard.v86.controlledTurnovers")}</strong> <span class="insight-badge">${this.t("dashboard.v86.badgeFact")}</span></div>
            <span>${this.t("dashboard.v86.turnoversDetail","",{pct:tovPct.toFixed(1)})}</span>
          </div>
        `);
      }
    }

    if (Number.isFinite(netRtg) && netRtg !== 0) {
      items.push(`
        <div class="insight-item ${netRtg < 0 ? 'insight-warning' : ''}">
          <div><strong>${netRtg < 0 ? "⚠️" : "📈"} ${this.t(netRtg < 0 ? "dashboard.v86.netNegative" : "dashboard.v86.netPositive")}</strong> <span class="insight-badge">${this.t("dashboard.v86.badgeFact")}</span></div>
          <span>${this.t("dashboard.v86.netDetail","",{rating:`${netRtg > 0 ? "+" : ""}${netRtg.toFixed(1)}`})}</span>
        </div>
      `);
    }

    const quarterRows = [];
    games.forEach(game => {
      const periods = DataStore.getGamePeriodScores?.(game.id) || [];
      periods
        .filter(row => !Boolean(row.is_overtime ?? row.isOvertime) && Number(row.period_number ?? row.periodNumber) >= 1 && Number(row.period_number ?? row.periodNumber) <= 4)
        .forEach(row => quarterRows.push(row));
    });

    if (quarterRows.length > 0) {
      const byQuarter = new Map();
      quarterRows.forEach(row => {
        const q = Number(row.period_number ?? row.periodNumber);
        const entry = byQuarter.get(q) || { diff: 0, count: 0 };
        entry.diff += Number(row.team_score ?? row.teamScore ?? 0) - Number(row.opponent_score ?? row.opponentScore ?? 0);
        entry.count += 1;
        byQuarter.set(q, entry);
      });

      const ranked = [...byQuarter.entries()]
        .map(([q, data]) => ({ q, avgDiff: data.count ? data.diff / data.count : 0 }))
        .sort((a, b) => a.avgDiff - b.avgDiff);

      if (ranked.length > 0) {
        const worst = ranked[0];
        items.push(`
          <div class="insight-item ${worst.avgDiff < 0 ? 'insight-warning' : ''}">
            <div><strong>🧭 ${this.t("dashboard.v86.quarterBalance")}</strong> <span class="insight-badge">${this.t("dashboard.v86.badgeFact")}</span></div>
            <span>${this.t("dashboard.v86.quarterDetail","",{quarter:worst.q,difference:`${worst.avgDiff > 0 ? "+" : ""}${worst.avgDiff.toFixed(1)}`})}</span>
          </div>
        `);
      }
    } else {
      items.push(`
        <div class="insight-item">
          <div><strong>ℹ️ ${this.t("dashboard.v86.periodsMissing")}</strong></div>
          <span>${this.t("dashboard.v86.periodsMissingDetail")}</span>
        </div>
      `);
    }

    return items.join("");
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

      const efgVal = totFga > 0
        ? Number((((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1))
        : null;
      const poss = totFga + 0.44 * totFta + totTov;
      const ortg = poss > 0 ? (teamPts / poss) * 100 : null;
      // Opponent defensive possessions are not given by own-player statistics.
      const drtg = null;

      const rawNet = ortg !== null && drtg !== null
        ? Number((ortg - drtg).toFixed(1))
        : null;
      const netRating = rawNet === null
        ? null
        : Math.max(-90, Math.min(40, rawNet));

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

    const svgWidth = 600;
    const svgHeight = 150;

    // 1. Net Rating
    const minNet = -90;
    const maxNet = 30;
    const netPoints = gameMetrics.map((m, i) => {
      if (m.netRating === null) return null;
      const divisor = totalGames > 1 ? (totalGames - 1) : 1;
      const x = (i / divisor) * svgWidth;
      const y = svgHeight - ((m.netRating - minNet) / (maxNet - minNet)) * svgHeight;
      return { x, y, val: m.netRating, label: m.label };
    }).filter(Boolean);
    const netCurveD = this._buildSmoothSvgPath(netPoints);

    const svgNetRating = `
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>30</span><span>0</span><span>-30</span><span>-60</span><span>-90</span>
        </div>
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="chart-svg">
            <line x1="0" y1="${svgHeight - ((0 - minNet) / (maxNet - minNet)) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((0 - minNet) / (maxNet - minNet)) * svgHeight}" stroke="#e2e8f0" stroke-dasharray="4 4" stroke-width="1.5"/>
            ${netCurveD ? `<path d="${netCurveD}" fill="none" stroke="#1e3a8a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : `<text x="300" y="78" text-anchor="middle" fill="#94a3b8" font-size="13">${this.t("dashboard.v86.insufficientPoss")}</text>`}
            ${netPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#1e3a8a" stroke="white" stroke-width="2"><title>${p.label}: ${p.val}</title></circle>`).join("")}
          </svg>
          <div class="chart-x-labels">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `;

    // 2. Puntos Anotados vs Recibidos
    const maxPtsVal = 100;
    const ptsBars = gameMetrics.map((m) => {
      const hUs = Math.min(100, Math.round((m.ptsUs / maxPtsVal) * 100));
      const hThem = Math.min(100, Math.round((m.ptsThem / maxPtsVal) * 100));
      return `
        <div class="bar-col">
          <div class="bar-pair">
            <div class="bar-bar bar-blue" style="height: ${hUs}%;" title="${this.t("dashboard.v86.pointsForLabel","",{count:m.ptsUs})}"></div>
            <div class="bar-bar bar-orange" style="height: ${hThem}%;" title="${this.t("dashboard.v86.pointsAgainstLabel","",{count:m.ptsThem})}"></div>
          </div>
          <span class="bar-label">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartPts = `
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
        </div>
        <div class="chart-bars-wrap">
          <div class="chart-bars-row">
            ${ptsBars}
          </div>
        </div>
      </div>
      <div class="chart-legend-box">
        <span class="legend-badge"><span class="legend-sq" style="background:#1e3a8a;"></span> ${this.t("dashboard.v86.pointsFor")}</span>
        <span class="legend-badge"><span class="legend-sq" style="background:#f97316;"></span> ${this.t("dashboard.v86.pointsAgainstLabel")}</span>
      </div>
    `;

    // 3. eFG%
    const minEfg = 20;
    const maxEfg = 70;
    const efgPoints = gameMetrics.map((m, i) => {
      if (m.efgVal === null) return null;
      const clampedEfg = Math.max(minEfg, Math.min(maxEfg, m.efgVal));
      const divisor = totalGames > 1 ? (totalGames - 1) : 1;
      const x = (i / divisor) * svgWidth;
      const y = svgHeight - ((clampedEfg - minEfg) / (maxEfg - minEfg)) * svgHeight;
      return { x, y, val: m.efgVal, label: m.label };
    }).filter(Boolean);
    const efgCurveD = this._buildSmoothSvgPath(efgPoints);

    const svgEfg = `
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>70</span><span>50.8</span><span>35.8</span><span>20.8</span>
        </div>
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="chart-svg">
            ${efgCurveD ? `<path d="${efgCurveD}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : `<text x="300" y="78" text-anchor="middle" fill="#94a3b8" font-size="13">${this.t("dashboard.v86.insufficientShooting")}</text>`}
            ${efgPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#22c55e" stroke="white" stroke-width="2"><title>${p.label}: ${p.val}%</title></circle>`).join("")}
          </svg>
          <div class="chart-x-labels">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
    `;

    // 4. Pérdidas
    const maxTov = 60;
    const tovBars = gameMetrics.map((m) => {
      const hTov = Math.min(100, Math.round((m.tov / maxTov) * 100));
      return `
        <div class="bar-col">
          <div class="bar-pair">
            <div class="bar-bar bar-red" style="height: ${hTov}%;" title="${this.t("dashboard.v86.turnoversLabel","",{count:m.tov})}"></div>
          </div>
          <span class="bar-label">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartTov = `
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>60</span><span>45</span><span>30</span><span>15</span><span>0</span>
        </div>
        <div class="chart-bars-wrap">
          <div class="chart-bars-row">
            ${tovBars}
          </div>
        </div>
      </div>
    `;

    // 5. Rebote Ofensivo y Defensivo: datos reales del boxscore.
    const maxReb = Math.max(
      10,
      ...gameMetrics.map(m => Math.max(Number(m.orbCount || 0), Number(m.drbCount || 0)))
    );
    const buildRebPoints = (key) => gameMetrics.map((m, i) => {
      const divisor = totalGames > 1 ? (totalGames - 1) : 1;
      const x = (i / divisor) * svgWidth;
      const val = Number(m[key] || 0);
      const y = svgHeight - (val / maxReb) * svgHeight;
      return { x, y, val, label: m.label };
    });
    const orbPoints = buildRebPoints("orbCount");
    const drbPoints = buildRebPoints("drbCount");
    const orbCurveD = this._buildSmoothSvgPath(orbPoints);
    const drbCurveD = this._buildSmoothSvgPath(drbPoints);

    const chartRebound = `
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>${maxReb}</span><span>${Math.round(maxReb * .75)}</span><span>${Math.round(maxReb * .5)}</span><span>${Math.round(maxReb * .25)}</span><span>0</span>
        </div>
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="chart-svg">
            <path d="${orbCurveD}" fill="none" stroke="#f97316" stroke-width="2.5" />
            <path d="${drbCurveD}" fill="none" stroke="#1e3a8a" stroke-width="2.5" />
            ${orbPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#f97316"><title>${p.label}: ${this.t("dashboard.v86.offReboundsLabel","",{count:p.val})}</title></circle>`).join("")}
            ${drbPoints.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#1e3a8a"><title>${p.label}: ${this.t("dashboard.v86.defReboundsLabel","",{count:p.val})}</title></circle>`).join("")}
          </svg>
          <div class="chart-x-labels">
            ${gameMetrics.map(m => `<span>${m.label}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="chart-legend-box">
        <span class="legend-badge"><span class="legend-line" style="background:#f97316;"></span> ${this.t("dashboard.v86.offRebounds")}</span>
        <span class="legend-badge"><span class="legend-line" style="background:#1e3a8a;"></span> ${this.t("dashboard.v86.defRebounds")}</span>
      </div>
    `;

    // 6. Rendimiento por Cuartos: promedio real de parciales registrados.
    const quarterAccumulator = new Map();
    chronGames.forEach(game => {
      const periods = DataStore.getGamePeriodScores?.(game.id) || [];
      periods
        .filter(row => !Boolean(row.is_overtime ?? row.isOvertime))
        .forEach(row => {
          const q = Number(row.period_number ?? row.periodNumber);
          if (q < 1 || q > 4) return;
          const entry = quarterAccumulator.get(q) || { us: 0, them: 0, count: 0 };
          entry.us += Number(row.team_score ?? row.teamScore ?? 0);
          entry.them += Number(row.opponent_score ?? row.opponentScore ?? 0);
          entry.count += 1;
          quarterAccumulator.set(q, entry);
        });
    });

    const quarters = [1, 2, 3, 4].map(q => {
      const data = quarterAccumulator.get(q);
      return {
        name: `Q${q}`,
        us: data?.count ? data.us / data.count : null,
        them: data?.count ? data.them / data.count : null
      };
    });
    const quarterValues = quarters.flatMap(q => [q.us, q.them]).filter(v => v !== null);
    const maxQuarter = Math.max(10, ...quarterValues);
    const hasQuarterData = quarterValues.length > 0;

    const quarterBars = hasQuarterData ? quarters.map((q) => {
      const hUs = q.us === null ? 0 : Math.round((q.us / maxQuarter) * 100);
      const hThem = q.them === null ? 0 : Math.round((q.them / maxQuarter) * 100);
      return `
        <div class="bar-col" style="flex: 1; max-width: 60px;">
          <div class="bar-pair" style="gap: 6px;">
            <div class="bar-bar bar-blue" style="height: ${hUs}%; width: 22px;" title="A favor: ${q.us === null ? 'Sin datos' : q.us.toFixed(1)}"></div>
            <div class="bar-bar bar-orange" style="height: ${hThem}%; width: 22px;" title="En contra: ${q.them === null ? 'Sin datos' : q.them.toFixed(1)}"></div>
          </div>
          <span class="bar-label" style="font-weight: 800; font-size: 11px;">${q.name}</span>
        </div>
      `;
    }).join("") : "";

    const chartQuarters = hasQuarterData ? `
      <div class="chart-flex-wrap">
        <div class="chart-y-axis">
          <span>${Math.round(maxQuarter)}</span>
          <span>${Math.round(maxQuarter * .75)}</span>
          <span>${Math.round(maxQuarter * .5)}</span>
          <span>${Math.round(maxQuarter * .25)}</span>
          <span>0</span>
        </div>
        <div class="chart-bars-wrap">
          <div class="chart-bars-row" style="justify-content: space-around;">
            ${quarterBars}
          </div>
        </div>
      </div>
      <div class="chart-legend-box">
        <span class="legend-badge"><span class="legend-sq" style="background:#1e3a8a;"></span> ${this.t("dashboard.v86.pointsFor")}</span>
        <span class="legend-badge"><span class="legend-sq" style="background:#f97316;"></span> ${this.t("dashboard.v86.pointsAgainstLabel")}</span>
      </div>
    ` : `
      <div style="padding: 28px; text-align: center; color: #64748b; font-size: 12px;">
        Sin datos de parciales para este contexto.
      </div>
    `;

    return `
      <div class="clean-charts-grid">
        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("net_rating_evolution", "EVOLUCIÓN DEL NET RATING")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("net_rating_tooltip")}</div>
            </div>
          </div>
          ${svgNetRating}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("pts_scored_vs_received", "PUNTOS A FAVOR VS EN CONTRA")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("dashboard.v86.pointsCompareTooltip")}</div>
            </div>
          </div>
          ${chartPts}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("efg_evolution", "EVOLUCIÓN DEL EFG%")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("efg_tooltip")}</div>
            </div>
          </div>
          ${svgEfg}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("turnovers_per_game", "PÉRDIDAS POR PARTIDO")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("turnovers_tooltip")}</div>
            </div>
          </div>
          ${chartTov}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("rebound_off_def", "REBOTE OFENSIVO Y DEFENSIVO")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("rebound_tooltip")}</div>
            </div>
          </div>
          ${chartRebound}
        </div>

        <div class="clean-chart-card">
          <div class="clean-chart-header">
            <span>${this.t("quarter_performance", "RENDIMIENTO POR CUARTOS")}</span>
            <div class="dash-tooltip-wrapper">
              <span class="tooltip-trigger">?</span>
              <div class="dash-tooltip-popup">${this.t("dashboard.v86.quarterTooltip")}</div>
            </div>
          </div>
          ${chartQuarters}
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
      return `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #94a3b8;">${this.t("dashboard.v86.noGames")}</td></tr>`;
    }

    return sortedGames.map((g) => {
      const { teamPts, oppPts, hasPlayed } = this._normalizeGameScore(g);

      const isWin = hasPlayed && teamPts > oppPts;
      const diff = hasPlayed ? teamPts - oppPts : 0;

      const venueLower = String(g.venue || "").toLowerCase();
      const isHome = venueLower === "home" || venueLower === "local" || g.is_home === true || g.isHome === true;
      
      const venueText = isHome ? this.t("dashboard.v86.home") : this.t("dashboard.v86.away");
      const scoreText = hasPlayed ? `${teamPts}-${oppPts}` : "-";
      const opponentName = g.opponent || g.opponent_name || g.opponentName || this.t("dashboard.v86.unknownOpponent");
      const formattedDate = this._formatDateES(g.date || "-");
      const ratings = this._calculateGameRatings(g);

      return `
        <tr class="game-table-row">
          <td style="color: #475569; font-weight: 500;">${formattedDate}</td>
          <td style="font-weight: 800; color: #0f172a;">${opponentName}</td>
          <td>
            <span class="venue-pill ${isHome ? 'pill-blue' : 'pill-gray'}">
              ${venueText}
            </span>
          </td>
          <td style="font-weight: 900; color: ${isWin ? '#16a34a' : '#dc2626'};">
            ${scoreText}
          </td>
          <td style="font-weight: 700; color: #475569;">
            ${hasPlayed ? (diff > 0 ? `+${diff}` : diff) : "-"}
          </td>
          <td style="font-weight: 700; color: #475569;">
            ${ratings.off !== "-" ? ratings.off : '-'}
          </td>
          <td style="font-weight: 700; color: #475569;">
            ${ratings.def !== "-" ? ratings.def : '-'}
          </td>
          <td style="text-align: right;">
            <a href="#/boxscore/${g.id}" class="clean-análisis-link">
              ${this.t("dashboard.v86.analysis")}
            </a>
          </td>
        </tr>
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
        alert(this.t("dashboard.v86.auditForbidden"));
        return;
      }

      syncBtn.disabled = true;
      syncBtn.textContent = `⏳ ${this.t("dashboard.v86.auditing")}`;
      syncBtn.style.opacity = "0.7";

      if (DataStore.init) await DataStore.init(teamId || this.currentTeamId, true);
      const result = await this.syncService.runFullAuditAndSync(teamId || this.currentTeamId, this.cachedPlayerStats);

      if (result && result.success) {
        syncBtn.textContent = `✅ ${this.t("dashboard.v86.audited","",{compared:result.compared,discrepancies:result.discrepancies})}`;
        setTimeout(() => {
          this.render(container, teamId || this.currentTeamId);
        }, 1000);
      } else {
        syncBtn.textContent = `❌ ${this.t("dashboard.v86.auditUnavailable")}`;
        setTimeout(() => {
          syncBtn.disabled = false;
          syncBtn.textContent = `🔎 ${this.t("dashboard.v86.audit")}`;
          syncBtn.style.opacity = "1";
        }, 2000);
      }
    });
  }

  async render(containerId = "dashboard-content-area", teamId = null) {
    try {
      // Resolve only when the dashboard is actually opened. Locale is read on every t() call.
      if (!this.dashboardLocalePack) {
        const { SEASON_DASHBOARD_V86 } = await import("../locales/seasonDashboardV86.js");
        this.dashboardLocalePack = SEASON_DASHBOARD_V86;
      }
      this.currentTeamId = teamId || DataStore.getActiveTeamId();
      const container = typeof containerId === "string" 
        ? (document.getElementById(containerId) || document.getElementById("main-content") || document.getElementById("app"))
        : containerId;
      if (!container) return;

      const activeSeasonContext = DataStore.getActiveSeasonContext?.(this.currentTeamId) || null;
      const activeSeason = DataStore.getActiveSeasonDisplayName?.(this.currentTeamId)
        || activeSeasonContext?.name
        || DataStore.getActiveSeason?.()
        || this.t("dashboard.v86.noSeason");
      const activeTeamSeasonId = activeSeasonContext?.team_season_id
        || activeSeasonContext?.teamSeasonId
        || DataStore.getActiveTeamSeasonId?.(this.currentTeamId)
        || null;
      const activeSeasonId = activeSeasonContext?.legacy_season_id
        || activeSeasonContext?.legacySeasonId
        || DataStore.getActiveSeasonId?.(this.currentTeamId)
        || null;

      const games = DataStore.getGamesForActiveSeason
        ? (DataStore.getGamesForActiveSeason(this.currentTeamId) || [])
        : (DataStore.getGames?.(this.currentTeamId) || []);
      const players = DataStore.getSeasonParticipantPlayers
        ? (DataStore.getSeasonParticipantPlayers(this.currentTeamId) || [])
        : (DataStore.getPlayers?.(this.currentTeamId) || []);
      const gameIds = new Set(games.map(g => String(g.id)));
      const allPlayerStats = DataStore.getPlayerGameStats ? (DataStore.getPlayerGameStats() || []) : [];
      const playerStats = selectScopedPlayerStatsV81(allPlayerStats, games);

      this.cachedGames = games;
      this.cachedPlayerStats = playerStats;

      const playersMap = new Map((players || []).map(p => [String(p.id), p]));
      const activeTeamObj = DataStore.getTeamById ? (DataStore.getTeamById(this.currentTeamId) || {}) : {};
      
      const teamName = activeTeamObj.name || this.t("dashboard.v86.noTeam");
      const teamCategory = activeTeamObj.category || "—";
      const teamCompetition = activeTeamObj.competition || "—";
      const canSyncPreview = this._canSync(this.currentTeamId);

      let kpis = { wins: 0, losses: 0, ppg: 0, oppPpg: 0, diffPpg: 0, ortg: 0, drtg: 0, netRtg: 0, pace: 0, efg: 0, tovPct: 0 };
      if (StatsEngine && typeof StatsEngine.calculateTeamDashboardKPIs === "function") {
        kpis = StatsEngine.calculateTeamDashboardKPIs(this.cachedGames, playerStats) || kpis;
      }
      
      const playedGameIds=new Set(StatsEngine.filterPlayedGames(games).map(g=>String(g.id)));
      const topPlayers = this._getTopPlayers(playerStats.filter(row=>playedGameIds.has(String(row.game_id??row.gameId))), playersMap);
      const sortedGames = this._sortGames(this.cachedGames);
      const gamesTableRows = this._renderTableRows(sortedGames);

      const topPlayersMarkup = topPlayers.map((p, index) => `
        <div class="purple-leader-col">
          <span class="leader-pill-yellow">#${index + 1} ${this.t("dashboard.v86.leader")}</span>
          <div class="leader-main-info">
            <strong class="leader-player-name">${p.number} ${p.name}</strong>
            <span class="leader-player-meta">${p.position} · ${p.gamesPlayed} ${this.t("dashboard.v86.playedShort")}</span>
          </div>
          <div class="leader-val-box">
            <span class="leader-val-num">${p.avgVal}</span>
            <span class="leader-val-txt">${this.t("dashboard.v86.valuePerGame")}</span>
          </div>
        </div>
      `).join("") || `<div class="dash-empty-leaders">${this.t("dashboard.v86.noLeaders")}</div>`;

      container.innerHTML = `
        <div class="clean-dashboard-wrapper">
          
          <style>
            .clean-dashboard-wrapper { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; max-width: 1350px; margin: 0 auto; padding-bottom: 50px; }
            
            /* TOP HEADER */
            .dash-top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
            .dash-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            .dash-main-title { font-size: 22px; font-weight: 900; margin: 0; color: #0f172a; }
            .dash-category-badge { background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #bfdbfe; }
            .dash-meta-line { font-size: 12px; color: #64748b; margin-top: 4px; }
            .dash-win-loss { font-weight: 800; }
            .dash-win-loss .w-text { color: #16a34a; }
            .dash-win-loss .l-text { color: #dc2626; }
            
            .dash-top-actions { display: flex; align-items: center; gap: 10px; }
            
            /* TOOLTIP SYSTEM */
            .dash-tooltip-wrapper { position: relative; display: inline-flex; align-items: center; }
            .tooltip-trigger { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1px solid #cbd5e1; color: #94a3b8; border-radius: 50%; font-size: 10px; font-weight: 800; cursor: pointer; background: #ffffff; }
            .dash-tooltip-popup {
              display: none;
              position: absolute;
              bottom: 135%;
              left: 50%;
              transform: translateX(-50%);
              background: #0f172a;
              color: #ffffff;
              padding: 8px 12px;
              border-radius: 8px;
              font-size: 11px;
              font-weight: 600;
              line-height: 1.4;
              width: max-content;
              max-width: 240px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.3);
              z-index: 99999;
              pointer-events: none;
              text-align: center;
            }
            .dash-tooltip-popup::after {
              content: "";
              position: absolute;
              top: 100%;
              left: 50%;
              margin-left: -5px;
              border-width: 5px;
              border-style: solid;
              border-color: #0f172a transparent transparent transparent;
            }
            .dash-tooltip-wrapper:hover .dash-tooltip-popup,
            .dash-tooltip-wrapper:focus-within .dash-tooltip-popup {
              display: block !important;
            }

            /* KPI GRID (Clean White Cards) */
            .kpi-cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
            .kpi-box-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; justify-content: space-between; min-height: 85px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
            .kpi-top-label { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
            .kpi-main-number { font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 4px; }
            .kpi-sub-trend { font-size: 10px; font-weight: 700; margin-top: 2px; }
            .trend-down { color: #dc2626; }
            .trend-up { color: #16a34a; }
            
            /* PURPLE HERO CARD */
            .purple-leaders-banner { background: #2e1065; border-radius: 12px; padding: 18px 20px; color: white; margin-bottom: 24px; }
            .purple-card-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 900; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; }
            .purple-leaders-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
            .purple-leader-col { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
            .leader-pill-yellow { font-size: 9px; font-weight: 900; color: #fbbf24; display: block; margin-bottom: 2px; }
            .leader-player-name { font-size: 13.5px; font-weight: 800; color: #ffffff; display: block; }
            .leader-player-meta { font-size: 11px; color: #c4b5fd; }
            .leader-val-box { text-align: right; }
            .leader-val-num { font-size: 22px; font-weight: 900; color: #fde047; display: block; }
            .leader-val-txt { font-size: 9px; font-weight: 800; color: #ffffff; }
            
            /* CHARTS GRID */
            .clean-charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
            .clean-chart-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
            .clean-chart-header { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 12px; }
            .chart-flex-wrap { display: flex; gap: 10px; align-items: stretch; }
            .chart-y-axis { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 700; width: 28px; text-align: right; }
            .chart-svg-container { flex: 1; display: flex; flex-direction: column; }
            .chart-svg { width: 100%; height: 140px; overflow: visible; }
            .chart-x-labels { display: flex; justify-content: space-between; font-size: 9.5px; color: #64748b; font-weight: 700; margin-top: 6px; }
            
            .chart-bars-wrap { flex: 1; display: flex; flex-direction: column; height: 140px; }
            .chart-bars-row { display: flex; gap: 4px; align-items: flex-end; height: 100%; width: 100%; }
            .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
            .bar-pair { display: flex; align-items: flex-end; gap: 2px; width: 100%; height: 100%; justify-content: center; }
            .bar-bar { width: 45%; border-radius: 2px 2px 0 0; }
            .bar-blue { background: #1e3a8a; }
            .bar-orange { background: #f97316; }
            .bar-red { background: #dc2626; width: 70%; }
            .bar-label { font-size: 9.5px; color: #64748b; font-weight: 700; margin-top: 4px; }
            
            .chart-legend-box { display: flex; justify-content: center; gap: 14px; margin-top: 8px; font-size: 10px; font-weight: 700; color: #64748b; }
            .legend-badge { display: flex; align-items: center; gap: 4px; }
            .legend-sq { width: 8px; height: 8px; border-radius: 2px; }
            .legend-line { width: 12px; height: 2px; }
            
            /* TABLES CARD */
            .clean-table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
            .clean-table-title { font-size: 12px; font-weight: 900; color: #475569; text-transform: uppercase; margin: 0 0 14px 0; }
            .clean-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
            .clean-table th { padding: 10px 8px; font-size: 10.5px; font-weight: 800; color: #64748b; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; }
            .clean-table td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
            .venue-pill { padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; }
            .pill-blue { background: #dbeafe; color: #1e40af; }
            .pill-gray { background: #f1f5f9; color: #475569; }
            .clean-análisis-link { color: #1e40af; font-weight: 700; text-decoration: none; }
            .clean-análisis-link:hover { text-decoration: underline; }
            
            /* INSIGHTS / LO MÁS IMPORTANTE */
            .insights-box-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
            .insights-header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 900; color: #d97706; text-transform: uppercase; margin-bottom: 14px; }
            .insights-list { display: flex; flex-direction: column; gap: 10px; }
            .insight-item { border-radius: 8px; padding: 10px 14px; font-size: 11.5px; line-height: 1.4; display: flex; flex-direction: column; gap: 2px; }
            .insight-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
            .insight-danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
            .insight-badge { font-size: 9.5px; font-weight: 800; padding: 1px 6px; border-radius: 4px; display: inline-block; margin-left: 6px; }
            .badge-alerta { background: #fef3c7; color: #b45309; }
            .badge-debilidad { background: #fee2e2; color: #b91c1c; }
            
            /* RESPONSIVE */
            @media (max-width: 1024px) {
              .kpi-cards-grid { grid-template-columns: repeat(2, 1fr); }
              .purple-leaders-grid { grid-template-columns: 1fr; }
              .clean-charts-grid { grid-template-columns: 1fr; }
            }
          </style>

          <!-- TOP HEADER BAR (Sin botón de Nuevo Partido) -->
          <div class="dash-top-bar">
            <div>
              <div class="dash-title-row">
                <h1 class="dash-main-title">${teamName}</h1>
                <span class="dash-category-badge">${teamCategory}</span>
              </div>
              <div class="dash-meta-line">
                ${this.t("dashboard.v86.season")} ${activeSeason} · ${teamCompetition} &nbsp;·&nbsp; 
                <span class="dash-win-loss"><span class="w-text">${kpis.wins}${this.t("dashboard.v86.winShort")}</span> <span class="l-text">${kpis.losses}${this.t("dashboard.v86.lossShort")}</span></span> &nbsp;·&nbsp; 
                ${this.t("dashboard.v86.gamesCount","",{count:this.cachedGames.length})}
              </div>
            </div>

            <div class="dash-top-actions">
              <button id="btn-sync-data" aria-disabled="${!canSyncPreview}" style="background: ${canSyncPreview ? '#f8fafc' : '#e2e8f0'}; color: ${canSyncPreview ? '#0f172a' : '#64748b'}; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: ${canSyncPreview ? 'pointer' : 'not-allowed'};">
                🔎 ${this.t("dashboard.v86.audit")}${canSyncPreview ? "" : " 🔒"}
              </button>
            </div>
          </div>

          <!-- CARDS DE KPIS LIMPIAS CON TOOLTIPS FLOTANTES -->
          <div class="kpi-cards-grid">
            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.played")}</span>
              </div>
              <div class="kpi-main-number">${this.cachedGames.length}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.wins")}</span>
              </div>
              <div class="kpi-main-number">${kpis.wins}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.losses")}</span>
              </div>
              <div class="kpi-main-number">${kpis.losses}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.pointsPerGame")}</span>
              </div>
              <div class="kpi-main-number">${kpis.ppg}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.pointsAgainst")}</span>
              </div>
              <div class="kpi-main-number">${kpis.oppPpg}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.avgDiff")}</span>
              </div>
              <div class="kpi-main-number" style="color: ${kpis.diffPpg < 0 ? '#0f172a' : '#16a34a'};">
                ${kpis.diffPpg > 0 ? '+' : ''}${kpis.diffPpg}
              </div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.offensiveRating")}</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("off_rating_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${kpis.ortg ?? this.t("dashboard.v86.notAvailable")}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.defensiveRating")}</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("def_rating_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${kpis.drtg ?? this.t("dashboard.v86.notAvailable")}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.netRating")}</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("net_rating_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${kpis.netRtg===null || kpis.netRtg===undefined ? this.t("dashboard.v86.notAvailable") : (kpis.netRtg>0?"+":"")+kpis.netRtg}</div>
              ${kpis.netRtg===null||kpis.netRtg===undefined ? `<span class="kpi-sub-trend">${this.t("dashboard.v86.netNotAvailable")}</span>` : ""}
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>${this.t("dashboard.v86.pace")}</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("pace_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${kpis.pace ?? this.t("dashboard.v86.notAvailable")}</div>
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>EFG%</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("efg_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${kpis.efg===null||kpis.efg===undefined?this.t("dashboard.v86.notAvailable"):kpis.efg+"%"}</div>
              
            </div>

            <div class="kpi-box-card">
              <div class="kpi-top-label">
                <span>TOV%</span>
                <div class="dash-tooltip-wrapper">
                  <span class="tooltip-trigger">?</span>
                  <div class="dash-tooltip-popup">${this.t("tov_pct_tooltip")}</div>
                </div>
              </div>
              <div class="kpi-main-number">${kpis.tovPct===null||kpis.tovPct===undefined?this.t("dashboard.v86.notAvailable"):kpis.tovPct+"%"}</div>
              
            </div>
          </div>

          <!-- HERO CARD PURPLE LÍDERES FIBA (Texto en blanco) -->
          <div class="purple-leaders-banner">
            <div class="purple-card-title">
              <span>🏆 ${this.t("dashboard.v86.fibaLeaders")}</span>
            </div>
            <div class="purple-leaders-grid">
              ${topPlayersMarkup}
            </div>
          </div>

          <!-- 6 GRÁFICAS DE EVOLUCIÓN -->
          ${this._renderCharts(this.cachedGames)}

          <!-- TABLA DE ÚLTIMOS PARTIDOS -->
          <div class="clean-table-card">
            <h3 class="clean-table-title">${this.t("dashboard.v86.recentGames")}</h3>
            <div style="overflow-x: auto;">
              <table class="clean-table">
                <thead>
                  <tr>
                    <th data-sort="date" style="cursor: pointer;">${this.t("dashboard.v86.date")} ↕</th>
                    <th data-sort="opponent" style="cursor: pointer;">${this.t("dashboard.v86.opponent")} ↕</th>
                    <th data-sort="venue" style="cursor: pointer;">${this.t("dashboard.v86.venue")} ↕</th>
                    <th data-sort="score" style="cursor: pointer;">${this.t("dashboard.v86.result")} ↕</th>
                    <th data-sort="diff" style="cursor: pointer;">${this.t("dashboard.v86.difference")} ↕</th>
                    <th data-sort="off" style="cursor: pointer;">OFF ↕</th>
                    <th data-sort="def" style="cursor: pointer;">DEF ↕</th>
                    <th style="text-align: right;">${this.t("dashboard.v86.action")}</th>
                  </tr>
                </thead>
                <tbody id="games-table-body">
                  ${gamesTableRows}
                </tbody>
              </table>
            </div>
          </div>

          <!-- LO MÁS IMPORTANTE (ALERTAS Y DEBILIDADES) -->
          <div class="insights-box-card">
            <div class="insights-header">
              <span>💡 ${this.t("dashboard.v86.insightsTitle")}</span>
            </div>
            <div class="insights-list">
              ${this._renderEvidenceInsights(kpis, this.cachedGames)}
            </div>
          </div>

        </div>
      `;

      this._attachSortEventListeners(container);
      this._attachSyncButtonListener(container, this.currentTeamId);

    } catch (err) {
      console.error("[SeasonDashboardView] Error renderizando dashboard:", err);
    }
  }
}

export default SeasonDashboardView;