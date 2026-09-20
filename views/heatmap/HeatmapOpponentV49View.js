/**
 * @fileoverview Extensión V49 de Heatmap: tiros propios frente a puntos recibidos.
 * @description Conserva íntegra la UX propia y añade pista rival en modo solo
 * lectura. Respeta los partidos de DataStore (ya filtrados por RLS y equipo).
 */
import { HeatmapAnalysisView } from "../HeatmapAnalysisView.js";
import { DataStore } from "../../services/DataStore.js";
import { buildGameShotMaps } from "../../domain/analytics/GameReportShotMaps.js";
import { renderOpponentScoringCourt } from "../reports/OpponentScoringCourt.js";

const modeButtons = active => `<div role="group" aria-label="Seleccionar mapa de tiro" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px">
  <button type="button" data-map-team="own" aria-pressed="${active === "own"}" style="border:1px solid #94a3b8;border-radius:9px;min-height:44px;padding:10px 16px;background:${active === "own" ? "#1e3a8a" : "#fff"};color:${active === "own" ? "#fff" : "#0f172a"};font-weight:800;cursor:pointer">Nuestros tiros</button>
  <button type="button" data-map-team="opponent" aria-pressed="${active === "opponent"}" style="border:1px solid #94a3b8;border-radius:9px;min-height:44px;padding:10px 16px;background:${active === "opponent" ? "#1e3a8a" : "#fff"};color:${active === "opponent" ? "#fff" : "#0f172a"};font-weight:800;cursor:pointer">Puntos recibidos · rival</button>
</div>`;

export class HeatmapOpponentV49View extends HeatmapAnalysisView {
  constructor(supabaseClient = null, authController = null) {
    super(supabaseClient, authController);
    this.mapTeam = "own";
    this.opponentEvents = [];
    this.opponentLoadError = false;
  }

  /** Los eventos del rival se consultan por los mismos game IDs autorizados. */
  async _fetchEvents() {
    if (this.mapTeam === "own") return super._fetchEvents();
    const visibleIds = new Set((this.games || []).map(game => String(game.id)));
    const requested = this.selectedGameId === "all"
      ? [...visibleIds]
      : visibleIds.has(String(this.selectedGameId)) ? [String(this.selectedGameId)] : [];
    this.opponentEvents = [];
    this.opponentLoadError = false;
    if (!requested.length) return;
    try {
      const events = await DataStore.loadGameEvents(requested);
      if (!Array.isArray(events)) throw new Error("No se recuperaron eventos del partido");
      this.opponentEvents = events.filter(event => requested.includes(String(event.game_id ?? event.gameId))
        && String(event.action_type ?? event.action ?? "").toLowerCase() === "opp_pts");
    } catch (error) {
      console.warn("[HeatmapV49] No se pudieron recuperar los puntos recibidos",error);
      this.opponentLoadError = true;
    }
  }

  _getFilteredEvents() {
    if (this.mapTeam === "own") return super._getFilteredEvents();
    return this.opponentEvents.filter(event => this.selectedPeriod === "all"
      || String(event.period ?? "") === String(this.selectedPeriod));
  }

  _renderCourtViewMarkup() {
    if (this.mapTeam === "own") return modeButtons("own") + super._renderCourtViewMarkup();
    const events = this._getFilteredEvents();
    const map = buildGameShotMaps(events).opponent;
    const label = this.selectedPeriod === "all" ? "Todos los periodos seleccionados" : `Periodo ${this.selectedPeriod}`;
    return modeButtons("opponent") + (this.opponentLoadError
      ? '<p role="alert" style="padding:20px;background:#fff7ed;color:#92400e">No se han podido cargar los puntos recibidos; no se muestran posiciones ficticias. Reinténtalo al recuperar la conexión.</p>'
      : renderOpponentScoringCourt(map, { title: "Desde dónde nos han metido los puntos", periodLabel: label }));
  }

  _drawCourtVisuals() {
    if (this.mapTeam === "own") super._drawCourtVisuals();
  }

  _bindEvents(container) {
    super._bindEvents(container);
    container.querySelectorAll("[data-map-team]").forEach(button => button.addEventListener("click", () => {
      const next = button.dataset.mapTeam;
      if (!["own","opponent"].includes(next) || this.mapTeam === next) return;
      this.mapTeam = next;
      this.selectedShotType = "all";
      this.selectedDistanceRange = "all";
      this.render("dashboard-content-area",this.teamId);
    }));
  }

  async render(containerId = "dashboard-content-area", teamId = null) {
    await super.render(containerId,teamId);
    if (this.mapTeam !== "opponent" || this.activeMainTab !== "court") return;
    const root = document.getElementById(containerId);
    for (const selector of ["#filter-player","#filter-shot-type"]) {
      const select = root?.querySelector(selector);
      if (select?.parentElement) select.parentElement.hidden = true;
    }
  }
}

export default HeatmapOpponentV49View;
