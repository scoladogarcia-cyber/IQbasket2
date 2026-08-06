/**
 * @fileoverview Vista del Comparador de Jugadores (ComparatorView.js).
 * Permite seleccionar entre 2 y 4 jugadores para comparar sus estadísticas
 * convencionales, avanzadas, selector de métrica para evolución por partido y fortalezas relativas.
 * Gráfico 100% dinámico adaptado al número real de partidos disputados/registrados.
 * Totalmente integrado con DataStore y TranslationStore.
 */

import { StatsEngine } from "../engine/StatsEngine.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";

export class ComparatorView {
  constructor(authController) {
    this.auth = authController;
    this.selectedPlayerIds = []; // IDs de los jugadores seleccionados (máx 4)
    this.modePerGame = true; // true = Por partido, false = Por 40 min
    this.selectedMetric = "pts"; // 'pts', 'val', 'reb', 'ast', 'stl', 'blk'
    
    // Paleta de colores profesionales para los jugadores comparados
    this.playerColors = ["#1e3a8a", "#f97316", "#16a34a", "#9333ea"];
  }

  /**
   * Calcula promedios e indicadores para los jugadores seleccionados
   */
  _getPlayerStatsMap() {
    const map = new Map();

    this.selectedPlayerIds.forEach(pId => {
      const p = DataStore.getPlayerById(pId);
      if (!p) return;

      const pStats = DataStore.getPlayerGameStats(pId) || [];
      const gamesCount = pStats.length;

      let totMin = 0, totPts = 0, totOffReb = 0, totDefReb = 0, totAst = 0, totStl = 0, totBlk = 0;
      let totTov = 0, totFc = 0, totFr = 0, totPm = 0, totVal = 0, totGs = 0;
      let totFg2m = 0, totFg2a = 0, totFg3m = 0, totFg3a = 0, totFtm = 0, totFta = 0;

      pStats.forEach((st) => {
        const computed = StatsEngine.calculatePlayerStats(st);
        const min = Number(st.minutes || 0);
        const pts = computed.points || 0;

        totMin += min;
        totPts += pts;
        totOffReb += Number(st.off_reb || 0);
        totDefReb += Number(st.def_reb || 0);
        totAst += Number(st.assists || 0);
        totStl += Number(st.steals || 0);
        totBlk += Number(st.blocks || 0);
        totTov += Number(st.turnovers || 0);
        totFc += Number(st.fouls_committed || 0);
        totFr += Number(st.fouls_received || 0);
        totPm += Number(st.plus_minus || 0);
        totVal += computed.evaluation || 0;
        totGs += computed.gameScore || 0;

        totFg2m += Number(st.fg2_made || 0);
        totFg2a += Number(st.fg2_attempted || 0);
        totFg3m += Number(st.fg3_made || 0);
        totFg3a += Number(st.fg3_attempted || 0);
        totFtm  += Number(st.ft_made || 0);
        totFta  += Number(st.ft_attempted || 0);
      });

      const mult = this.modePerGame 
        ? (gamesCount > 0 ? 1 / gamesCount : 0)
        : (totMin > 0 ? 40 / totMin : 0);

      const totFgm = totFg2m + totFg3m;
      const totFga = totFg2a + totFg3a;
      const efg = totFga > 0 ? (((totFgm + 0.5 * totFg3m) / totFga) * 100).toFixed(1) : "0.0";
      const tsDenom = 2 * (totFga + 0.44 * totFta);
      const ts = tsDenom > 0 ? ((totPts / tsDenom) * 100).toFixed(1) : "0.0";

      map.set(pId, {
        player: p,
        gamesCount,
        totMin,
        avgMin: gamesCount > 0 ? (totMin / gamesCount).toFixed(1) : "0.0",
        pts: (totPts * mult).toFixed(1),
        offReb: (totOffReb * mult).toFixed(1),
        defReb: (totDefReb * mult).toFixed(1),
        reb: ((totOffReb + totDefReb) * mult).toFixed(1),
        ast: (totAst * mult).toFixed(1),
        stl: (totStl * mult).toFixed(1),
        blk: (totBlk * mult).toFixed(1),
        tov: (totTov * mult).toFixed(1),
        fc: (totFc * mult).toFixed(1),
        fr: (totFr * mult).toFixed(1),
        pm: (totPm * mult).toFixed(1),
        val: (totVal * mult).toFixed(1),
        gs: (totGs * mult).toFixed(1),
        efg,
        ts,
        usg: "18.5%"
      });
    });

    return map;
  }

