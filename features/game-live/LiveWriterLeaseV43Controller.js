/**
 * @fileoverview V43 live-writer UX adapter.
 * @description Preserves the V28 server-authoritative lease while adding a
 * same-user recovery path, explicit route cleanup and HUD-rerender resilience.
 * Recovery rotates the old token, therefore only one tab can keep writing.
 */

import { LiveWriterLeaseController } from "./LiveWriterLeaseController.js";
import { GameLiveSessionV43Service } from "../../services/games/GameLiveSessionV43Service.js";

const LIVE_ROUTES = new Set(["live", "hud", "live-hud"]);

function currentLiveRoute() {
  if (typeof window === "undefined") return { route: "", gameId: null };
  const parts = String(window.location?.hash || "")
    .replace(/^#\//, "")
    .split("/");
  return {
    route: String(parts[0] || "").toLowerCase(),
    gameId: parts[1] || null
  };
}

export class LiveWriterLeaseV43Controller extends LiveWriterLeaseController {
  constructor(supabaseClient = null) {
    super(supabaseClient);
    this.service = new GameLiveSessionV43Service(supabaseClient);
    this.lastOwnedState = null;
  }

  _activateOwnedLease(state = {}) {
    this.lastOwnedState = { ...state };
    super._activateOwnedLease(state);
  }

  /** Restore the lease panel after the HUD replaces its own innerHTML. */
  restoreAfterHudRender() {
    if (!this._isHudVisible()) return;
    if (this.ownsLease && this.service.getStoredToken(this.gameId)) {
      this._setWriterControlsEnabled(true);
      this._renderOwned(this.lastOwnedState || {});
      return;
    }
    void this.syncAfterRender(this.container, this.gameId);
  }

  _renderBlocked(state = {}) {
    if (!state.is_mine) {
      super._renderBlocked(state);
      return;
    }

    const panel = this._panel();
    if (!panel) return;
    panel.innerHTML = `
      <div id="live-writer-lease-status" role="status" style="color:#92400e;margin-bottom:8px;">
        🔒 Tu usuario conserva este turno, pero esta pestaña ha perdido la credencial local de escritura.
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button type="button" data-live-writer-recover-own style="min-height:44px;border:0;border-radius:8px;background:#1e3a8a;color:#fff;font-weight:800;padding:8px 12px;cursor:pointer;">
          Recuperar mi turno
        </button>
        <button type="button" data-live-writer-refresh style="min-height:44px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-weight:800;padding:8px 12px;cursor:pointer;">
          Reintentar
        </button>
      </div>
      <p style="margin:8px 0 0;color:#64748b;font-weight:500;">
        Recuperar invalida el token anterior para mantener un único anotador activo.
      </p>`;

    panel.querySelector("[data-live-writer-recover-own]")
      ?.addEventListener("click", () => this._recoverOwn());
    panel.querySelector("[data-live-writer-refresh]")
      ?.addEventListener("click", () => this.syncAfterRender(this.container, this.gameId));
  }

  async _recoverOwn() {
    if (!this.gameId) return;
    this._setWriterControlsEnabled(false);
    this._renderLoading();
    try {
      const recovered = await this.service.recoverOwn({ gameId: this.gameId });
      this._activateOwnedLease(recovered);
    } catch (error) {
      this.ownsLease = false;
      this._setWriterControlsEnabled(false);
      this._renderError(error);
    }
  }

  async releaseForNavigation(reason = "Navigation away from live capture") {
    if (!this.gameId) return;
    this._stopHeartbeat();
    const token = this.service.getStoredToken(this.gameId);
    if (!token) {
      this.ownsLease = false;
      return;
    }
    try {
      await this.service.release({
        gameId: this.gameId,
        leaseToken: token,
        reason
      });
      this.ownsLease = false;
      this.lastOwnedState = null;
    } catch {
      // Do not block navigation. A later same-user recovery rotates this token.
      this.ownsLease = false;
    }
  }
}

/**
 * Decorates the scorer without modifying sporting logic. Internal `_renderHUD`
 * calls also restore the lease UI, fixing the old wrapper's render-only gap.
 */
export function attachLiveWriterLeaseV43(view, supabaseClient = null, gameId = null) {
  if (!view || view.__liveWriterLeaseV43Attached) return view;
  view.__liveWriterLeaseV43Attached = true;
  view.__liveWriterLeaseAttached = true;

  const controller = new LiveWriterLeaseV43Controller(supabaseClient);
  const originalRender = view.render.bind(view);
  const originalHudRender = typeof view._renderHUD === "function"
    ? view._renderHUD.bind(view)
    : null;
  let syncScheduled = false;

  const restoreLeaseUi = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    queueMicrotask(() => {
      syncScheduled = false;
      const container = view.container || document.getElementById("dashboard-content-area");
      controller.container = container || null;
      controller.gameId = String(gameId || view.gameId || "").trim() || null;
      controller.restoreAfterHudRender();
    });
  };

  if (originalHudRender) {
    view._renderHUD = (...args) => {
      const result = originalHudRender(...args);
      restoreLeaseUi();
      return result;
    };
  }

  view.render = async (...args) => {
    const result = await originalRender(...args);
    const container = view.container || document.getElementById(args[0] || "dashboard-content-area");
    await controller.syncAfterRender(container, gameId || view.gameId || null);
    return result;
  };

  const releaseOnRouteChange = () => {
    const next = currentLiveRoute();
    const activeGameId = String(gameId || view.gameId || "");
    const sameCapture = LIVE_ROUTES.has(next.route)
      && String(next.gameId || "") === activeGameId;
    if (sameCapture) return;
    window.removeEventListener("hashchange", releaseOnRouteChange);
    void controller.releaseForNavigation();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", releaseOnRouteChange);
  }

  view.liveWriterLeaseController = controller;
  view.releaseLiveWriterLease = reason => controller.releaseForNavigation(reason);
  return view;
}

export default LiveWriterLeaseV43Controller;
