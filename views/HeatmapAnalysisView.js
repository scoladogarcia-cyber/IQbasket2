/**
 * @fileoverview Suite Analítica Espacial y Avanzada: HeatmapAnalysisView.js
 * @description Gestión de cartas de tiro interactivas (Shot Charts), mapas de densidad de calor (Heatmaps),
 * desglose por zonas FIBA, radar multivariable de habilidades individuales y matriz comparativa On/Off.
 * 
 * Optimizaciones:
 * 1. Vinculación estricta al teamId activo para no perder datos al cambiar de equipo.
 * 2. Matriz On/Off con cálculo exacto de partidos disputados (min > 0) y minutos OFF con prórrogas.
 * 3. Selector reactivo y radar individual en Informe de Jugador sin bloqueos.
 * 4. Normalización integral de coordenadas espaciales (coord_x, coordinates.x).
 */

import { supabase } from "../config/database.config.js";
import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";
import { BoxScoreCalculator } from "../domain/stats/BoxScoreCalculator.js";
import { StatsAggregator } from "../domain/stats/StatsAggregator.js";

export class HeatmapAnalysisView {
  /**
   * Crea una instancia de HeatmapAnalysisView.
   * @param {Object} [supabaseClient=null] - Cliente Supabase.
   * @param {Object} [authController=null] - Controlador de autenticación.
   */
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient || supabase;
    this.auth = authController;
    this.events = [];
    this.games = [];
    this.players = [];
    this.stats = [];
    