  /**
   * Genera el Gráfico de Barras Horizontales para Métricas Convencionales
   */
  _renderHorizontalBarChart(statsMap) {
    const metrics = [
      { key: "pts", label: TranslationStore.t("points", "Puntos") },
      { key: "offReb", label: TranslationStore.t("reb_off_short", "Reb. of.") },
      { key: "defReb", label: TranslationStore.t("reb_def_short", "Reb. def.") },
      { key: "ast", label: TranslationStore.t("assists", "Asistencias") },
      { key: "stl", label: TranslationStore.t("steals", "Robos") },
      { key: "blk", label: TranslationStore.t("blocks", "Tapones") }
    ];

    let maxVal = 10;
    metrics.forEach(m => {
      this.selectedPlayerIds.forEach(pId => {
        const pStat = statsMap.get(pId);
        if (pStat) {
          const val = parseFloat(pStat[m.key] || 0);
          if (val > maxVal) maxVal = val;
        }
      });
    });

    const legendItemsMarkup = this.selectedPlayerIds.map((pId, idx) => {
      const pData = statsMap.get(pId);
      const name = pData ? `${pData.player.first_name || ''} ${pData.player.last_name || ''}`.trim() : 'Jugador';
      const color = this.playerColors[idx % this.playerColors.length];

      return `
        <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #334155; background: #f8fafc; padding: 4px 12px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <span style="width: 10px; height: 10px; background: ${color}; border-radius: 50%;"></span>
          ${name}
        </span>
      `;
    }).join("");

    const rowsMarkup = metrics.map(m => {
      const playerBarsMarkup = this.selectedPlayerIds.map((pId, idx) => {
        const pStat = statsMap.get(pId);
        const val = parseFloat(pStat ? pStat[m.key] : 0);
        const pct = Math.min(100, Math.max(3, (val / maxVal) * 100));
        const color = this.playerColors[idx % this.playerColors.length];

        return `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="height: 10px; background: ${color}; width: ${pct}%; border-radius: 4px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 1px 2px rgba(0,0,0,0.05);" title="${val}"></div>
            <span style="font-size: 10px; font-weight: 800; color: #475569; min-width: 20px;">${val}</span>
          </div>
        `;
      }).join("");

      return `
        <div style="display: grid; grid-template-columns: 100px 1fr; align-items: center; gap: 14px; font-size: 12px; font-weight: 700; color: #475569;">
          <div style="text-align: right; color: #64748b;">${m.label}</div>
          <div style="display: flex; flex-direction: column; gap: 6px; background: #f8fafc; padding: 6px 10px; border-radius: 8px; border: 1px solid #f1f5f9;">
            ${playerBarsMarkup}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <span>📊 ${TranslationStore.t("conventional_stats", "ESTADÍSTICAS CONVENCIONALES")} (${this.modePerGame ? 'POR PARTIDO' : 'POR 40 MIN'})</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          ${rowsMarkup}
        </div>

        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          ${legendItemsMarkup}
        </div>
      </div>
    `;
  }

  /**
   * Genera la Tabla Comparativa estilo Ficha
   */
  _renderComparisonTable(statsMap) {
    const playerHeadersMarkup = this.selectedPlayerIds.map((pId, idx) => {
      const pData = statsMap.get(pId);
      const name = pData ? `${pData.player.first_name || ''} ${pData.player.last_name || ''}`.trim().toUpperCase() : 'JUGADOR';
      const color = this.playerColors[idx % this.playerColors.length];

      return `
        <th style="padding: 12px; text-align: center; color: ${color}; font-weight: 900; font-size: 12px; letter-spacing: 0.02em;">
          ${name}
        </th>
      `;
    }).join("");

    const rows = [
      { label: TranslationStore.t("games_played", "Partidos"), key: "gamesCount" },
      { label: TranslationStore.t("minutes", "Minutos"), key: "avgMin" },
      { label: TranslationStore.t("points", "Puntos"), key: "pts" },
      { label: TranslationStore.t("rebounds", "Rebotes"), key: "reb" },
      { label: TranslationStore.t("assists", "Asistencias"), key: "ast" },
      { label: TranslationStore.t("steals", "Robos"), key: "stl" },
      { label: TranslationStore.t("blocks", "Tapones"), key: "blk" },
      { label: TranslationStore.t("turnovers", "Pérdidas"), key: "tov" },
      { label: TranslationStore.t("fouls_committed", "Faltas com."), key: "fc" },
      { label: TranslationStore.t("fouls_received", "Faltas rec."), key: "fr" },
      { label: "Plus/Minus", key: "pm" },
      { label: TranslationStore.t("valuation", "Valoración (FIBA)"), key: "val" },
      { label: "Game Score", key: "gs" },
      { label: "eFG%", key: "efg", isPct: true },
      { label: "TS%", key: "ts", isPct: true },
      { label: "USG%", key: "usg" },
      { label: TranslationStore.t("reliability", "Fiabilidad"), isBadge: true }
    ];

    const rowsMarkup = rows.map((r, rIdx) => {
      const isEven = rIdx % 2 === 0;
      const valsMarkup = this.selectedPlayerIds.map(pId => {
        const pData = statsMap.get(pId);
        if (!pData) return `<td style="padding: 10px; text-align: center;">-</td>`;

        if (r.isBadge) {
          return `
            <td style="padding: 10px; text-align: center;">
              <span style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 3px 10px; border-radius: 12px; font-weight: 800; font-size: 11px;">
                ✔ Muestra suficiente
              </span>
            </td>
          `;
        }

        const rawVal = pData[r.key] ?? '-';
        const displayVal = r.isPct ? `${rawVal}%` : rawVal;

        return `
          <td style="padding: 10px; text-align: center; font-weight: 800; color: #0f172a;">
            ${displayVal}
          </td>
        `;
      }).join("");

      return `
        <tr style="background: ${isEven ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
          <td style="padding: 10px 14px; font-weight: 700; color: #64748b;">${r.label}</td>
          ${valsMarkup}
        </tr>
      `;
    }).join("");

    return `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
          📋 TABLA COMPARATIVA
        </div>

        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f1f5f9; font-size: 11px; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px 14px; color: #475569; font-weight: 800; text-transform: uppercase; width: 25%;">MÉTRICA</th>
                ${playerHeadersMarkup}
              </tr>
            </thead>
            <tbody>
              ${rowsMarkup}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Genera el Gráfico SVG de Evolución por Partido TOTALMENTE DINÁMICO (Sin valores fijos)
   */
  _renderEvolutionChartSVG(statsMap) {
    const width = 800;
    const height = 180;
    const paddingLeft = 35;
    const paddingRight = 10;
    const paddingBottom = 25;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingBottom;

    // 1. Obtener los partidos reales de la temporada ordenados por fecha
    const rawGames = DataStore.getGames() || [];
    const allGames = [...rawGames].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    
    // NÚMERO TOTAL REAL DE PARTIDOS (Dinámico)
    const totalGames = Math.max(1, allGames.length);

    // 2. Título de la métrica seleccionada
    const metricLabels = {
      pts: TranslationStore.t("points", "PUNTOS"),
      val: TranslationStore.t("valuation", "VALORACIÓN FIBA"),
      reb: TranslationStore.t("rebounds", "REBOTES"),
      ast: TranslationStore.t("assists", "ASISTENCIAS"),
      stl: TranslationStore.t("steals", "ROBOS"),
      blk: TranslationStore.t("blocks", "TAPONES")
    };
    const metricTitle = metricLabels[this.selectedMetric] || TranslationStore.t("points", "PUNTOS");

    // 3. Calcular Mínimo y Máximo dinámicos para escalar el Eje Y
    let minVal = 0;
    let maxVal = 10;

    this.selectedPlayerIds.forEach(pId => {
      const playerStats = DataStore.getPlayerGameStats(pId) || [];
      playerStats.forEach(st => {
        const computed = StatsEngine.calculatePlayerStats(st);
        let val = 0;
        switch (this.selectedMetric) {
          case "val": val = computed.evaluation || 0; break;
          case "reb": val = computed.trb || 0; break;
          case "ast": val = Number(st.assists || 0); break;
          case "stl": val = Number(st.steals || 0); break;
          case "blk": val = Number(st.blocks || 0); break;
          case "pts":
          default: val = computed.points || 0; break;
        }
        if (val > maxVal) maxVal = val;
        if (val < minVal) minVal = val;
      });
    });

    maxVal = Math.ceil(maxVal / 4) * 4 || 8;
    const rangeY = (maxVal - minVal) || 1;

    // 4. Dibujar curvas para cada jugador seleccionado ajustando X exactamente a (0 ... totalGames - 1)
    const linesMarkup = this.selectedPlayerIds.map((pId, idx) => {
      const pData = statsMap.get(pId);
      if (!pData) return "";

      const color = this.playerColors[idx % this.playerColors.length];
      const playerStats = DataStore.getPlayerGameStats(pId) || [];
      const statsByGameId = new Map(playerStats.map(s => [String(s.game_id), s]));

      const points = allGames.map((g, i) => {
        const st = statsByGameId.get(String(g.id));
        let val = 0;

        if (st) {
          const computed = StatsEngine.calculatePlayerStats(st);
          switch (this.selectedMetric) {
            case "val": val = computed.evaluation || 0; break;
            case "reb": val = computed.trb || 0; break;
            case "ast": val = Number(st.assists || 0); break;
            case "stl": val = Number(st.steals || 0); break;
            case "blk": val = Number(st.blocks || 0); break;
            case "pts":
            default: val = computed.points || 0; break;
          }
        }

        // Posición X dinámicamente dividida entre el número de partidos
        const divisorX = totalGames > 1 ? (totalGames - 1) : 1;
        const x = paddingLeft + (i / divisorX) * chartW;
        const y = chartH - ((val - minVal) / rangeY) * chartH;

        return { x, y, val, label: `P${i + 1}`, hasPlayed: !!st };
      });

      if (points.length === 0) return "";

      let pathD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const cx = (p1.x + p2.x) / 2;
        pathD += ` C ${cx.toFixed(1)},${p1.y.toFixed(1)} ${cx.toFixed(1)},${p2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
      }

      return `
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
        ${points.map(p => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5">
            <title>${p.label}: ${p.val} ${!p.hasPlayed ? '(Sin registro)' : ''}</title>
          </circle>
        `).join("")}
      `;
    }).join("");

    // Lines horizontales del Eje Y
    const ySteps = 4;
    let gridLinesMarkup = "";
    let yLabelsMarkup = "";

    for (let i = 0; i <= ySteps; i++) {
      const stepVal = minVal + (rangeY / ySteps) * i;
      const yPos = chartH - (i / ySteps) * chartH;
      
      gridLinesMarkup += `
        <line x1="${paddingLeft}" y1="${yPos.toFixed(1)}" x2="${width - paddingRight}" y2="${yPos.toFixed(1)}" stroke="${stepVal === 0 ? '#cbd5e1' : '#f1f5f9'}" stroke-dasharray="${stepVal === 0 ? 'none' : '3 3'}" stroke-width="${stepVal === 0 ? '1.5' : '1'}" />
      `;

      yLabelsMarkup += `
        <text x="${paddingLeft - 8}" y="${yPos.toFixed(1)}" font-size="10" font-weight="700" fill="#94a3b8" text-anchor="end" dominant-baseline="central">${Math.round(stepVal)}</text>
      `;
    }

    // Líneas verticales dinámicas por cada partido real
    const xGridLines = allGames.map((_, i) => {
      const divisorX = totalGames > 1 ? (totalGames - 1) : 1;
      const xPos = paddingLeft + (i / divisorX) * chartW;
      return `<line x1="${xPos.toFixed(1)}" y1="0" x2="${xPos.toFixed(1)}" y2="${chartH}" stroke="#f8fafc" stroke-width="1" />`;
    }).join("");

    // Etiquetas dinámicas P1... Pn
    const labelsXMarkup = allGames.map((_, i) => {
      return `<span style="text-align: center; font-size: 9px; font-weight: 700; color: #64748b;">P${i + 1}</span>`;
    }).join("");

    const legendMarkup = this.selectedPlayerIds.map((pId, idx) => {
      const pData = statsMap.get(pId);
      const name = pData ? `${pData.player.first_name || ''} ${pData.player.last_name || ''}`.trim() : 'Jugador';
      const color = this.playerColors[idx % this.playerColors.length];

      return `
        <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #334155; background: #f8fafc; padding: 4px 12px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <span style="width: 10px; height: 10px; background: ${color}; border-radius: 50%;"></span>
          ${name}
        </span>
      `;
    }).join("");

    return `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
            📈 EVOLUCIÓN DE ${metricTitle} POR PARTIDO (P1 - P${totalGames})
          </div>

          <!-- Selector de Métrica de Evolución -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 11px; font-weight: 700; color: #64748b;">Métrica:</label>
            <select id="select-evolution-metric" style="padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; background: white; color: #0f172a; outline: none; cursor: pointer;">
              <option value="pts" ${this.selectedMetric === 'pts' ? 'selected' : ''}>Puntos</option>
              <option value="val" ${this.selectedMetric === 'val' ? 'selected' : ''}>Valoración (FIBA)</option>
              <option value="reb" ${this.selectedMetric === 'reb' ? 'selected' : ''}>Rebotes</option>
              <option value="ast" ${this.selectedMetric === 'ast' ? 'selected' : ''}>Asistencias</option>
              <option value="stl" ${this.selectedMetric === 'stl' ? 'selected' : ''}>Robos</option>
              <option value="blk" ${this.selectedMetric === 'blk' ? 'selected' : ''}>Tapones</option>
            </select>
          </div>
        </div>

        <div style="position: relative; width: 100%; height: 190px; margin-bottom: 8px;">
          <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 170px; overflow: visible;">
            ${gridLinesMarkup}
            ${xGridLines}
            ${yLabelsMarkup}
            ${linesMarkup}
          </svg>
          <div style="display: flex; justify-content: space-between; padding-left: ${paddingLeft}px; padding-right: ${paddingRight}px; margin-top: 4px;">
            ${labelsXMarkup}
          </div>
        </div>

        <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          ${legendMarkup}
        </div>
      </div>
    `;
  }

  /**
   * Genera el módulo de Fortalezas Relativas (Destacados)
   */
  _renderRelativeStrengths(statsMap) {
    const cardsMarkup = this.selectedPlayerIds.map(pId => {
      const pData = statsMap.get(pId);
      if (!pData) return "";

      const name = `${pData.player.first_name || ''} ${pData.player.last_name || ''}`.trim();
      const bestAttr = parseFloat(pData.val) > 5 ? TranslationStore.t("valuation", "Valoración") : (parseFloat(pData.pts) > 4 ? TranslationStore.t("points", "Puntos") : TranslationStore.t("reb_def", "Reb. def."));
      const worstAttr = TranslationStore.t("blocks", "Tapones");

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
          <span style="font-weight: 800; font-size: 13px; color: #0f172a;">${name}</span>
          <div style="font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
            <span>Mejor en</span> 
            <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px;">${bestAttr}</span>
            <span>· Peor en</span> 
            <span style="background: #fef2f2; color: #dc2626; padding: 2px 8px; border-radius: 6px;">${worstAttr}</span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
          ⚡ FORTALEZAS RELATIVAS
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${cardsMarkup}
        </div>
      </div>
    `;
  }

