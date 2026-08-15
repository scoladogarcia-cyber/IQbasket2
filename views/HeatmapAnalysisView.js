/**
 * HeatmapAnalysisView.js
 * Vista para análisis de mapas de calor y cartas de tiro (Shot Charts).
 * Integrada con TranslationStore e I18nService para soporte multidioma total.
 */

import { DataStore } from "../services/DataStore.js";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

export class HeatmapAnalysisView {
  constructor(supabaseClient, authController) {
    this.supabase = supabaseClient;
    this.auth = authController;
    this.events = [];
    this.games = [];
    this.players = [];
    
    // Filtros activos
    this.selectedGameId = "all";
    this.selectedPlayerId = "all";
    this.selectedPeriod = "all";
    this.selectedShotType = "all"; // 'all' | 'made' | 'missed'
    this.viewMode = "density"; // 'density' | 'shots'
  }

  t(key, fallback = "") {
    return TranslationStore.t(key, fallback);
  }

  async render(containerId = "dashboard-content-area", teamId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.teamId = teamId || DataStore.getActiveTeamId();
    this.games = DataStore.getGames() || [];
    this.players = DataStore.getPlayers() || [];

    await this._fetchEvents();
    this._renderLayout(container);
    this._drawHeatmap();
    this._bindEvents(container);
  }

