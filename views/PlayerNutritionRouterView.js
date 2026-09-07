/**
 * @fileoverview Subject-aware entry point for the general Nutrition navigation item.
 * @description Player and Family never enter the team-level nutrition selector:
 * the route resolves to the authorized Player 360 subject and opens the Wellness
 * tab directly. Staff keeps the existing NutritionView. Backend privacy/RLS
 * remains authoritative.
 */

import { UserRole } from "../security/roles.js";

export class PlayerNutritionRouterView {
  constructor(supabaseClient = null, authController = null, staffView = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.staffView = staffView;
    this.subjectView = null;
  }

  _subjectPlayerId(requestedPlayerId = null, role = null) {
    const user = this.auth?.getCurrentUser?.() || null;
    const ownPlayerId = user?.playerId || user?.player_id || user?.linked_player_id || null;
    const linkedPlayerIds = Array.isArray(user?.linkedPlayerIds)
      ? user.linkedPlayerIds.map(String).filter(Boolean)
      : [];

    if (role === UserRole.JUGADOR) return ownPlayerId || linkedPlayerIds[0] || null;

    if (role === UserRole.FAMILIA_TUTOR) {
      const requested = requestedPlayerId ? String(requestedPlayerId) : null;
      if (requested && linkedPlayerIds.includes(requested)) return requested;
      if (ownPlayerId && linkedPlayerIds.includes(String(ownPlayerId))) return ownPlayerId;
      return linkedPlayerIds[0] || ownPlayerId || null;
    }

    return null;
  }

  async _staffView() {
    if (this.staffView) return this.staffView;
    const { NutritionView } = await import("./NutritionView.js");
    this.staffView = new NutritionView(this.supabase, this.auth);
    return this.staffView;
  }

  async _subjectView() {
    if (this.subjectView) return this.subjectView;
    const { Player360View } = await import("./Player360View.js");
    this.subjectView = new Player360View(this.supabase, this.auth);
    return this.subjectView;
  }

  async render(containerId = "dashboard-content-area", playerId = null, teamId = null) {
    const role = this.auth?.getAuthenticatedRole?.();
    const isSubjectScoped = role === UserRole.JUGADOR || role === UserRole.FAMILIA_TUTOR;

    if (!isSubjectScoped) {
      const view = await this._staffView();
      return view.render(containerId, playerId, teamId);
    }

    const container = document.getElementById(containerId);
    const subjectPlayerId = this._subjectPlayerId(playerId, role);
    const isFamily = role === UserRole.FAMILIA_TUTOR;

    if (!subjectPlayerId) {
      if (container) {
        container.innerHTML = `
          <section style="max-width:760px;margin:0 auto;padding:18px;font-family:var(--font-family-base,system-ui);">
            <div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#64748b;line-height:1.5;">
              🔒 Nutrición forma parte de Player 360, pero esta cuenta todavía no tiene ${isFamily ? "un jugador vinculado" : "un jugador propio vinculado"}.
            </div>
          </section>`;
      }
      return;
    }

    if (container) {
      container.innerHTML = `
        <section style="max-width:760px;margin:0 auto;padding:18px;font-family:var(--font-family-base,system-ui);">
          <div style="padding:18px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff;color:#1e3a8a;font-weight:800;">
            🥤 Abriendo Nutrición ${isFamily ? "del jugador vinculado" : "dentro de tu Player 360"}…
          </div>
        </section>`;
    }

    // Do not redirect to the generic Player360 route: that route selects the
    // first available tab and previously landed Family on "Plan semanal". The
    // Nutrition navigation must deterministically render Wellness.
    const view = await this._subjectView();
    view.activeTab = "wellness";
    return view.render(containerId, subjectPlayerId, teamId);
  }
}

export default PlayerNutritionRouterView;
