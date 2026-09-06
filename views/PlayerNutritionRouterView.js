/**
 * @fileoverview Role-aware entry point for the general Nutrition navigation item.
 * @description A player never enters the team-level nutrition selector: the route
 * resolves directly to their own Player 360. Staff keeps the existing NutritionView.
 */

import { UserRole } from "../security/roles.js";

export class PlayerNutritionRouterView {
  constructor(supabaseClient = null, authController = null, staffView = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.staffView = staffView;
  }

  _ownPlayerId() {
    const user = this.auth?.getCurrentUser?.() || null;
    return user?.playerId || user?.player_id || user?.linkedPlayerIds?.[0] || null;
  }

  async _staffView() {
    if (this.staffView) return this.staffView;
    const { NutritionView } = await import("./NutritionView.js");
    this.staffView = new NutritionView(this.supabase, this.auth);
    return this.staffView;
  }

  async render(containerId = "dashboard-content-area", playerId = null, teamId = null) {
    const role = this.auth?.getAuthenticatedRole?.();
    if (role !== UserRole.JUGADOR) {
      const view = await this._staffView();
      return view.render(containerId, playerId, teamId);
    }

    const container = document.getElementById(containerId);
    const ownPlayerId = this._ownPlayerId();
    if (!ownPlayerId) {
      if (container) {
        container.innerHTML = `
          <section style="max-width:760px;margin:0 auto;padding:18px;font-family:var(--font-family-base,system-ui);">
            <div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#64748b;line-height:1.5;">
              🔒 Nutrición forma parte de tu Player 360, pero tu cuenta todavía no tiene un jugador propio vinculado.
            </div>
          </section>`;
      }
      return;
    }

    if (container) {
      container.innerHTML = `
        <section style="max-width:760px;margin:0 auto;padding:18px;font-family:var(--font-family-base,system-ui);">
          <div style="padding:18px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-weight:800;">
            🥤 Abriendo Nutrición dentro de tu Player 360…
          </div>
        </section>`;
    }

    const target = `#/player360/${encodeURIComponent(String(ownPlayerId))}`;
    if (window.location.hash !== target) window.location.hash = target;
  }
}

export default PlayerNutritionRouterView;