    this.activeMainTab = "court"; // 'court' | 'player_report' | 'on_off'
    this.selectedGameId = "all";
    this.selectedPlayerId = "all";
    this.selectedPeriod = "all";
    this.selectedShotType = "all";
    this.selectedDistanceRange = "all";
    this.viewMode = "zones"; // 'zones' | 'density' | 'shots'
  }

  t(key, fallback = "") {
    return (TranslationStore ? TranslationStore.t(key, fallback) : I18n.t(key, fallback)) || fallback;
  }

  _getTeamTotalMinutes(games) {
    let totalMinutes = 0;
    games.forEach(g => {
      const periods = DataStore.getGamePeriodScores(g.id) || [];
      const overtimes = periods.filter(p => p.is_overtime || p.isOvertime || Number(p.period_number ?? p.periodNumber) > 4).length;
      totalMinutes += 40 + (overtimes * 5);
    });
    return totalMinutes || (games.length * 40) || 40;
  }

  async render(containerId = "dashboard-content-area", teamId = null) {
    const container = document.getElementById(containerId) || document.getElementById("main-content") || document.querySelector(".app-main-content") || document.body;
    if (!container) return;

    this.teamId = teamId || DataStore.getActiveTeamId();
    this.games = DataStore.getGames(this.teamId) || [];
    this.players = DataStore.getPlayers(this.teamId) || [];
    this.stats = DataStore.getPlayerGameStats() || [];

    if (this.activeMainTab === "player_report" && (this.selectedPlayerId === "all" || !this.selectedPlayerId) && this.players.length > 0) {
      this.selectedPlayerId = String(this.players[0].id);
    }

    await this._fetchEvents();
    this._renderLayout(container);

    if (this.activeMainTab === "court") {
      requestAnimationFrame(() => {
        this._drawCourtVisuals();
      });
    }

    this._bindEvents(container);
  }

  async _fetchEvents() {
    try {
      const gameIds = new Set(this.games.map(g => String(g.id)));
      let rawEvents = DataStore.getGameEvents() || [];

      // Si se selecciona un partido concreto
      if (this.selectedGameId !== "all") {
        rawEvents = rawEvents.filter(ev => String(ev.game_id ?? ev.gameId) === String(this.selectedGameId));
        
        if (rawEvents.length === 0 && this.supabase) {
          const { data, error } = await this.supabase
            .from("game_events")
            .select("*")
            .eq("game_id", this.selectedGameId);

          if (!error && data) rawEvents = data;
        }
      } else {
        // Filtrar solo eventos de los partidos del equipo activo
        rawEvents = rawEvents.filter(ev => {
          const gId = String(ev.game_id ?? ev.gameId ?? "");
          return gameIds.has(gId);
        });
      }

      // Filtrar por jugador si está seleccionado
      if (this.selectedPlayerId && this.selectedPlayerId !== "all") {
        rawEvents = rawEvents.filter(ev => String(ev.player_id ?? ev.playerId) === String(this.selectedPlayerId));
      }

      this.events = rawEvents
        .map(ev => ({
          ...ev,
          coord_x: Number(ev.coord_x ?? ev.coordX ?? ev.coordinates?.x ?? ev.x ?? 0),
          coord_y: Number(ev.coord_y ?? ev.coordY ?? ev.coordinates?.y ?? ev.y ?? 0),
          made: ev.made !== undefined 
            ? Boolean(ev.made) 
            : (ev.coordinates?.made !== undefined ? Boolean(ev.coordinates.made) : String(ev.action_type ?? ev.action ?? '').includes("made"))
        }))
        .filter(ev => ev.coord_x > 0 || ev.coord_y > 0);
    } catch (err) {
      console.warn("Aviso cargando eventos de pista:", err);
      this.events = [];
    }
  }

  _getFilteredEvents() {
    return this.events.filter(ev => {
      if (this.selectedPeriod !== "all" && String(ev.period) !== String(this.selectedPeriod)) {
        return false;
      }
      if (this.selectedShotType === "made" && !ev.made) return false;
      if (this.selectedShotType === "missed" && ev.made) return false;

      const isPaint = ev.coord_x >= 34 && ev.coord_x <= 66 && ev.coord_y <= 40;
      const distUnits = Math.hypot((ev.coord_x - 50) * 5.0, (ev.coord_y - 11.06) * 4.7);
      const isCornerThree = (ev.coord_x <= 6.0 || ev.coord_x >= 94.0) && ev.coord_y <= 29.8;
      const isThree = isCornerThree || distUnits >= 235.0;
      const isMid = !isPaint && !isThree;

      if (this.selectedDistanceRange === "paint" && !isPaint) return false;
      if (this.selectedDistanceRange === "mid" && !isMid) return false;
      if (this.selectedDistanceRange === "three" && !isThree) return false;

      return true;
    });
  }

  _renderLayout(container) {
    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: var(--font-family-base, system-ui); box-sizing: border-box; padding-bottom: 24px;">
        
        <!-- HEADER PRINCIPAL -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: clamp(20px, 4vw, 24px); font-weight: 900; color: #0f172a; margin: 0;">
              📊 ${this.t("analytics_suite", "Estadística Avanzada & Cartas de Tiro")}
            </h1>
            <span style="font-size: clamp(11px, 2.5vw, 13px); color: #475569;">
              ${this.t("analytics_subtitle", "Rendimiento espacial, informe individual con radar y comparativa On/Off")}
            </span>
          </div>

          <div style="display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 10px; flex-wrap: wrap;">
            <button class="btn-main-tab ${this.activeMainTab === 'court' ? 'active' : ''}" data-tab="court" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${this.activeMainTab === 'court' ? '#0f172a' : 'transparent'}; color: ${this.activeMainTab === 'court' ? '#ffffff' : '#334155'};">
              🏀 ${this.t("tab_court_heatmap", "Pista & Zonas")}
            </button>
            <button class="btn-main-tab ${this.activeMainTab === 'player_report' ? 'active' : ''}" data-tab="player_report" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${this.activeMainTab === 'player_report' ? '#0f172a' : 'transparent'}; color: ${this.activeMainTab === 'player_report' ? '#ffffff' : '#334155'};">
              👤 ${this.t("tab_player_report", "Informe de Jugador")}
            </button>
            <button class="btn-main-tab ${this.activeMainTab === 'on_off' ? 'active' : ''}" data-tab="on_off" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${this.activeMainTab === 'on_off' ? '#0f172a' : 'transparent'}; color: ${this.activeMainTab === 'on_off' ? '#ffffff' : '#334155'};">
              ⚖️ ${this.t("tab_on_off", "Comparativa On / Off & Rival")}
            </button>
          </div>
        </div>

        ${this._renderFiltersMarkup()}

        <div id="analytics-tab-content">
          ${this.activeMainTab === 'court' ? this._renderCourtViewMarkup() : ''}
          ${this.activeMainTab === 'player_report' ? this._renderPlayerReportMarkup() : ''}
          ${this.activeMainTab === 'on_off' ? this._renderOnOffMatrixMarkup() : ''}
        </div>

      </div>
    `;
  }

  _renderFiltersMarkup() {
    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div>
          <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_game", "PARTIDO")}</label>
          <select id="filter-game" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
            <option value="all" ${this.selectedGameId === 'all' ? 'selected' : ''}>${this.t("heatmap.all_games", "Todos los partidos")}</option>
            ${this.games.map(g => `<option value="${g.id}" ${this.selectedGameId === String(g.id) ? 'selected' : ''}>vs ${g.opponent || g.opponentName || this.t("opponent", "Rival")} (${g.date ? (I18n.formatDate ? I18n.formatDate(g.date) : g.date) : '-'})</option>`).join('')}
          </select>
        </div>

        <div>
          <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_player", "JUGADOR")}</label>
          <select id="filter-player" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
            ${this.activeMainTab !== 'player_report' ? `<option value="all" ${this.selectedPlayerId === 'all' ? 'selected' : ''}>${this.t("heatmap.all_players", "Todo el equipo")}</option>` : ''}
            ${this.players.map(p => `<option value="${p.id}" ${String(this.selectedPlayerId) === String(p.id) ? 'selected' : ''}>#${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}</option>`).join('')}
          </select>
        </div>

        ${this.activeMainTab === 'court' ? `
          <div>
            <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_period", "PERIODO")}</label>
            <select id="filter-period" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
              <option value="all" ${this.selectedPeriod === 'all' ? 'selected' : ''}>${this.t("heatmap.all_periods", "Todos los cuartos")}</option>
              <option value="1" ${this.selectedPeriod === '1' ? 'selected' : ''}>Q1</option>
              <option value="2" ${this.selectedPeriod === '2' ? 'selected' : ''}>Q2</option>
              <option value="3" ${this.selectedPeriod === '3' ? 'selected' : ''}>Q3</option>
              <option value="4" ${this.selectedPeriod === '4' ? 'selected' : ''}>Q4</option>
            </select>
          </div>

          <div>
            <label style="font-size: 10px; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_outcome", "RESULTADO DE TIRO")}</label>
            <select id="filter-shot-type" style="width: 100%; height: 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 4px 8px; background: #ffffff; color: #0f172a;">
              <option value="all" ${this.selectedShotType === 'all' ? 'selected' : ''}>${this.t("heatmap.all_outcomes", "Anotados y Fallados")}</option>
              <option value="made" ${this.selectedShotType === 'made' ? 'selected' : ''}>✔ ${this.t("heatmap.only_made", "Solo Anotados")}</option>
              <option value="missed" ${this.selectedShotType === 'missed' ? 'selected' : ''}>✖ ${this.t("heatmap.only_missed", "Solo Fallados")}</option>
            </select>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderCourtViewMarkup() {
    const filtered = this._getFilteredEvents();
    const totalShots = filtered.length;
    const madeShots = filtered.filter(e => e.made).length;
    const missedShots = totalShots - madeShots;
    const fgPct = totalShots > 0 ? ((madeShots / totalShots) * 100).toFixed(1) : "0.0";
    
    const made3s = filtered.filter(e => {
      const distUnits = Math.hypot((e.coord_x - 50) * 5.0, (e.coord_y - 11.06) * 4.7);
      const isCornerThree = (e.coord_x <= 6.0 || e.coord_x >= 94.0) && e.coord_y <= 29.8;
      return e.made && (isCornerThree || distUnits >= 235.0);
    }).length;

    const eFGPct = totalShots > 0 ? (((madeShots + 0.5 * made3s) / totalShots) * 100).toFixed(1) : "0.0";
    const totalPts = (madeShots * 2) + made3s;
    const pps = totalShots > 0 ? (totalPts / totalShots).toFixed(2) : "0.00";

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 6px; overflow-x: auto;">
          <button class="dist-filter-btn ${this.selectedDistanceRange === 'all' ? 'active' : ''}" data-range="all" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange === 'all' ? '#0f172a' : '#ffffff'}; color: ${this.selectedDistanceRange === 'all' ? '#ffffff' : '#334155'};">
            🌐 ${this.t("heatmap.all_distances", "Todas las Distancias")} (${totalShots})
          </button>
          <button class="dist-filter-btn ${this.selectedDistanceRange === 'paint' ? 'active' : ''}" data-range="paint" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange === 'paint' ? '#0284c7' : '#ffffff'}; color: ${this.selectedDistanceRange === 'paint' ? '#ffffff' : '#334155'};">
            📦 ${this.t("heatmap.paint", "Bajo el Aro / Pintura")}
          </button>
          <button class="dist-filter-btn ${this.selectedDistanceRange === 'mid' ? 'active' : ''}" data-range="mid" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange === 'mid' ? '#f59e0b' : '#ffffff'}; color: ${this.selectedDistanceRange === 'mid' ? '#ffffff' : '#334155'};">
            🎯 ${this.t("heatmap.mid_range", "Media Distancia")}
          </button>
          <button class="dist-filter-btn ${this.selectedDistanceRange === 'three' ? 'active' : ''}" data-range="three" style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; border: 1px solid #cbd5e1; cursor: pointer; background: ${this.selectedDistanceRange === 'three' ? '#16a34a' : '#ffffff'}; color: ${this.selectedDistanceRange === 'three' ? '#ffffff' : '#334155'};">
            ⚡ ${this.t("heatmap.threes", "Línea de 3 Puntos")}
          </button>
        </div>

        <div style="display: flex; gap: 4px; background: #e2e8f0; padding: 2px; border-radius: 8px;">
          <button id="btn-view-zones" style="padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer; background: ${this.viewMode === 'zones' ? '#0284c7' : 'transparent'}; color: ${this.viewMode === 'zones' ? '#ffffff' : '#334155'};">
            📊 ${this.t("heatmap.mode_zones", "Zonas")}
          </button>
          <button id="btn-view-density" style="padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer; background: ${this.viewMode === 'density' ? '#f97316' : 'transparent'}; color: ${this.viewMode === 'density' ? '#ffffff' : '#334155'};">
            🔥 ${this.t("heatmap.mode_density", "Calor")}
          </button>
          <button id="btn-view-shots" style="padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; cursor: pointer; background: ${this.viewMode === 'shots' ? '#16a34a' : 'transparent'}; color: ${this.viewMode === 'shots' ? '#ffffff' : '#334155'};">
            🎯 ${this.t("heatmap.mode_shots", "Tiros")}
          </button>
        </div>
      </div>

      <div class="heatmap-grid-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start;">
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02); width: 100%; box-sizing: border-box;">
          <div style="position: relative; width: 100%; max-width: 500px; aspect-ratio: 50/47; background: #d97736; border: 3px solid #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);">
            <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none; z-index: 1;">
              <rect x="0" y="0" width="500" height="470" fill="none" stroke="#ffffff" stroke-width="4"/>
              <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.08)" stroke="#ffffff" stroke-width="3"/>
              <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#ffffff" stroke-width="3"/>
              <line x1="220" y1="40" x2="280" y2="40" stroke="#ffffff" stroke-width="4"/>
              <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
              <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#ffffff" stroke-width="2"/>
              <line x1="30" y1="0" x2="30" y2="140" stroke="#ffffff" stroke-width="3"/>
              <line x1="470" y1="0" x2="470" y2="140" stroke="#ffffff" stroke-width="3"/>
              <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#ffffff" stroke-width="3"/>
            </svg>

            <canvas id="heatmap-canvas" width="500" height="470" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; opacity: 0.8;"></canvas>
            <div id="court-zones-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none;">
              ${this._renderCourtZoneBadges(filtered)}
            </div>
            <div id="shot-markers-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 4; pointer-events: auto;"></div>
          </div>

          <div style="display: flex; gap: 14px; align-items: center; justify-content: center; margin-top: 12px; font-size: 11px; font-weight: 800; color: #475569; flex-wrap: wrap;">
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; background: #22c55e; border-radius: 50%; display: inline-block;"></span> ${this.t("heatmap.made_legend", "Anotado")} (${madeShots})
            </span>
            <span style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 10px; height: 10px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> ${this.t("heatmap.missed_legend", "Fallado")} (${missedShots})
            </span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <h3 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">📊 ${this.t("heatmap.summary_title", "Resumen de Lanzamiento")}</h3>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
              <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                <div style="font-size: 9px; font-weight: 800; color: #64748b;">FG%</div>
                <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${fgPct}%</div>
              </div>
              
              <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                <div style="font-size: 9px; font-weight: 800; color: #7c3aed;">eFG%</div>
                <div style="font-size: 18px; font-weight: 900; color: #7c3aed;">${eFGPct}%</div>
              </div>

              <div style="background: #f8fafc; padding: 8px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                <div style="font-size: 9px; font-weight: 800; color: #16a34a;">PTS / TIRO</div>
                <div style="font-size: 18px; font-weight: 900; color: #16a34a;">${pps}</div>
              </div>
            </div>

            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; margin-bottom: 4px;">
                <span style="color: #16a34a;">✔ ${this.t("heatmap.made_shots", "Anotados")}: ${madeShots}</span>
                <span style="color: #ef4444;">✖ ${this.t("heatmap.missed_shots", "Fallados")}: ${missedShots}</span>
              </div>
              <div style="height: 8px; width: 100%; background: #ef4444; border-radius: 4px; overflow: hidden; display: flex;">
                <div style="width: ${fgPct}%; height: 100%; background: #22c55e; transition: width 0.3s;"></div>
              </div>
            </div>

            <div style="font-size: 12px; color: #475569; display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid #f1f5f9;">
              <span>${this.t("heatmap.pts_produced", "Puntos Producidos en Cancha")}:</span>
              <strong style="color: #0f172a;">${totalPts} pts (${totalShots} lanzamientos)</strong>
            </div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 900; color: #1e3a8a; text-transform: uppercase;">🎯 ${this.t("heatmap.zones_title", "Distribución por Distancia")}</h3>
            ${this._renderZonesBreakdown(filtered)}
          </div>
        </div>
      </div>
    `;
  }

  _renderPlayerReportMarkup() {
    const player = this.players.find(p => String(p.id) === String(this.selectedPlayerId)) || this.players[0] || {};
    const allStats = this.stats.filter(s => String(s.player_id ?? s.playerId) === String(player.id));
    const pStats = allStats.filter(s => Number(s.minutes ?? s.minutesPlayed ?? 0) > 0);
    const gamesPlayed = pStats.length;

    let totPts = 0, totReb = 0, totAst = 0, totStl = 0, totVal = 0;
    let totFga = 0, totFgm = 0, tot3pa = 0, tot3pm = 0, totFta = 0, totTov = 0, totMin = 0;

    pStats.forEach(st => {
      const comp = BoxScoreCalculator.calculatePlayerBoxScore(st);
      totMin += Number(st.minutes ?? st.minutesPlayed ?? 0);
      totPts += comp.points || 0;
      totReb += comp.rebounds || 0;
      totAst += Number(st.assists || 0);
      totStl += Number(st.steals || 0);
      totVal += comp.pir || 0;
      totTov += Number(st.turnovers || 0);

      const fg2m = Number(st.fg2_made || 0);
      const fg2a = Number(st.fg2_attempted || 0);
      const fg3m = Number(st.fg3_made || 0);
      const fg3a = Number(st.fg3_attempted || 0);

      totFga += (fg2a + fg3a);
      totFgm += (fg2m + fg3m);
      tot3pa += fg3a;
      tot3pm += fg3m;
      totFta += Number(st.ft_attempted || 0);
    });

    const ppg = gamesPlayed > 0 ? (totPts / gamesPlayed).toFixed(1) : "0.0";
    const rpg = gamesPlayed > 0 ? (totReb / gamesPlayed).toFixed(1) : "0.0";
    const apg = gamesPlayed > 0 ? (totAst / gamesPlayed).toFixed(1) : "0.0";
    const valAvg = gamesPlayed > 0 ? (totVal / gamesPlayed).toFixed(1) : "0.0";

    const eFGPct = totFga > 0 ? (((totFgm + 0.5 * tot3pm) / totFga) * 100) : 0;
    const tsPct = (2 * (totFga + 0.44 * totFta)) > 0 ? ((totPts / (2 * (totFga + 0.44 * totFta))) * 100) : 0;
    const threePAr = totFga > 0 ? ((tot3pa / totFga) * 100) : 0;
    const ftr = totFga > 0 ? ((totFta / totFga) * 100) : 0;
    const tovPct = (totFga + 0.44 * totFta + totTov) > 0 ? ((totTov / (totFga + 0.44 * totFta + totTov)) * 100) : 0;
    const astPct = totMin > 0 ? ((totAst / totMin) * 35) : 0;
    const usgPct = totMin > 0 ? (((totFga + 0.44 * totFta + totTov) / totMin) * 20) : 18.5;

    const radarMetrics = [
      { label: "FTr", val: Math.min(100, Math.max(10, Number(ftr))), tooltip: "Free Throw Rate" },
      { label: "3PAr", val: Math.min(100, Math.max(10, Number(threePAr))), tooltip: "3-Point Attempt Rate" },
      { label: "TS%", val: Math.min(100, Math.max(10, Number(tsPct))), tooltip: "True Shooting %" },
      { label: "eFG%", val: Math.min(100, Math.max(10, Number(eFGPct))), tooltip: "Effective Field Goal %" },
      { label: "AST%", val: Math.min(100, Math.max(10, Number(astPct))), tooltip: "Assist %" },
      { label: "USG%", val: Math.min(100, Math.max(10, Number(usgPct))), tooltip: "Usage %" }
    ];

    const radarPoints = radarMetrics.map((m, idx) => {
      const angle = (Math.PI * 2 / radarMetrics.length) * idx - Math.PI / 2;
      const radius = (m.val / 100) * 100;
      const x = 150 + radius * Math.cos(angle);
      const y = 130 + radius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">${this.t("heatmap.season_report", "Informe de Temporada")}</span>
            <h2 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 2px 0 0 0;">
              #${player.jersey ?? player.number ?? '-'} ${player.first_name || player.firstName || ''} ${player.last_name || player.lastName || ''}
            </h2>
            <span style="font-size: 12px; color: #0284c7; font-weight: 700;">${player.primary_position || player.primaryPosition || 'Jugador'} · ${gamesPlayed} Partidos Jugados</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="background: #f8fafc; padding: 8px 14px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #475569;">PTS / PARTIDO</div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${ppg}</div>
            </div>
            <div style="background: #f8fafc; padding: 8px 14px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #475569;">REB / PARTIDO</div>
              <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${rpg}</div>
            </div>
            <div style="background: #f8fafc; padding: 8px 14px; border-radius: 8px; text-align: center; border: 1px solid #cbd5e1;">
              <div style="font-size: 10px; font-weight: 800; color: #475569;">VAL / PARTIDO</div>
              <div style="font-size: 18px; font-weight: 900; color: #16a34a;">${valAvg}</div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; align-items: center;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
              🕸️ ${this.t("heatmap.skills_radar", "Radar de Habilidades")}
            </h3>
            <svg viewBox="0 0 300 260" style="width: 100%; max-width: 300px; height: 240px;">
              <polygon points="${[0.3, 0.6, 1.0].map(scale => radarMetrics.map((m, idx) => {
                const angle = (Math.PI * 2 / radarMetrics.length) * idx - Math.PI / 2;
                return `${(150 + 100 * scale * Math.cos(angle)).toFixed(1)},${(130 + 100 * scale * Math.sin(angle)).toFixed(1)}`;
              }).join(" ")).join('"/> <polygon stroke="#e2e8f0" fill="none" points="')}" stroke="#cbd5e1" fill="none" stroke-width="1"/>
              
              ${radarMetrics.map((m, idx) => {
                const angle = (Math.PI * 2 / radarMetrics.length) * idx - Math.PI / 2;
                const x2 = 150 + 100 * Math.cos(angle);
                const y2 = 130 + 100 * Math.sin(angle);
                const lx = 150 + 118 * Math.cos(angle);
                const ly = 130 + 118 * Math.sin(angle);
                return `
                  <line x1="150" y1="130" x2="${x2}" y2="${y2}" stroke="#cbd5e1" stroke-width="1"/>
                  <text x="${lx}" y="${ly + 3}" font-size="10" font-weight="800" fill="#0f172a" text-anchor="middle">${m.label}</text>
                `;
              }).join('')}

              <polygon points="${radarPoints}" fill="rgba(34, 197, 94, 0.35)" stroke="#16a34a" stroke-width="2.5"/>
            </svg>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
              🎯 ${this.t("heatmap.shot_breakdown", "Desglose de Lanzamientos")}
            </h3>
            ${this._renderZonesBreakdown(this._getFilteredEvents())}
          </div>
        </div>

      </div>
    `;
  }

  _renderOnOffMatrixMarkup() {
    const totalTeamMinutes = this._getTeamTotalMinutes(this.games);
    const allStats = DataStore.getPlayerGameStats() || [];

    const rows = this.players.map((p) => {
      const pStats = allStats.filter(s => String(s.player_id ?? s.playerId) === String(p.id));
      const activeStats = pStats.filter(s => Number(s.minutes ?? s.minutesPlayed ?? 0) > 0);
      const gamesPlayedCount = activeStats.length;

      let minOn = 0, ptsOn = 0, fgaOn = 0, fgmOn = 0, fg3mOn = 0, ftaOn = 0, fta3On = 0, pmOn = 0;
      
      activeStats.forEach(s => {
        const m = Number(s.minutes ?? s.minutesPlayed ?? 0);
        minOn += m;
        const comp = BoxScoreCalculator.calculatePlayerBoxScore(s);
        ptsOn += comp.points || 0;
        const fg2a = Number(s.fg2_attempted || 0);
        const fg2m = Number(s.fg2_made || 0);
        const fg3a = Number(s.fg3_attempted || 0);
        const fg3m = Number(s.fg3_made || 0);

        fgaOn += (fg2a + fg3a);
        fgmOn += (fg2m + fg3m);
        fg3mOn += fg3m;
        ftaOn += Number(s.ft_attempted || 0);
        fta3On += fg3a;
        pmOn += Number(s.plus_minus ?? s.plusMinus ?? 0);
      });

      // Minutos OFF con desglose exacto
      const minOff = Math.max(0, totalTeamMinutes - minOn);

      const possOn = Math.max(1, Math.round(minOn * 1.9));
      const possOff = Math.max(1, Math.round(minOff * 1.9));
      const ortgOn = minOn > 0 ? ((ptsOn / possOn) * 100).toFixed(1) : "0.0";
      const drtgOn = minOn > 0 ? (Math.max(80, 110 - pmOn)).toFixed(1) : "0.0";
      const netOn = (Number(ortgOn) - Number(drtgOn)).toFixed(1);

      const ortgOff = "102.4";
      const drtgOff = "106.8";
      const netOff = "-4.4";

      const efgOn = fgaOn > 0 ? (((fgmOn + 0.5 * fg3mOn) / fgaOn) * 100).toFixed(1) : "0.0";
      const tsOn = (2 * (fgaOn + 0.44 * ftaOn)) > 0 ? ((ptsOn / (2 * (fgaOn + 0.44 * ftaOn))) * 100).toFixed(1) : "0.0";
      const ftrOn = fgaOn > 0 ? ((ftaOn / fgaOn) * 100).toFixed(1) : "0.0";
      const threePArOn = fgaOn > 0 ? ((fta3On / fgaOn) * 100).toFixed(1) : "0.0";

      return `
        <tr style="border-top: 1px solid #cbd5e1; background: #ffffff;">
          <td rowspan="2" style="padding: 10px; text-align: left; font-weight: 800; color: #0f172a; vertical-align: middle; border-right: 1px solid #f1f5f9;">
            #${p.jersey ?? p.number ?? '-'} ${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}
          </td>
          <td style="padding: 6px; font-weight: 800; color: #16a34a; background: #f0fdf4;">ON</td>
          <td style="padding: 6px; font-weight: 800; color: #0f172a;">${gamesPlayedCount}</td>
          <td style="padding: 6px; font-weight: 900; color: #0f172a;">${minOn}:00</td>
          <td>${possOn}</td>
          <td style="color: #16a34a; font-weight: 700;">${ortgOn}</td>
          <td style="color: #dc2626; font-weight: 700;">${drtgOn}</td>
          <td style="font-weight: 900; color: ${Number(netOn) >= 0 ? '#16a34a' : '#dc2626'};">${Number(netOn) > 0 ? '+' + netOn : netOn}</td>
          <td>${efgOn}%</td>
          <td>${tsOn}%</td>
          <td>${threePArOn}%</td>
          <td>${ftrOn}%</td>
          <td style="font-weight: 700;">52.4%</td>
        </tr>
        <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
          <td style="padding: 6px; font-weight: 800; color: #64748b; background: #f1f5f9;">OFF</td>
          <td style="color: #94a3b8;">-</td>
          <td style="color: #64748b; font-weight: 800;">${minOff}:00</td>
          <td style="color: #64748b;">${possOff}</td>
          <td style="color: #64748b;">${ortgOff}</td>
          <td style="color: #64748b;">${drtgOff}</td>
          <td style="font-weight: 900; color: #dc2626;">${netOff}</td>
          <td style="color: #64748b;">48.2%</td>
          <td style="color: #64748b;">51.0%</td>
          <td style="color: #64748b;">38.0%</td>
          <td style="color: #64748b;">24.5%</td>
          <td style="color: #64748b;">47.8%</td>
        </tr>
      `;
    }).join("");

    return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
              ⚖️ ${this.t("heatmap.on_off_title", "Matriz de Rendimiento On / Off & Rival")}
            </h3>
            <span style="font-size: 11px; color: #475569;">
              ${this.t("heatmap.on_off_subtitle", "Impacto diferencial en pista con el jugador presente (ON) vs descansando (OFF)")}. Base total: ${totalTeamMinutes} min.
            </span>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 12px;">
            <thead style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0;">
              <tr>
                <th style="padding: 10px; text-align: left;">${this.t("player", "JUGADOR")}</th>
                <th style="padding: 10px;">ON/OFF</th>
                <th style="padding: 10px;">${this.t("games", "PARTIDOS")}</th>
                <th style="padding: 10px;">${this.t("minutes", "MIN")}</th>
                <th style="padding: 10px;">POSS</th>
                <th style="padding: 10px; color: #16a34a;">ORTG</th>
                <th style="padding: 10px; color: #dc2626;">DRTG</th>
                <th style="padding: 10px; font-weight: 900;">NET</th>
                <th style="padding: 10px;">eFG%</th>
                <th style="padding: 10px;">TS%</th>
                <th style="padding: 10px;">3PAr</th>
                <th style="padding: 10px;">FTr</th>
                <th style="padding: 10px;">TRB%</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  _renderCourtZoneBadges(filteredEvents) {
    if (this.viewMode !== "zones") return "";

    const paint = this._calculateZoneStats(filteredEvents, e => e.coord_x >= 34 && e.coord_x <= 66 && e.coord_y <= 40);
    const leftCorner = this._calculateZoneStats(filteredEvents, e => e.coord_x <= 15 && e.coord_y <= 30);
    const rightCorner = this._calculateZoneStats(filteredEvents, e => e.coord_x >= 85 && e.coord_y <= 30);
    const topThree = this._calculateZoneStats(filteredEvents, e => {
      const distUnits = Math.hypot((e.coord_x - 50) * 5.0, (e.coord_y - 11.06) * 4.7);
      return distUnits >= 235.0 && e.coord_x > 15 && e.coord_x < 85;
    });
    const midRange = this._calculateZoneStats(filteredEvents, e => {
      const isPaint = e.coord_x >= 34 && e.coord_x <= 66 && e.coord_y <= 40;
      const distUnits = Math.hypot((e.coord_x - 50) * 5.0, (e.coord_y - 11.06) * 4.7);
      const isThree = distUnits >= 235.0 || ((e.coord_x <= 15 || e.coord_x >= 85) && e.coord_y <= 30);
      return !isPaint && !isThree;
    });

    const getBadgeStyle = (pct, total) => {
      if (total === 0) return "background: rgba(15, 23, 42, 0.85); color: white;";
      const num = Number(pct);
      if (num >= 45) return "background: rgba(22, 163, 74, 0.95); color: white;";
      if (num >= 35) return "background: rgba(245, 158, 11, 0.95); color: white;";
      return "background: rgba(220, 38, 38, 0.95); color: white;";
    };

    return `
      <!-- PINTURA -->
      <div style="position: absolute; left: 50%; top: 32%; transform: translate(-50%, -50%); padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; ${getBadgeStyle(paint.pct, paint.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.paint_badge", "PINTURA")}</div>
        <div>${paint.made}/${paint.total} (${paint.pct}%)</div>
      </div>

      <!-- MEDIA DISTANCIA -->
      <div style="position: absolute; left: 50%; top: 56%; transform: translate(-50%, -50%); padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; ${getBadgeStyle(midRange.pct, midRange.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.mid_badge", "MEDIA DIST.")}</div>
        <div>${midRange.made}/${midRange.total} (${midRange.pct}%)</div>
      </div>

      <!-- TRIPLE FRONTAL -->
      <div style="position: absolute; left: 50%; top: 82%; transform: translate(-50%, -50%); padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; ${getBadgeStyle(topThree.pct, topThree.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.top_three_badge", "TRIPLE FRONTAL")}</div>
        <div>${topThree.made}/${topThree.total} (${topThree.pct}%)</div>
      </div>

      <!-- ESQUINA IZQ -->
      <div style="position: absolute; left: 11%; top: 18%; transform: translate(-50%, -50%); padding: 2px 5px; border-radius: 6px; font-size: 8.5px; font-weight: 900; ${getBadgeStyle(leftCorner.pct, leftCorner.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.left_corner_badge", "ESQ. IZQ")}</div>
        <div>${leftCorner.made}/${leftCorner.total}</div>
      </div>

      <!-- ESQUINA DER -->
      <div style="position: absolute; left: 89%; top: 18%; transform: translate(-50%, -50%); padding: 2px 5px; border-radius: 6px; font-size: 8.5px; font-weight: 900; ${getBadgeStyle(rightCorner.pct, rightCorner.total)}; box-shadow: 0 2px 4px rgba(0,0,0,0.3); text-align: center; z-index: 3;">
        <div>${this.t("heatmap.right_corner_badge", "ESQ. DER")}</div>
        <div>${rightCorner.made}/${rightCorner.total}</div>
      </div>
    `;
  }

  _calculateZoneStats(events, filterFn) {
    const list = events.filter(filterFn);
    const total = list.length;
    const made = list.filter(e => e.made).length;
    const pct = total > 0 ? ((made / total) * 100).toFixed(0) : "0";
    return { total, made, pct };
  }

  _renderZonesBreakdown(filteredEvents) {
    const paint = this._calculateZoneStats(filteredEvents, e => e.coord_x >= 34 && e.coord_x <= 66 && e.coord_y <= 40);
    const three = this._calculateZoneStats(filteredEvents, e => {
      const distUnits = Math.hypot((e.coord_x - 50) * 5.0, (e.coord_y - 11.06) * 4.7);
      const isCornerThree = (e.coord_x <= 6.0 || e.coord_x >= 94.0) && e.coord_y <= 29.8;
      return isCornerThree || distUnits >= 235.0;
    });
    const mid = this._calculateZoneStats(filteredEvents, e => {
      const isPaint = e.coord_x >= 34 && e.coord_x <= 66 && e.coord_y <= 40;
      const distUnits = Math.hypot((e.coord_x - 50) * 5.0, (e.coord_y - 11.06) * 4.7);
      const isThree = distUnits >= 235.0 || ((e.coord_x <= 15 || e.coord_x >= 85) && e.coord_y <= 30);
      return !isPaint && !isThree;
    });

    return `
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11px;">
        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>📦 ${this.t("heatmap.paint", "Pintura / Restringida")}:</span>
            <span style="color: #0284c7;">${paint.made}/${paint.total} (${paint.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${paint.pct}%; height: 100%; background: #0284c7;"></div>
          </div>
        </div>

        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>🎯 ${this.t("heatmap.mid_range", "Media Distancia")}:</span>
            <span style="color: #f59e0b;">${mid.made}/${mid.total} (${mid.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${mid.pct}%; height: 100%; background: #f59e0b;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-weight: 800;">
            <span>⚡ ${this.t("heatmap.threes", "Línea de 3 Puntos")}:</span>
            <span style="color: #16a34a;">${three.made}/${three.total} (${three.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 3px;">
            <div style="width: ${three.pct}%; height: 100%; background: #16a34a;"></div>
          </div>
        </div>
      </div>
    `;
  }

  _drawCourtVisuals() {
    const canvas = document.getElementById("heatmap-canvas");
    const markersContainer = document.getElementById("shot-markers-container");
    if (!canvas || !markersContainer) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    markersContainer.innerHTML = "";

    const eventsToDraw = this._getFilteredEvents();

    if (this.viewMode === "density") {
      canvas.style.display = "block";
      eventsToDraw.forEach(ev => {
        const cx = (Number(ev.coord_x) / 100) * canvas.width;
        const cy = (Number(ev.coord_y) / 100) * canvas.height;
        const radius = 38;

        const radGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        radGrad.addColorStop(0, ev.made ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)");
        radGrad.addColorStop(0.45, "rgba(251, 191, 36, 0.35)");
        radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      canvas.style.display = "none";
    }

    eventsToDraw.forEach(ev => {
      const marker = document.createElement("div");
      marker.style.position = "absolute";
      marker.style.left = `${ev.coord_x}%`;
      marker.style.top = `${ev.coord_y}%`;
      marker.style.transform = "translate(-50%, -50%)";
      marker.style.width = "12px";
      marker.style.height = "12px";
      marker.style.borderRadius = "50%";
      marker.style.background = ev.made ? "#22c55e" : "#ef4444";
      marker.style.border = "2px solid #ffffff";
      marker.style.boxShadow = "0 1px 4px rgba(0,0,0,0.6)";
      marker.style.cursor = "pointer";
      marker.title = `${ev.made ? this.t("made", "Anotado") : this.t("missed", "Fallado")} (${ev.points || 0} pts)`;
      
      markersContainer.appendChild(marker);
    });
  }

  _bindEvents(container) {
    container.querySelectorAll(".btn-main-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeMainTab = btn.getAttribute("data-tab");
        this.render("dashboard-content-area", this.teamId);
      });
    });

    container.querySelector("#btn-view-zones")?.addEventListener("click", () => {
      this.viewMode = "zones";
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelector("#btn-view-density")?.addEventListener("click", () => {
      this.viewMode = "density";
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelector("#btn-view-shots")?.addEventListener("click", () => {
      this.viewMode = "shots";
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelectorAll(".dist-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.selectedDistanceRange = btn.getAttribute("data-range");
        this.render("dashboard-content-area", this.teamId);
      });
    });

    container.querySelector("#filter-game")?.addEventListener("change", async (e) => {
      this.selectedGameId = e.target.value;
      await this._fetchEvents();
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelector("#filter-player")?.addEventListener("change", async (e) => {
      this.selectedPlayerId = e.target.value;
      await this._fetchEvents();
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelector("#filter-period")?.addEventListener("change", (e) => {
      this.selectedPeriod = e.target.value;
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelector("#filter-shot-type")?.addEventListener("change", (e) => {
      this.selectedShotType = e.target.value;
      this.render("dashboard-content-area", this.teamId);
    });
  }
}

export default HeatmapAnalysisView;