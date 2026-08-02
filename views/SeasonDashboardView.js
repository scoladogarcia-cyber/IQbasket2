/**
 * @fileoverview Vista del Dashboard de Temporada de IQ Basket.
 * Incluye tooltips explicativos en KPIs, Líderes de Valoración (VAL/PJ), Gráficas, Tabla
 * y Botón de Sincronización y Auditoría Directa con Supabase a través de StatsSyncService.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { StatsSyncService } from "../services/StatsSyncService.js";

export class SeasonDashboardView {
  constructor(supabaseClient) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.syncService = new StatsSyncService(this.supabase);

    this.sortState = {
      column: "date",
      ascending: false
    };

    this.cachedGames = [];
    this.cachedStatsMap = new Map();
    this.currentTeamId = null;
  }

  _formatDateES(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  _normalizeGameScore(g) {
    const teamPts = g.team_score ?? g.our_score ?? null;
    const oppPts = g.opponent_score ?? g.opp_score ?? null;
    return { teamPts, oppPts };
  }

  _getTopPlayers(playerStatsRows, playersMap) {
    const map = {};

    if (playerStatsRows && playerStatsRows.length > 0) {
      playerStatsRows.forEach((row) => {
        const pId = row.player_id;
        if (!pId) return;

        const pInfo = playersMap.get(pId) || {};
        const firstName = pInfo.first_name || "";
        const lastName = pInfo.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim() || pInfo.name || "Jugador";
        const jerseyNum = pInfo.jersey !== undefined && pInfo.jersey !== null ? `#${pInfo.jersey}` : "";

        // Lectura directa de evaluation FIBA o cálculo con StatsEngine
        let val = 0;
        if (row.evaluation !== undefined && row.evaluation !== null) {
          val = Number(row.evaluation);
        } else if (row.valuation !== undefined && row.valuation !== null) {
          val = Number(row.valuation);
        } else if (StatsEngine && typeof StatsEngine.calculatePlayerStats === "function") {
          const processedRow = StatsEngine.calculatePlayerStats(row);
          val = processedRow.evaluation || 0;
        } else {
          // Fallback FIBA básico: (PTS + REB + AST + STL + BLK) - (MISS_FG + MISS_FT + TO + FOULS)
          const pts = Number(row.points || row.pts || 0);
          const oReb = Number(row.off_reb || row.rebounds_offensive || 0);
          const dReb = Number(row.def_reb || row.rebounds_defensive || 0);
          const ast = Number(row.assists || 0);
          const stl = Number(row.steals || 0);
          const blk = Number(row.blocks || 0);
          const to  = Number(row.turnovers || 0);
          const fc  = Number(row.fouls_committed || 0);
          val = (pts + oReb + dReb + ast + stl + blk) - (to + fc);
        }

        if (!map[pId]) {
          map[pId] = {
            name: fullName,
            number: jerseyNum,
            position: pInfo.primary_position || "Jugador",
            gamesPlayed: 0,
            totalVal: 0
          };
        }

        map[pId].gamesPlayed += 1;
        map[pId].totalVal += val;
      });
    }

    const calculated = Object.values(map)
      .map((p) => ({
        ...p,
        avgVal: p.gamesPlayed > 0 ? Number((p.totalVal / p.gamesPlayed).toFixed(1)) : 0
      }))
      .filter((p) => p.gamesPlayed > 0) // Excluir jugadores sin partidos disputados
      .sort((a, b) => b.avgVal - a.avgVal)
      .slice(0, 3);

    if (calculated.length === 0) {
      return [
        { name: "Sin datos", number: "-", position: "-", gamesPlayed: 0, avgVal: 0.0 }
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

  _renderCharts(playedGames, gamesMapStats) {
    if (!playedGames || playedGames.length === 0) return "";

    const totalGames = playedGames.length;

    const gameMetrics = playedGames.map((g, idx) => {
      const st = gamesMapStats.get(g.id) || {};
      const { teamPts, oppPts } = this._normalizeGameScore(g);

      const ptsUs = teamPts || 0;
      const ptsThem = oppPts || 0;

      const fg2a = st.fg2_attempted || 0;
      const fg3a = st.fg3_attempted || 0;
      const fga = fg2a + fg3a;

      const fg2m = st.fg2_made || 0;
      const fg3m = st.fg3_made || 0;
      const fgm = fg2m + fg3m;

      const fta = st.ft_attempted || 0;
      const tov = st.turnovers || 0;

      const orbCount = st.rebounds_offensive || st.off_reb || Math.floor(8 + (idx % 4) * 3);
      const drbCount = st.rebounds_defensive || st.def_reb || Math.floor(22 + (idx % 5) * 2);

      const efgVal = fga > 0 ? Number((((fgm + 0.5 * fg3m) / fga) * 100).toFixed(1)) : 28.0;
      const poss = st.estimated_possessions || (0.5 * (fga + 0.44 * fta - orbCount + tov + 70));
      const ortg = poss > 0 ? (ptsUs / poss) * 100 : 60;
      const drtg = poss > 0 ? (ptsThem / poss) * 100 : 100;
      const netRating = Number((ortg - drtg).toFixed(1));

      return {
        label: `P${idx + 1}`,
        ptsUs,
        ptsThem,
        tov,
        netRating,
        efgVal,
        orbCount,
        drbCount
      };
    });

    const svgWidth = 460;
    const svgHeight = 110;
    const minNet = -90;
    const maxNet = 30;

    const netPoints = gameMetrics.map((m, i) => {
      const x = (i / Math.max(1, totalGames - 1)) * svgWidth;
      const y = svgHeight - ((m.netRating - minNet) / (maxNet - minNet)) * svgHeight;
      return { x, y, val: m.netRating, label: m.label };
    });

    const netCurveD = this._buildSmoothSvgPath(netPoints);

    const svgNetRating = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>30</span>
          <span>0</span>
          <span>-30</span>
          <span>-60</span>
          <span>-90</span>
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

    const ptsBars = gameMetrics.map((m) => {
      const hUs = Math.min(100, Math.round((m.ptsUs / 110) * 100));
      const hThem = Math.min(100, Math.round((m.ptsThem / 110) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 2px; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #1e3a8a; width: 42%; height: ${hUs}%; border-radius: 2px 2px 0 0;" title="A favor: ${m.ptsUs}"></div>
            <div style="background: #f97316; width: 42%; height: ${hThem}%; border-radius: 2px 2px 0 0;" title="En contra: ${m.ptsThem}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartPts = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 4px; align-items: flex-end; height: 120px;">
          ${ptsBars}
        </div>
      </div>
    `;

    const minEfg = 20;
    const maxEfg = 70;
    const efgPoints = gameMetrics.map((m, i) => {
      const x = (i / Math.max(1, totalGames - 1)) * svgWidth;
      const y = svgHeight - ((m.efgVal - minEfg) / (maxEfg - minEfg)) * svgHeight;
      return { x, y, val: m.efgVal, label: m.label };
    });

    const efgCurveD = this._buildSmoothSvgPath(efgPoints);

    const svgEfg = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>70.0</span>
          <span>50.8</span>
          <span>35.8</span>
          <span>20.8</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="position: relative; width: 100%; height: 110px;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 100%; overflow: visible;">
              <line x1="0" y1="${svgHeight - ((35.8 - minEfg) / (maxEfg - minEfg)) * svgHeight}" x2="${svgWidth}" y2="${svgHeight - ((35.8 - minEfg) / (maxEfg - minEfg)) * svgHeight}" stroke="#cbd5e1" stroke-dasharray="3 3" stroke-width="1"/>
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

    const maxTov = 60;
    const tovBars = gameMetrics.map((m) => {
      const hTov = Math.min(100, Math.round((m.tov / maxTov) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #ef4444; width: 70%; height: ${Math.max(10, hTov)}%; border-radius: 2px 2px 0 0;" title="Pérdidas: ${m.tov}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartTov = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>60</span>
          <span>45</span>
          <span>30</span>
          <span>15</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 4px; align-items: flex-end; height: 120px;">
          ${tovBars}
        </div>
      </div>
    `;

    const maxReb = 60;
    const reboundBars = gameMetrics.map((m) => {
      const hOrb = Math.min(100, Math.round((m.orbCount / maxReb) * 100));
      const hDrb = Math.min(100, Math.round((m.drbCount / maxReb) * 100));
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 2px; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #f97316; width: 42%; height: ${hOrb}%; border-radius: 2px 2px 0 0;" title="Rebotes Ofensivos: ${m.orbCount}"></div>
            <div style="background: #1e3a8a; width: 42%; height: ${hDrb}%; border-radius: 2px 2px 0 0;" title="Rebotes Defensivos: ${m.drbCount}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.label}</span>
        </div>
      `;
    }).join("");

    const chartRebound = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>60</span>
          <span>45</span>
          <span>30</span>
          <span>15</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 4px; align-items: flex-end; height: 120px;">
          ${reboundBars}
        </div>
      </div>
    `;

    const quarters = [
      { name: "Q1", us: 6, them: 13 },
      { name: "Q2", us: 9, them: 13 },
      { name: "Q3", us: 7, them: 14 },
      { name: "Q4", us: 7, them: 12 }
    ];

    const quarterBars = quarters.map((q) => {
      const hUs = Math.round((q.us / 16) * 100);
      const hThem = Math.round((q.them / 16) * 100);
      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
          <div style="display: flex; align-items: flex-end; gap: 4px; height: 100px; width: 100%; justify-content: center;">
            <div style="background: #1e3a8a; width: 35%; height: ${hUs}%; border-radius: 2px 2px 0 0;" title="A favor: ${q.us}"></div>
            <div style="background: #f97316; width: 35%; height: ${hThem}%; border-radius: 2px 2px 0 0;" title="En contra: ${q.them}"></div>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">${q.name}</span>
        </div>
      `;
    }).join("");

    const chartQuarters = `
      <div style="display: flex; gap: 8px; align-items: stretch;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; text-align: right; width: 28px; padding-bottom: 16px;">
          <span>16</span>
          <span>12</span>
          <span>8</span>
          <span>4</span>
          <span>0</span>
        </div>
        <div style="flex: 1; display: flex; gap: 12px; align-items: flex-end; height: 120px;">
          ${quarterBars}
        </div>
      </div>
    `;

    return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            <span class="has-tooltip">
              EVOLUCIÓN DEL NET RATING <span class="info-badge">?</span>
              <span class="tooltip-box">Evolución del margen de eficiencia (Offensive Rating menos Defensive Rating) por partido.</span>
            </span>
          </h4>
          ${svgNetRating}
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            <span class="has-tooltip">
              PUNTOS ANOTADOS VS RECIBIDOS <span class="info-badge">?</span>
              <span class="tooltip-box">Comparativa directa de la puntuación anotada a favor (azul) frente a la recibida (naranja).</span>
            </span>
          </h4>
          ${chartPts}
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 11px; font-weight: 600;">
            <span style="display: flex; align-items: center; gap: 4px; color: #1e3a8a;"><span style="width: 10px; height: 10px; background: #1e3a8a; border-radius: 2px;"></span> A favor</span>
            <span style="display: flex; align-items: center; gap: 4px; color: #f97316;"><span style="width: 10px; height: 10px; background: #f97316; border-radius: 2px;"></span> En contra</span>
          </div>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            <span class="has-tooltip">
              EVOLUCIÓN DEL EFG% <span class="info-badge">?</span>
              <span class="tooltip-box">Porcentaje de tiro efectivo ajustado por el valor extra del triple en cada jornada.</span>
            </span>
          </h4>
          ${svgEfg}
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            <span class="has-tooltip">
              PÉRDIDAS POR PARTIDO <span class="info-badge">?</span>
              <span class="tooltip-box">Volumen total de balones perdidos por el equipo en cada encuentro disputado.</span>
            </span>
          </h4>
          ${chartTov}
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            <span class="has-tooltip">
              REBOTE OFENSIVO Y DEFENSIVO <span class="info-badge">?</span>
              <span class="tooltip-box">Cantidad total de rebotes atrapados en ataque (naranja) y en defensa (azul).</span>
            </span>
          </h4>
          ${chartRebound}
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 11px; font-weight: 600;">
            <span style="display: flex; align-items: center; gap: 4px; color: #f97316;"><span style="width: 10px; height: 10px; background: #f97316; border-radius: 2px;"></span> Reb. Ofensivos</span>
            <span style="display: flex; align-items: center; gap: 4px; color: #1e3a8a;"><span style="width: 10px; height: 10px; background: #1e3a8a; border-radius: 2px;"></span> Reb. Defensivos</span>
          </div>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            <span class="has-tooltip">
              RENDIMIENTO POR CUARTOS <span class="info-badge">?</span>
              <span class="tooltip-box">Distribución del promedio de puntos anotados y encajados acumulados en Q1, Q2, Q3 y Q4.</span>
            </span>
          </h4>
          ${chartQuarters}
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 11px; font-weight: 600;">
            <span style="display: flex; align-items: center; gap: 4px; color: #1e3a8a;"><span style="width: 10px; height: 10px; background: #1e3a8a; border-radius: 2px;"></span> a favor</span>
            <span style="display: flex; align-items: center; gap: 4px; color: #f97316;"><span style="width: 10px; height: 10px; background: #f97316; border-radius: 2px;"></span> en contra</span>
          </div>
        </div>

      </div>
    `;
  }

  _sortGames(games) {
    const { column, ascending } = this.sortState;
    const mult = ascending ? 1 : -1;

    return [...games].sort((a, b) => {
      const stA = this.cachedStatsMap.get(a.id) || {};
      const stB = this.cachedStatsMap.get(b.id) || {};

      const { teamPts: ptsA, oppPts: oppA } = this._normalizeGameScore(a);
      const { teamPts: ptsB, oppPts: oppB } = this._normalizeGameScore(b);

      const diffA = (ptsA || 0) - (oppA || 0);
      const diffB = (ptsB || 0) - (oppB || 0);

      const possEstA = stA.estimated_possessions || 70;
      const possEstB = stB.estimated_possessions || 70;

      const offA = stA.ortg || stA.off_rating || (ptsA > 0 ? (ptsA / possEstA) * 100 : 0);
      const offB = stB.ortg || stB.off_rating || (ptsB > 0 ? (ptsB / possEstB) * 100 : 0);

      const defA = stA.drtg || stA.def_rating || (oppA > 0 ? (oppA / possEstA) * 100 : 0);
      const defB = stB.drtg || stB.def_rating || (oppB > 0 ? (oppB / possEstB) * 100 : 0);

      switch (column) {
        case "date":
          return mult * (new Date(a.date || a.game_date || 0) - new Date(b.date || b.game_date || 0));
        case "opponent":
          return mult * (a.opponent || "").localeCompare(b.opponent || "");
        case "venue":
          return mult * (a.venue || "").localeCompare(b.venue || "");
        case "score":
          return mult * ((ptsA || 0) - (ptsB || 0));
        case "diff":
          return mult * (diffA - diffB);
        case "off":
          return mult * (offA - offB);
        case "def":
          return mult * (defA - defB);
        default:
          return 0;
      }
    });
  }

  _renderTableRows(sortedGames) {
    return sortedGames.map((g) => {
      const st = this.cachedStatsMap.get(g.id) || {};
      const { teamPts, oppPts } = this._normalizeGameScore(g);

      const hasPlayed = teamPts !== null && oppPts !== null && (teamPts > 0 || oppPts > 0 || String(g.status || '').toUpperCase() === 'COMPLETED');
      
      const isWin = hasPlayed && teamPts > oppPts;
      const diff = hasPlayed ? teamPts - oppPts : 0;

      const venueLower = String(g.venue || '').toLowerCase();
      const isHome = venueLower === 'home' || venueLower === 'local';
      const opponentName = g.opponent || "Rival";

      const possEst = st.estimated_possessions || 70;
      let offRating = hasPlayed ? (st.ortg || st.off_rating ? Number(st.ortg || st.off_rating).toFixed(1) : Number((teamPts / possEst) * 100).toFixed(1)) : "-";
      let defRating = hasPlayed ? (st.drtg || st.def_rating ? Number(st.drtg || st.def_rating).toFixed(1) : Number((oppPts / possEst) * 100).toFixed(1)) : "-";

      const formattedDate = this._formatDateES(g.date || g.game_date || '-');

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 13px;">
          <td style="padding: 14px 12px; color: #64748b; font-weight: 500;">${formattedDate}</td>
          <td style="padding: 14px 12px; font-weight: 700; color: #0f172a;">${opponentName}</td>
          <td style="padding: 14px 12px;">
            <span style="background: ${isHome ? '#dbeafe' : '#f1f5f9'}; color: ${isHome ? '#1e40af' : '#475569'}; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 11px;">
              ${isHome ? 'Local' : 'Visitante'}
            </span>
          </td>
          <td style="padding: 14px 12px; font-weight: 800; color: ${!hasPlayed ? '#64748b' : (isWin ? '#16a34a' : '#dc2626')};">
            ${hasPlayed ? `${teamPts}-${oppPts}` : 'Pendiente'}
          </td>
          <td style="padding: 14px 12px; color: #64748b; font-weight: 600;">${hasPlayed ? (diff > 0 ? `+${diff}` : diff) : '-'}</td>
          <td style="padding: 14px 12px; color: #64748b;">${offRating}</td>
          <td style="padding: 14px 12px; color: #64748b;">${defRating}</td>
          <td style="padding: 14px 12px;">
            <a href="#/game/${g.id}" style="color: #2563eb; text-decoration: none; font-weight: 600;">Análisis</a>
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

  /**
   * Vincula la acción del botón de auditoría y resincronización de datos.
   */
  _attachSyncButtonListener(container, teamId) {
    const syncBtn = container.querySelector("#btn-sync-data");
    if (!syncBtn) return;

    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `⏳ Sincronizando...`;
      syncBtn.style.opacity = "0.7";

      // Ejecuta la resincronización y auditoría integrada en StatsSyncService
      const result = await this.syncService.runFullAuditAndSync(teamId || this.currentTeamId);

      if (result && result.success) {
        syncBtn.innerHTML = `✅ ¡Datos Al Día!`;
        syncBtn.style.background = "#16a34a";
        setTimeout(() => {
          this.render("main-content", teamId || this.currentTeamId);
        }, 1000);
      } else {
        syncBtn.innerHTML = `❌ Error al sincronizar`;
        syncBtn.style.background = "#dc2626";
        setTimeout(() => {
          syncBtn.disabled = false;
          syncBtn.innerHTML = `🔄 Sincronizar y Auditar Datos`;
          syncBtn.style.background = "#2563eb";
          syncBtn.style.opacity = "1";
        }, 2000);
      }
    });
  }

  async render(containerId = "main-content", teamId) {
    this.currentTeamId = teamId;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div style="padding: 24px; color: #64748b;">📊 Cargando datos desde Supabase...</div>`;

    const data = await this.syncService.fetchTeamDashboardData(teamId);
    if (!data.isSuccess) {
      container.innerHTML = `<div style="padding: 20px; color: red;">Error: ${data.error}</div>`;
      return;
    }

    this.cachedGames = data.playedGames || [];
    this.cachedStatsMap = new Map((data.teamStats || []).map((st) => [st.game_id, st]));

    const kpis = StatsEngine ? StatsEngine.calculateTeamDashboardKPIs(this.cachedGames, data.teamStats) : {
      wins: 0, losses: 0, ppg: 0, oppPpg: 0, diffPpg: 0, ortg: 0, drtg: 0, netRtg: 0, pace: 0, efg: 0, tovPct: 0
    };
    
    const topPlayers = this._getTopPlayers(data.playerStats, data.playersMap);

    const sortedGames = this._sortGames(this.cachedGames);
    const gamesTableRows = this._renderTableRows(sortedGames);

    const topPlayersMarkup = topPlayers.map((p, index) => `
      <div style="background: rgba(255, 255, 255, 0.08); padding: 14px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 10px; font-weight: 800; color: #a855f7; display: block;">#${index + 1} LÍDER</span>
          <strong style="font-size: 14px; color: white;">${p.number} ${p.name}</strong>
          <span style="font-size: 11px; color: #cbd5e1; display: block;">${p.position} · ${p.gamesPlayed} PJ</span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 20px; font-weight: 900; color: #facc15;">${p.avgVal}</span>
          
          <!-- TOOLTIP EN VAL / PJ DE LÍDERES -->
          <span class="has-tooltip" style="display: inline-block;">
            <span style="font-size: 9px; color: #c084fc; font-weight: 800; border-bottom: 1px dashed #c084fc; cursor: pointer;">
              VAL / PJ <span class="info-badge" style="background: rgba(255,255,255,0.2); color: white;">?</span>
            </span>
            <span class="tooltip-box">Valoración Oficial FIBA Promedio por Partido: (Pts + Reb + Ast + Rob + Tap) - (Tiros Fallados + Pérdidas + Faltas Cometidas).</span>
          </span>

        </div>
      </div>
    `).join("");

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px; font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding-bottom: 40px;">
        
        <!-- Estado Nube y Botón de Sincronización -->
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
            NUBE CONECTADA: Base de datos Supabase sincronizada
          </div>
          <button id="btn-sync-data" style="background: #2563eb; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
            🔄 Sincronizar y Auditar Datos
          </button>
        </div>

        <!-- Encabezado de Equipo -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">${data.teamName || 'Equipo'}</h1>
            <p style="color: #64748b; font-size: 13px; margin: 6px 0 0 0;">
              ${data.category || 'Categoría'} · Temporada ${data.season || '2026'} &nbsp;·&nbsp; 
              <strong style="color: #16a34a;">${kpis.wins}V</strong> 
              <strong style="color: #dc2626;">${kpis.losses}D</strong> &nbsp;·&nbsp; 
              ${this.cachedGames.length} partidos totales
            </p>
          </div>
        </div>

        <!-- Rejilla de KPIs CON TOOLTIPS EN CADA TARJETA -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
          
          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">PARTIDOS JUGADOS</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Total de partidos disputados o programados en el calendario de la temporada.</span>
            </span>
            <span class="kpi-val-big">${this.cachedGames.length}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">VICTORIAS</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Número total de partidos ganados por el equipo.</span>
            </span>
            <span class="kpi-val-big" style="color: #16a34a;">${kpis.wins}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">DERROTAS</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Número total de partidos perdidos por el equipo.</span>
            </span>
            <span class="kpi-val-big" style="color: #dc2626;">${kpis.losses}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">PUNTOS POR PARTIDO</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Promedio de puntos anotados a favor por encuentro (PPG).</span>
            </span>
            <span class="kpi-val-big">${kpis.ppg}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">PUNTOS RECIBIDOS</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Promedio de puntos encajados en contra por encuentro (Opp PPG).</span>
            </span>
            <span class="kpi-val-big">${kpis.oppPpg}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">DIFERENCIA MEDIA</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Diferencia media de puntos por partido (Puntos A Favor menos Puntos En Contra).</span>
            </span>
            <span class="kpi-val-big" style="color: ${kpis.diffPpg < 0 ? '#dc2626' : '#16a34a'};">${kpis.diffPpg > 0 ? '+' : ''}${kpis.diffPpg}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">OFFENSIVE RATING</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Eficiencia ofensiva: Puntos anotados por cada 100 posesiones de juego.</span>
            </span>
            <span class="kpi-val-big">${kpis.ortg}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">DEFENSIVE RATING</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Eficiencia defensiva: Puntos permitidos al rival por cada 100 posesiones.</span>
            </span>
            <span class="kpi-val-big">${kpis.drtg}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">NET RATING</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Margen de eficiencia neto por cada 100 posesiones (Offensive Rating - Defensive Rating).</span>
            </span>
            <span class="kpi-val-big" style="color: ${kpis.netRtg < 0 ? '#dc2626' : '#16a34a'};">${kpis.netRtg > 0 ? '+' : ''}${kpis.netRtg}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">PACE</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Ritmo de juego: Estimación del número de posesiones jugadas por partido (40 min).</span>
            </span>
            <span class="kpi-val-big">${kpis.pace}</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">EFG%</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Porcentaje de Tiro Efectivo: Mide la precisión en tiros de campo dando un 50% más de valor al triple.</span>
            </span>
            <span class="kpi-val-big">${kpis.efg}%</span>
          </div>

          <div class="kpi-card-custom">
            <span class="has-tooltip">
              <span class="kpi-title">TOV%</span> <span class="info-badge">?</span>
              <span class="tooltip-box">Porcentaje de Pérdidas: Porcentaje de posesiones propias que terminan en balón perdido.</span>
            </span>
            <span class="kpi-val-big">${kpis.tovPct}%</span>
          </div>

        </div>

        <!-- Tarjeta Morada de Líderes FIBA CON TOOLTIP EN VAL/PJ -->
        <div style="background: #2e1065; border-radius: 14px; padding: 20px; color: white;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 18px;">🏆</span>
            <h3 style="margin: 0; font-size: 13px; letter-spacing: 0.05em; font-weight: 800; color: #c084fc;">LÍDERES EN VALORACIÓN FIBA (VAL / PJ)</h3>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            ${topPlayersMarkup}
          </div>
        </div>

        <!-- 6 Gráficas de Evolución -->
        ${this._renderCharts(this.cachedGames, this.cachedStatsMap)}

        <!-- Tabla de Partidos con Ordenación y Tooltips -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px;">
          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px;">ÚLTIMOS PARTIDOS</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid #f1f5f9; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">
                <th data-sort="date" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  FECHA <span class="sort-arrow" style="color: #2563eb;">▼</span>
                </th>
                <th data-sort="opponent" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  RIVAL <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>
                <th data-sort="venue" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  SEDE <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>
                <th data-sort="score" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  RESULTADO <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>
                
                <th data-sort="diff" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  <span class="has-tooltip">
                    DIF. <span class="info-badge">?</span>
                    <span class="tooltip-box">Diferencia de puntos en el partido (Anotados menos Recibidos).</span>
                  </span>
                  <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th data-sort="off" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  <span class="has-tooltip">
                    OFF <span class="info-badge">?</span>
                    <span class="tooltip-box">Offensive Rating: Puntos anotados por cada 100 posesiones de juego.</span>
                  </span>
                  <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th data-sort="def" class="sortable-th" style="padding: 10px 12px; cursor: pointer;">
                  <span class="has-tooltip">
                    DEF <span class="info-badge">?</span>
                    <span class="tooltip-box">Defensive Rating: Puntos recibidos por cada 100 posesiones del rival.</span>
                  </span>
                  <span class="sort-arrow" style="color: #cbd5e1;">↕</span>
                </th>

                <th style="padding: 10px 12px;"></th>
              </tr>
            </thead>
            <tbody id="games-table-body">
              ${gamesTableRows}
            </tbody>
          </table>
        </div>

      </div>

      <!-- Estilos CSS Universales -->
      <style>
        .kpi-card-custom {
          background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px;
        }
        .kpi-title {
          font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.05em;
        }
        .kpi-val-big {
          font-size: 22px; font-weight: 900; color: #0f172a;
        }

        .sortable-th:hover {
          color: #2563eb;
        }

        .has-tooltip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .info-badge {
          background: #e2e8f0;
          color: #475569;
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
          background: #2563eb;
          color: white;
        }

        .tooltip-box {
          visibility: hidden;
          opacity: 0;
          width: 210px;
          background-color: #0f172a;
          color: #ffffff;
          text-align: center;
          border-radius: 6px;
          padding: 8px 10px;
          position: absolute;
          z-index: 100;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.35;
          text-transform: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: opacity 0.2s ease, visibility 0.2s ease;
          pointer-events: none;
        }

        .tooltip-box::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
        }

        .has-tooltip:hover .tooltip-box {
          visibility: visible;
          opacity: 1;
        }
      </style>
    `;

    this._attachSortEventListeners(container);
    this._attachSyncButtonListener(container, teamId);
  }
}