  async render(containerId = "dashboard-content-area") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allPlayers = DataStore.getPlayers() || [];

    // Marcado Chips de selección de jugadores
    const chipsMarkup = allPlayers.map(p => {
      const isSelected = this.selectedPlayerIds.includes(String(p.id));
      const idx = this.selectedPlayerIds.indexOf(String(p.id));
      
      let chipStyle = "background: white; color: #334155; border: 1px solid #cbd5e1;";
      if (isSelected) {
        const color = this.playerColors[idx % this.playerColors.length];
        chipStyle = `background: ${color}; color: white; border: 1px solid ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
      }

      return `
        <button type="button" 
                class="btn-select-player-chip" 
                data-id="${p.id}" 
                style="padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; ${chipStyle}">
          #${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}
          ${isSelected ? '✕' : ''}
        </button>
      `;
    }).join("");

    const hasEnoughPlayers = this.selectedPlayerIds.length >= 2;
    const statsMap = hasEnoughPlayers ? this._getPlayerStatsMap() : new Map();

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; padding-bottom: 40px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">
            🔀 ${TranslationStore.t("comparator", "Comparador")}
          </h1>

          ${hasEnoughPlayers ? `
            <!-- TOGGLE POR PARTIDO / POR 40 MIN -->
            <div style="background: #e2e8f0; padding: 4px; border-radius: 10px; display: flex; gap: 4px;">
              <button id="btn-mode-pergame" style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; background: ${this.modePerGame ? 'white' : 'transparent'}; color: ${this.modePerGame ? '#0f172a' : '#64748b'}; box-shadow: ${this.modePerGame ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'};">
                ${TranslationStore.t("per_game", "Por partido")}
              </button>
              <button id="btn-mode-per40" style="padding: 6px 14px; border-radius: 8px; border: none; font-size: 12px; font-weight: 800; cursor: pointer; background: ${!this.modePerGame ? 'white' : 'transparent'}; color: ${!this.modePerGame ? '#0f172a' : '#64748b'}; box-shadow: ${!this.modePerGame ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'};">
                ${TranslationStore.t("per_40_min", "Por 40 min")}
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Selector de Jugadores Superior -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            ${TranslationStore.t("select_players", "SELECCIONA JUGADORES")} (${this.selectedPlayerIds.length}/4)
            <span style="font-size: 12px; color: #94a3b8; cursor: pointer;" title="Elige de 2 a 4 jugadores para iniciar el análisis comparativo">❓</span>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${chipsMarkup}
          </div>
        </div>

        <!-- CONTENIDO PRINCIPAL: ESTADO VACÍO VS COMPARATIVA -->
        ${!hasEnoughPlayers ? `
          <!-- ESTADO VACÍO -->
          <div style="padding: 60px 20px; text-align: center; background: white; border-radius: 14px; border: 1px dashed #cbd5e1; margin-top: 20px;">
            <div style="width: 56px; height: 56px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 26px; color: #94a3b8;">
              🔀
            </div>
            <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #334155;">
              ${TranslationStore.t("select_at_least_2", "Selecciona al menos 2 jugadores")}
            </h3>
            <p style="margin: 0; font-size: 13px; color: #64748b;">
              ${TranslationStore.t("select_players_desc", "Elige jugadores para ver la comparación gráfica y estadística.")}
            </p>
          </div>
        ` : `
          <!-- COMPARATIVA ACTIVA -->
          <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- 1. Gráfico de Barras Convencionales -->
            ${this._renderHorizontalBarChart(statsMap)}

            <!-- 2. Tabla Comparativa -->
            ${this._renderComparisonTable(statsMap)}

            <!-- 3. Evolución por Partido Dinámica (Eje Y, Cuadrícula y Selector de Métrica) -->
            ${this._renderEvolutionChartSVG(statsMap)}

            <!-- 4. Fortalezas Relativas -->
            ${this._renderRelativeStrengths(statsMap)}

          </div>
        `}

      </div>
    `;

    // Eventos Chips de Selección
    container.querySelectorAll(".btn-select-player-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = String(btn.getAttribute("data-id"));
        if (this.selectedPlayerIds.includes(id)) {
          this.selectedPlayerIds = this.selectedPlayerIds.filter(pId => pId !== id);
        } else {
          if (this.selectedPlayerIds.length >= 4) {
            alert(TranslationStore.t("max_players_comparator", "Puedes seleccionar como máximo 4 jugadores simultáneamente."));
            return;
          }
          this.selectedPlayerIds.push(id);
        }
        this.render(containerId);
      });
    });

    // Eventos Toggles Modo (Por partido / Por 40 min)
    container.querySelector("#btn-mode-pergame")?.addEventListener("click", () => {
      this.modePerGame = true;
      this.render(containerId);
    });

    container.querySelector("#btn-mode-per40")?.addEventListener("click", () => {
      this.modePerGame = false;
      this.render(containerId);
    });

    // Evento Selector de Métrica de Evolución
    container.querySelector("#select-evolution-metric")?.addEventListener("change", (e) => {
      this.selectedMetric = e.target.value;
      this.render(containerId);
    });
  }
}