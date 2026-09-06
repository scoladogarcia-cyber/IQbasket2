/**
 * @fileoverview Progressive live-writer lease controller for the existing HUD.
 * @description Keeps concurrency UX outside LiveScoreHUDView. The backend V28
 * lease remains authoritative; this controller only reflects ownership, blocks
 * unsafe local interaction while ownership is unresolved, renews heartbeats and
 * exposes secure one-use handoff controls.
 */

import { GameLiveSessionService } from "../../services/games/GameLiveSessionService.js";

const LIVE_HUD_MARKER = "#btn-hud-finish";
const PANEL_SELECTOR = "[data-live-writer-lease-panel]";
const WRITER_CONTROL_SELECTOR = [
  ".btn-action-shot",
  ".btn-action-direct",
  ".btn-opp-action",
  ".btn-period-hud",
  ".btn-remove-ot",
  "#btn-add-ot",
  "#btn-hud-undo",
  "#btn-hud-redo",
  "#btn-hud-subs",
  "#btn-hud-finish"
].join(",");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatExpiry(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export class LiveWriterLeaseController {
  constructor(supabaseClient = null) {
    this.service = new GameLiveSessionService(supabaseClient);
    this.gameId = null;
    this.container = null;
    this.heartbeatTimer = null;
    this.generation = 0;
    this.supported = null;
    this.ownsLease = false;
  }

  /**
   * Called after every LiveScoreHUDView render.
   * It synchronously disables writer controls before any network request.
   */
  async syncAfterRender(container, gameId) {
    this.container = container || null;
    const normalizedGameId = String(gameId || "").trim() || null;

    if (!normalizedGameId || !this._isHudVisible()) {
      this._stopHeartbeat();
      this.gameId = normalizedGameId;
      this.ownsLease = false;
      return;
    }

    const changedGame = this.gameId && this.gameId !== normalizedGameId;
    if (changedGame) this._stopHeartbeat();
    this.gameId = normalizedGameId;
    const generation = ++this.generation;

    this._setWriterControlsEnabled(false);
    this._renderLoading();

    try {
      const storedToken = this.service.getStoredToken(this.gameId);
      const status = await this.service.getStatus(this.gameId);
      if (!this._isCurrent(generation)) return;

      if (status.supported === false) {
        this.supported = false;
        this.ownsLease = false;
        this._setWriterControlsEnabled(true);
        this._renderLegacyMode();
        return;
      }

      this.supported = true;

      // A tab that already owns the lease proves ownership by heartbeat. Status
      // alone is intentionally insufficient because another tab may use the same
      // authenticated user.
      if (status.active && status.is_mine && storedToken) {
        try {
          const renewed = await this.service.heartbeat({
            gameId: this.gameId,
            leaseToken: storedToken
          });
          if (!this._isCurrent(generation)) return;
          this._activateOwnedLease(renewed);
          return;
        } catch {
          // Token may have been rotated by handoff/takeover. Continue with a
          // fresh status check rather than trusting stale local storage.
        }
      }

      const refreshed = await this.service.getStatus(this.gameId);
      if (!this._isCurrent(generation)) return;

      if (refreshed.active) {
        this.ownsLease = false;
        this._setWriterControlsEnabled(false);
        this._renderBlocked(refreshed);
        return;
      }

      const acquired = await this.service.acquire({ gameId: this.gameId });
      if (!this._isCurrent(generation)) return;

      if (acquired.supported === false) {
        this.supported = false;
        this._setWriterControlsEnabled(true);
        this._renderLegacyMode();
        return;
      }

      this._activateOwnedLease(acquired);
    } catch (error) {
      if (!this._isCurrent(generation)) return;
      this.ownsLease = false;
      this._setWriterControlsEnabled(false);
      this._renderError(error);
    }
  }

  destroy() {
    this.generation += 1;
    this._stopHeartbeat();
    this.container = null;
    this.gameId = null;
    this.ownsLease = false;
  }

  _isCurrent(generation) {
    return generation === this.generation && this._isHudVisible();
  }

  _isHudVisible() {
    return Boolean(this.container?.querySelector?.(LIVE_HUD_MARKER));
  }

  _controls() {
    return this.container?.querySelectorAll?.(WRITER_CONTROL_SELECTOR) || [];
  }

  _setWriterControlsEnabled(enabled) {
    this._controls().forEach(control => {
      if (enabled) {
        if (control.dataset.liveWriterWasDisabled !== "true") control.disabled = false;
        delete control.dataset.liveWriterBlocked;
        delete control.dataset.liveWriterWasDisabled;
        control.removeAttribute("aria-describedby");
      } else {
        if (control.dataset.liveWriterBlocked !== "true") {
          control.dataset.liveWriterWasDisabled = String(Boolean(control.disabled));
        }
        control.dataset.liveWriterBlocked = "true";
        control.disabled = true;
        control.setAttribute("aria-describedby", "live-writer-lease-status");
      }
    });
  }

  _panel() {
    if (!this.container) return null;
    let panel = this.container.querySelector(PANEL_SELECTOR);
    if (panel) return panel;

    const hudMarker = this.container.querySelector(LIVE_HUD_MARKER);
    const hudRoot = hudMarker?.closest?.("div[style*='max-width: 1400px']") || hudMarker?.parentElement?.parentElement;
    if (!hudRoot) return null;

    panel = document.createElement("section");
    panel.dataset.liveWriterLeasePanel = "true";
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = [
      "background:#f8fafc",
      "border:1px solid #cbd5e1",
      "border-radius:10px",
      "padding:10px 12px",
      "margin-bottom:12px",
      "color:#334155",
      "font:600 12px/1.4 system-ui,sans-serif"
    ].join(";");
    hudRoot.prepend(panel);
    return panel;
  }

  _renderLoading() {
    const panel = this._panel();
    if (!panel) return;
    panel.innerHTML = `
      <div id="live-writer-lease-status" role="status">
        🔐 Verificando turno de escritura en vivo…
      </div>`;
  }

  _renderLegacyMode() {
    const panel = this._panel();
    if (!panel) return;
    panel.innerHTML = `
      <div id="live-writer-lease-status" role="status" style="color:#475569;">
        ℹ️ Captura compatible: el control de escritor único todavía no está activado en este entorno.
      </div>`;
  }

  _renderOwned(state = {}) {
    const panel = this._panel();
    if (!panel) return;
    const expiry = formatExpiry(state.lease_expires_at);
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div id="live-writer-lease-status" role="status" style="color:#166534;">
          ✅ Tienes el turno de escritura${expiry ? ` · renovado hasta ${escapeHtml(expiry)}` : ""}.
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" data-live-writer-handoff-create style="min-height:44px;border:0;border-radius:8px;background:#1e3a8a;color:#fff;font-weight:800;padding:8px 12px;cursor:pointer;">
            Transferir captura
          </button>
          <button type="button" data-live-writer-release style="min-height:44px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:800;padding:8px 12px;cursor:pointer;">
            Liberar turno
          </button>
        </div>
      </div>
      <div data-live-writer-handoff-output hidden style="margin-top:8px;"></div>`;

    panel.querySelector("[data-live-writer-handoff-create]")?.addEventListener("click", () => this._createHandoff());
    panel.querySelector("[data-live-writer-release]")?.addEventListener("click", () => this._release());
  }

  _renderBlocked(state = {}) {
    const panel = this._panel();
    if (!panel) return;
    const writer = state.writer_name || "otro usuario autorizado";
    const expiry = formatExpiry(state.lease_expires_at);
    const sameUser = Boolean(state.is_mine);
    panel.innerHTML = `
      <div id="live-writer-lease-status" role="status" style="color:#92400e;margin-bottom:8px;">
        🔒 ${sameUser ? "Tu usuario ya tiene este turno abierto en otra pestaña o dispositivo" : `La captura está siendo editada por ${escapeHtml(writer)}`}${expiry ? ` · lease hasta ${escapeHtml(expiry)}` : ""}.
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" inputmode="text" autocomplete="off" data-live-writer-handoff-input aria-label="Código de traspaso de captura" placeholder="Código de traspaso" style="min-height:44px;min-width:220px;flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;color:#0f172a;background:#fff;">
        <button type="button" data-live-writer-handoff-accept style="min-height:44px;border:0;border-radius:8px;background:#1e3a8a;color:#fff;font-weight:800;padding:8px 12px;cursor:pointer;">
          Aceptar traspaso
        </button>
        <button type="button" data-live-writer-refresh style="min-height:44px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:800;padding:8px 12px;cursor:pointer;">
          Reintentar
        </button>
      </div>`;

    panel.querySelector("[data-live-writer-handoff-accept]")?.addEventListener("click", () => this._acceptHandoff());
    panel.querySelector("[data-live-writer-refresh]")?.addEventListener("click", () => this.syncAfterRender(this.container, this.gameId));
  }

  _renderError(error) {
    const panel = this._panel();
    if (!panel) return;
    panel.innerHTML = `
      <div id="live-writer-lease-status" role="alert" style="color:#991b1b;margin-bottom:8px;">
        ⚠️ ${escapeHtml(error?.message || error || "No se pudo validar el turno de escritura.")}
      </div>
      <button type="button" data-live-writer-refresh style="min-height:44px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#991b1b;font-weight:800;padding:8px 12px;cursor:pointer;">
        Reintentar
      </button>`;
    panel.querySelector("[data-live-writer-refresh]")?.addEventListener("click", () => this.syncAfterRender(this.container, this.gameId));
  }

  _activateOwnedLease(state) {
    this.ownsLease = true;
    this._setWriterControlsEnabled(true);
    this._renderOwned(state);
    this._startHeartbeat();
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    if (!this.gameId || !this.ownsLease || this.supported === false) return;
    this.heartbeatTimer = globalThis.setInterval?.(() => {
      this._heartbeat().catch(() => {});
    }, 30_000) || null;
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) globalThis.clearInterval?.(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  async _heartbeat() {
    if (!this.gameId || !this.ownsLease || !this._isHudVisible()) return;
    try {
      const renewed = await this.service.heartbeat({ gameId: this.gameId });
      if (renewed.supported === false) {
        this.supported = false;
        this.ownsLease = false;
        this._stopHeartbeat();
        this._setWriterControlsEnabled(true);
        this._renderLegacyMode();
        return;
      }
      this._renderOwned(renewed);
    } catch (error) {
      this.ownsLease = false;
      this._stopHeartbeat();
      this._setWriterControlsEnabled(false);
      this._renderError(error);
    }
  }

  async _createHandoff() {
    const panel = this._panel();
    const output = panel?.querySelector("[data-live-writer-handoff-output]");
    try {
      const result = await this.service.createHandoff({ gameId: this.gameId });
      if (result.supported === false) throw new Error("El traspaso aún no está activado en este entorno.");
      if (!result.handoff_token) throw new Error("No se recibió un código de traspaso.");
      if (output) {
        output.hidden = false;
        output.innerHTML = `
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 10px;color:#1e3a8a;">
            Código temporal: <strong style="user-select:all;word-break:break-all;">${escapeHtml(result.handoff_token)}</strong>
            <span style="display:block;color:#475569;font-weight:500;margin-top:3px;">Compártelo sólo con el usuario autorizado que va a continuar la captura. Caduca en unos minutos y sólo puede usarse una vez.</span>
          </div>`;
      }
    } catch (error) {
      if (output) {
        output.hidden = false;
        output.innerHTML = `<span role="alert" style="color:#991b1b;">${escapeHtml(error?.message || error)}</span>`;
      }
    }
  }

  async _acceptHandoff() {
    const panel = this._panel();
    const input = panel?.querySelector("[data-live-writer-handoff-input]");
    const token = String(input?.value || "").trim();
    if (!token) {
      input?.focus();
      return;
    }
    this._setWriterControlsEnabled(false);
    try {
      const accepted = await this.service.acceptHandoff({
        gameId: this.gameId,
        handoffToken: token
      });
      if (accepted.supported === false) throw new Error("El traspaso aún no está activado en este entorno.");
      this._activateOwnedLease(accepted);
    } catch (error) {
      this.ownsLease = false;
      this._setWriterControlsEnabled(false);
      this._renderError(error);
    }
  }

  async _release() {
    if (!this.gameId || !this.ownsLease) return;
    this._setWriterControlsEnabled(false);
    try {
      await this.service.release({
        gameId: this.gameId,
        reason: "Released from live capture UI"
      });
      this.ownsLease = false;
      this._stopHeartbeat();
      const status = await this.service.getStatus(this.gameId);
      if (status.supported === false) {
        this._setWriterControlsEnabled(true);
        this._renderLegacyMode();
        return;
      }
      this._renderBlocked({
        ...status,
        active: status.active,
        writer_name: status.writer_name
      });
    } catch (error) {
      this.ownsLease = false;
      this._stopHeartbeat();
      this._setWriterControlsEnabled(false);
      this._renderError(error);
    }
  }
}

/**
 * Decorate an existing LiveScoreHUDView instance without changing its business
 * logic. Internal calls to `this.render()` also pass through this wrapper.
 */
export function attachLiveWriterLease(view, supabaseClient = null, gameId = null) {
  if (!view || view.__liveWriterLeaseAttached) return view;
  view.__liveWriterLeaseAttached = true;

  const controller = new LiveWriterLeaseController(supabaseClient);
  const originalRender = view.render.bind(view);

  view.render = async (...args) => {
    const result = await originalRender(...args);
    const container = view.container || document.getElementById(args[0] || "dashboard-content-area");
    await controller.syncAfterRender(container, gameId || view.gameId || null);
    return result;
  };

  view.liveWriterLeaseController = controller;
  return view;
}

export default LiveWriterLeaseController;
