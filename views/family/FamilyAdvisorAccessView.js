/**
 * @fileoverview Role-aware entry point for Familias & Bienestar.
 * @description Staff with the narrow Family invitation capability receives the
 * onboarding workspace; all other roles keep the existing FamilyAdvisorView.
 */

import { DataStore } from "../../services/DataStore.js";
import { Permission } from "../../security/PermissionService.js";

export class FamilyAdvisorAccessView {
  constructor(supabaseClient = null, authController = null) {
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.auth = authController;
    this.staffView = null;
    this.advisorView = null;
  }

  _context() {
    const teamId = DataStore.getActiveTeamId?.() || null;
    const season = DataStore.getActiveSeasonContext?.(teamId) || null;
    return {
      teamId,
      teamSeasonId: season?.team_season_id
        || season?.teamSeasonId
        || (season?.source === "v3" ? season?.id : null)
        || DataStore.getActiveTeamSeasonId?.(teamId)
        || null
    };
  }

  async _staff() {
    if (this.staffView) return this.staffView;
    const { FamilyStaffView } = await import("./FamilyStaffView.js");
    this.staffView = new FamilyStaffView(this.supabase, this.auth);
    return this.staffView;
  }

  async _advisor() {
    if (this.advisorView) return this.advisorView;
    const { FamilyAdvisorView } = await import("../FamilyAdvisorView.js");
    this.advisorView = new FamilyAdvisorView(this.auth);
    return this.advisorView;
  }

  async render(containerId = "dashboard-content-area", routeParams = {}) {
    const context = this._context();
    if (this.auth?.canPreview?.(Permission.INVITE_FAMILY_LINK, context)) {
      const view = await this._staff();
      return view.render(containerId, routeParams);
    }

    const view = await this._advisor();
    return view.render(containerId, routeParams);
  }
}

export default FamilyAdvisorAccessView;