  async _fetchEvents() {
    try {
      let query = this.supabase
        .from("game_events")
        .select("*")
        .eq("team_id", this.teamId)
        .not("coord_x", "is", null);

      if (this.selectedGameId !== "all") {
        query = query.eq("game_id", this.selectedGameId);
      }
      if (this.selectedPlayerId !== "all") {
        query = query.eq("player_id", this.selectedPlayerId);
      }

      const { data, error } = await query;
      if (!error && data) {
        this.events = data;
      }
    } catch (err) {
      console.warn("Error cargando eventos de tiro:", err);
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
      return true;
    });
  }

  _renderLayout(container) {
    const filtered = this._getFilteredEvents();
    const totalShots = filtered.length;
    const madeShots = filtered.filter(e => e.made).length;
    const pct = totalShots > 0 ? ((madeShots / totalShots) * 100).toFixed(1) : "0.0";
    const totalPts = filtered.filter(e => e.made).reduce((acc, curr) => acc + (curr.points || 0), 0);

    container.innerHTML = `
      <div style="max-width: 1400px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
        
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">🔥 ${this.t("heatmap.title", "Análisis de Mapa de Calor y Tiro")}</h1>
            <span style="font-size: 13px; color: #64748b;">${this.t("heatmap.subtitle", "Distribución espacial, densidad de lanzamientos y efectividad en pista")}</span>
          </div>

          <!-- SELECTOR DE MODO DE VISUALIZACIÓN -->
          <div style="display: flex; gap: 6px; background: white; padding: 4px; border: 1px solid #cbd5e1; border-radius: 10px;">
            <button id="btn-view-density" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; background: ${this.viewMode === 'density' ? '#ea580c' : '#f8fafc'}; color: ${this.viewMode === 'density' ? 'white' : '#475569'};">
              🔥 ${this.t("heatmap.mode_density", "Densidad Térmica")}
            </button>
            <button id="btn-view-shots" style="padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; background: ${this.viewMode === 'shots' ? '#ea580c' : '#f8fafc'}; color: ${this.viewMode === 'shots' ? 'white' : '#475569'};">
              🎯 ${this.t("heatmap.mode_shots", "Carta de Tiro (Puntos)")}
            </button>
          </div>
        </div>

        <!-- FILTROS -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_game", "PARTIDO")}</label>
            <select id="filter-game" style="width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 4px 8px;">
              <option value="all" ${this.selectedGameId === 'all' ? 'selected' : ''}>${this.t("heatmap.all_games", "Todos los partidos")}</option>
              ${this.games.map(g => `<option value="${g.id}" ${this.selectedGameId === g.id ? 'selected' : ''}>vs ${g.opponent || this.t("opponent", "Rival")} (${g.date ? I18n.formatDate(g.date) : '-'})</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_player", "JUGADOR")}</label>
            <select id="filter-player" style="width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 4px 8px;">
              <option value="all" ${this.selectedPlayerId === 'all' ? 'selected' : ''}>${this.t("heatmap.all_players", "Todo el equipo")}</option>
              ${this.players.map(p => `<option value="${p.id}" ${this.selectedPlayerId === p.id ? 'selected' : ''}>#${p.jersey ?? '-'} ${p.first_name || ''} ${p.last_name || ''}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_period", "PERIODO")}</label>
            <select id="filter-period" style="width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 4px 8px;">
              <option value="all" ${this.selectedPeriod === 'all' ? 'selected' : ''}>${this.t("heatmap.all_periods", "Todos los cuartos")}</option>
              <option value="1" ${this.selectedPeriod === '1' ? 'selected' : ''}>Q1</option>
              <option value="2" ${this.selectedPeriod === '2' ? 'selected' : ''}>Q2</option>
              <option value="3" ${this.selectedPeriod === '3' ? 'selected' : ''}>Q3</option>
              <option value="4" ${this.selectedPeriod === '4' ? 'selected' : ''}>Q4</option>
            </select>
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px;">${this.t("heatmap.filter_outcome", "RESULTADO DE TIRO")}</label>
            <select id="filter-shot-type" style="width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 600; padding: 4px 8px;">
              <option value="all" ${this.selectedShotType === 'all' ? 'selected' : ''}>${this.t("heatmap.all_outcomes", "Anotados y Fallados")}</option>
              <option value="made" ${this.selectedShotType === 'made' ? 'selected' : ''}>${this.t("heatmap.only_made", "Solo Anotados (Verde)")}</option>
              <option value="missed" ${this.selectedShotType === 'missed' ? 'selected' : ''}>${this.t("heatmap.only_missed", "Solo Fallados (Rojo)")}</option>
            </select>
          </div>
        </div>

        <!-- CONTENEDOR PRINCIPAL: PISTA + PANEL METRICS -->
        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start;">
          
          <!-- PISTA INTERACTIVA -->
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="position: relative; width: 100%; max-width: 540px; aspect-ratio: 50/47; background: #d97736; border: 4px solid #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);">
              
              <svg viewBox="0 0 500 470" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; pointer-events: none; z-index: 1;">
                <rect x="0" y="0" width="500" height="470" fill="none" stroke="#fff" stroke-width="4"/>
                <rect x="170" y="0" width="160" height="190" fill="rgba(255,255,255,0.1)" stroke="#fff" stroke-width="3"/>
                <path d="M 170 190 A 80 80 0 0 0 330 190" fill="none" stroke="#fff" stroke-width="3"/>
                <path d="M 170 190 A 80 80 0 0 1 330 190" stroke-dasharray="8,8" fill="none" stroke="#fff" stroke-width="2"/>
                <line x1="220" y1="40" x2="280" y2="40" stroke="#fff" stroke-width="4"/>
                <circle cx="250" cy="52" r="15" fill="none" stroke="#ff5722" stroke-width="4"/>
                <path d="M 215 52 A 35 35 0 0 0 285 52" fill="none" stroke="#fff" stroke-width="2"/>
                <line x1="30" y1="0" x2="30" y2="140" stroke="#fff" stroke-width="3"/>
                <line x1="470" y1="0" x2="470" y2="140" stroke="#fff" stroke-width="3"/>
                <path d="M 30 140 A 235 235 0 0 0 470 140" fill="none" stroke="#fff" stroke-width="3"/>
              </svg>

              <canvas id="heatmap-canvas" width="500" height="470" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; opacity: 0.75;"></canvas>
              <div id="shot-markers-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none;"></div>
            </div>

            <!-- LEYENDA -->
            <div style="display: flex; gap: 20px; align-items: center; margin-top: 14px; font-size: 12px; font-weight: 700; color: #475569;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 50%; display: inline-block;"></span> ${this.t("heatmap.made_legend", "Tiro Anotado")}
              </span>
              <span style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 50%; display: inline-block;"></span> ${this.t("heatmap.missed_legend", "Tiro Fallado")}
              </span>
              <span style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 28px; height: 8px; background: linear-gradient(to right, blue, cyan, lime, yellow, red); border-radius: 4px; display: inline-block;"></span> ${this.t("heatmap.density_legend", "Densidad")}
              </span>
            </div>
          </div>

          <!-- PANEL LATERAL DE MÉTRICAS -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px;">
              <h3 style="margin: 0 0 14px 0; font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${this.t("heatmap.summary_title", "Resumen de Lanzamiento")}</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                  <div style="font-size: 10px; font-weight: 800; color: #64748b;">${this.t("heatmap.total_shots", "TIROS TOTALES")}</div>
                  <div style="font-size: 20px; font-weight: 900; color: #0f172a;">${totalShots}</div>
                </div>
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #f1f5f9;">
                  <div style="font-size: 10px; font-weight: 800; color: #64748b;">${this.t("heatmap.field_goal_pct", "EFECTIVIDAD")}</div>
                  <div style="font-size: 20px; font-weight: 900; color: #16a34a;">${pct}%</div>
                </div>
              </div>

              <div style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>${this.t("heatmap.shots_converted", "Canastas Convertidas")}:</span>
                  <strong>${madeShots} / ${totalShots}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>${this.t("heatmap.points_produced", "Puntos Producidos")}:</span>
                  <strong>${totalPts} pts</strong>
                </div>
              </div>
            </div>

            <!-- DISTRIBUCIÓN POR DISTANCIA -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px;">
              <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${this.t("heatmap.zones_title", "Distribución por Distancia")}</h3>
              
              ${this._renderZonesBreakdown(filtered)}
            </div>

          </div>

        </div>

      </div>
    `;
  }

  _renderZonesBreakdown(filteredEvents) {
    const paintShots = filteredEvents.filter(e => {
      const x = e.coord_x;
      const y = e.coord_y;
      return x >= 34 && x <= 66 && y <= 40;
    });

    const threeShots = filteredEvents.filter(e => {
      const dist = Math.hypot((e.coord_x - 50) * 1.5, (e.coord_y - 11) * 1.5);
      return dist > 42 || e.coord_y > 55;
    });

    const midRangeShots = filteredEvents.filter(e => !paintShots.includes(e) && !threeShots.includes(e));

    const getStats = (arr) => {
      const total = arr.length;
      const made = arr.filter(e => e.made).length;
      const pct = total > 0 ? ((made / total) * 100).toFixed(0) : "0";
      return { total, made, pct };
    };

    const paint = getStats(paintShots);
    const mid = getStats(midRangeShots);
    const three = getStats(threeShots);

    return `
      <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>${this.t("heatmap.zone_paint", "Zona / Pintura")}:</span>
            <span>${paint.made}/${paint.total} (${paint.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 4px;">
            <div style="width: ${paint.pct}%; height: 100%; background: #0284c7;"></div>
          </div>
        </div>

        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>${this.t("heatmap.zone_midrange", "Media Distancia")}:</span>
            <span>${mid.made}/${mid.total} (${mid.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 4px;">
            <div style="width: ${mid.pct}%; height: 100%; background: #f59e0b;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-weight: 700;">
            <span>${this.t("heatmap.zone_three", "Línea de 3 Puntos")}:</span>
            <span>${three.made}/${three.total} (${three.pct}%)</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 4px;">
            <div style="width: ${three.pct}%; height: 100%; background: #16a34a;"></div>
          </div>
        </div>
      </div>
    `;
  }

  _drawHeatmap() {
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
        const cx = (ev.coord_x / 100) * canvas.width;
        const cy = (ev.coord_y / 100) * canvas.height;
        const radius = 32;

        const radGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        radGrad.addColorStop(0, "rgba(255, 0, 0, 0.45)");
        radGrad.addColorStop(0.5, "rgba(255, 200, 0, 0.25)");
        radGrad.addColorStop(1, "rgba(0, 0, 255, 0)");

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      canvas.style.display = "none";
    }

    if (this.viewMode === "shots") {
      eventsToDraw.forEach(ev => {
        const marker = document.createElement("div");
        marker.style.position = "absolute";
        marker.style.left = `${ev.coord_x}%`;
        marker.style.top = `${ev.coord_y}%`;
        marker.style.transform = "translate(-50%, -50%)";
        marker.style.width = "14px";
        marker.style.height = "14px";
        marker.style.borderRadius = "50%";
        marker.style.background = ev.made ? "#22c55e" : "#ef4444";
        marker.style.border = "2px solid white";
        marker.style.boxShadow = "0 2px 4px rgba(0,0,0,0.4)";
        marker.title = `${ev.made ? this.t("heatmap.made", "Anotado") : this.t("heatmap.missed", "Fallado")} (${ev.points || 0} pts)`;
        markersContainer.appendChild(marker);
      });
    }
  }

  _bindEvents(container) {
    container.querySelector("#btn-view-density")?.addEventListener("click", () => {
      this.viewMode = "density";
      this.render("dashboard-content-area", this.teamId);
    });

    container.querySelector("#btn-view-shots")?.addEventListener("click", () => {
      this.viewMode = "shots";
      this.render("dashboard-content-area", this.teamId);
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