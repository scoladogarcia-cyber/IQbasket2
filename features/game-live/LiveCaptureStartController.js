/**
 * @fileoverview Sporting-state gate shown before a live scorer can acquire a writer lease.
 * @description Prevents the V38 dead-end where a SCHEDULED game displayed the
 * scorer but the lease backend correctly rejected all writes. The backend
 * GamePlayStateService remains authoritative for READY/LIVE transitions.
 */

import { DataStore } from "../../services/DataStore.js";
import { Permission } from "../../security/PermissionService.js";
import { GamePlayStateService } from "../../services/games/GamePlayStateService.js";

const GATE_SELECTOR = "[data-live-start-gate]";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class LiveCaptureStartController {
  constructor(view, supabaseClient = null, authController = null) {
    this.view = view;
    this.auth = authController;
    this.service = new GamePlayStateService(supabaseClient);
    this.container = null;
    this.gameId = null;
    this.busy = false;
    this.generation = 0;
  }

  _context() {
    const game = DataStore.getGameById?.(this.gameId) || {};
    const teamId = game.team_id || game.teamId || DataStore.getActiveTeamId?.() || null;
    return {
      gameId: this.gameId,
      teamId,
      seasonId: game.season_id || game.seasonId || null,
      teamSeasonId: game.team_season_id || game.teamSeasonId || DataStore.getActiveTeamSeasonId?.(teamId) || null
    };
  }

  _can(permission) {
    return Boolean(this.auth?.can?.(permission, this._context()));
  }

  _removeGate() {
    this.container?.querySelector?.(GATE_SELECTOR)?.remove();
  }

  _root() {
    return this.container?.querySelector?.(".v39-live-root,.v38-live-root") || null;
  }

  async syncAfterRender(container, gameId) {
    this.container = container || null;
    this.gameId = String(gameId || this.view?.gameId || "").trim() || null;
    const generation = ++this.generation;
    if (!this.container || !this.gameId || !this._root()) return { state: null, gated: false };

    try {
      const snapshot = await this.service.snapshot(this.gameId);
      if (generation !== this.generation) return { state: null, gated: false };
      const state = String(snapshot.play_state || snapshot.playState || "SCHEDULED").toUpperCase();
      this._syncLocalState(state);

      if (state === "LIVE") {
        this._removeGate();
        return { state, gated: false };
      }

      if (state === "SCHEDULED" || state === "READY") {
        this._renderGate(state);
        return { state, gated: true };
      }

      this._renderClosedGate(state);
      return { state, gated: true };
    } catch (error) {
      if (generation !== this.generation) return { state: null, gated: false };
      this._renderError(error);
      return { state: null, gated: true };
    }
  }

  _syncLocalState(state) {
    const game = DataStore.getGameById?.(this.gameId);
    if (!game) return;
    game.play_state = state;
    game.playState = state;
    if (state === "LIVE") game.status = "En vivo";
  }

  _panel() {
    let panel = this.container?.querySelector?.(GATE_SELECTOR);
    if (panel) return panel;
    const root = this._root();
    if (!root) return null;
    panel = document.createElement("section");
    panel.dataset.liveStartGate = "true";
    panel.className = "v39-live-start-gate";
    root.prepend(panel);
    return panel;
  }

  _renderGate(state) {
    const panel = this._panel();
    if (!panel) return;
    const canPrepare = state !== "SCHEDULED" || this._can(Permission.PREPARE_GAME);
    const canStart = this._can(Permission.START_GAME);
    const canAct = canPrepare && canStart;
    const label = state === "SCHEDULED" ? "Preparar e iniciar partido" : "Iniciar partido";
    panel.innerHTML = `
      <div class="v39-live-start-copy">
        <strong>🏀 ${state === "SCHEDULED" ? "Partido todavía programado" : "Partido preparado"}</strong>
        <span>${canAct
          ? "La anotación se habilitará al iniciar el estado deportivo LIVE."
          : "La captura está preparada, pero un usuario con permiso de inicio debe poner el partido en vivo."}</span>
      </div>
      ${canAct ? `<button type="button" data-live-start-action>${label}</button>` : ""}
      <div data-live-start-feedback role="status" aria-live="polite"></div>`;
    panel.querySelector("[data-live-start-action]")?.addEventListener("click", () => this._start(state));
  }

  _renderClosedGate(state) {
    const panel = this._panel();
    if (!panel) return;
    panel.innerHTML = `
      <div class="v39-live-start-copy">
        <strong>Partido ${escapeHtml(state.toLowerCase())}</strong>
        <span>La anotación en vivo no admite nuevas jugadas en este estado.</span>
      </div>
      <button type="button" data-live-start-back>Volver a Partidos</button>`;
    panel.querySelector("[data-live-start-back]")?.addEventListener("click", () => {
      window.location.hash = "#/partidos";
    });
  }

  _renderError(error) {
    const panel = this._panel();
    if (!panel) return;
    panel.innerHTML = `
      <div class="v39-live-start-copy">
        <strong>⚠️ No se pudo comprobar el estado del partido</strong>
        <span>${escapeHtml(error?.message || error || "Error de estado")}</span>
      </div>
      <button type="button" data-live-start-retry>Reintentar</button>`;
    panel.querySelector("[data-live-start-retry]")?.addEventListener("click", () => {
      this.syncAfterRender(this.container, this.gameId).catch(() => {});
    });
  }

  async _start(initialState) {
    if (this.busy) return;
    const panel = this._panel();
    const button = panel?.querySelector?.("[data-live-start-action]");
    const feedback = panel?.querySelector?.("[data-live-start-feedback]");
    this.busy = true;
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "Iniciando partido…";

    try {
      let state = initialState;
      if (state === "SCHEDULED") {
        const prepared = await this.service.transition({
          gameId: this.gameId,
          targetState: "READY",
          reason: "Preparado desde scorer V39"
        });
        state = String(prepared.play_state || "READY").toUpperCase();
      }
      if (state === "READY") {
        const started = await this.service.transition({
          gameId: this.gameId,
          targetState: "LIVE",
          reason: "Inicio desde scorer V39"
        });
        state = String(started.play_state || "LIVE").toUpperCase();
      }
      this._syncLocalState(state);
      if (state !== "LIVE") throw new Error(`El partido quedó en estado ${state}.`);
      this._removeGate();
      await this.view.render(this.container?.id || "dashboard-content-area");
    } catch (error) {
      if (feedback) feedback.textContent = error?.message || "No se pudo iniciar el partido.";
      if (button) button.disabled = false;
    } finally {
      this.busy = false;
    }
  }
}

export function attachLiveCaptureStartGate(view, supabaseClient = null, authController = null, gameId = null) {
  if (!view || view.__liveCaptureStartGateAttached) return view;
  view.__liveCaptureStartGateAttached = true;
  const controller = new LiveCaptureStartController(view, supabaseClient, authController);
  const originalRender = view.render.bind(view);

  view.render = async (...args) => {
    const result = await originalRender(...args);
    const container = view.container || document.getElementById(args[0] || "dashboard-content-area");
    await controller.syncAfterRender(container, gameId || view.gameId || null);
    return result;
  };

  view.liveCaptureStartController = controller;
  return view;
}

if (typeof document !== "undefined" && !document.getElementById("iqbasket-v39-live-start-styles")) {
  const style = document.createElement("style");
  style.id = "iqbasket-v39-live-start-styles";
  style.textContent = `
    .v39-live-start-gate{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 10px;padding:11px 12px;border:1px solid #fdba74;border-radius:13px;background:#fff7ed;color:#9a3412}.v39-live-start-copy{display:grid;gap:2px;min-width:210px;flex:1}.v39-live-start-copy strong{font-size:13px}.v39-live-start-copy span{font-size:10px;line-height:1.35}.v39-live-start-gate button{min-height:44px;border:0;border-radius:10px;padding:8px 14px;background:#f97316;color:#fff;font-size:12px;font-weight:900}.v39-live-start-gate [data-live-start-feedback]{width:100%;font-size:10px;font-weight:750;color:#9a3412}
  `;
  document.head.appendChild(style);
}

export default LiveCaptureStartController;
