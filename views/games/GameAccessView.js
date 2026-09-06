/**
 * @fileoverview Access-aware entry point for the Partidos route.
 * @description Users with normal team scope keep the full GameLiveEditorView.
 * Users whose only authority comes from V21 per-game delegation receive a
 * minimal delegated-game landing instead of team-wide game data.
 */

import { DataStore } from "../../services/DataStore.js";
import { GameCaptureDelegationService } from "../../services/games/GameCaptureDelegationService.js";
import { DelegatedGamesView } from "./DelegatedGamesView.js";

export class GameAccessView {
  constructor(gameController, authController, supabaseClient = null) {
    this.gameController = gameController;
    this.auth = authController;
    this.supabase = supabaseClient?.supabase || supabaseClient?.default || supabaseClient;
    this.delegationService = new GameCaptureDelegationService(this.supabase);
    this.delegatedView = new DelegatedGamesView(this.supabase, this.auth);
    this.fullView = null;
  }

  async _fullView() {
    if (this.fullView) return this.fullView;
    const { GameLiveEditorView } = await import("../GameLiveEditorView.js");
    this.fullView = new GameLiveEditorView(this.gameController, this.auth);
    return this.fullView;
  }

  _hasNormalTeamScope(teamId) {
    if (!teamId) return false;
    if (typeof this.auth?.canAccessTeam === "function") {
      return Boolean(this.auth.canAccessTeam(teamId));
    }
    return false;
  }

  async render(containerId = "dashboard-content-area", gameId = null, teamId = null) {
    const resolvedTeamId = teamId || DataStore.getActiveTeamId?.() || null;

    // A specific game opened through the team editor keeps the historical path.
    // Delegated capture and BoxScore use their dedicated /live/:id and /boxscore/:id routes.
    if (gameId) {
      const view = await this._fullView();
      return view.render(containerId, gameId, resolvedTeamId);
    }

    if (!this._hasNormalTeamScope(resolvedTeamId)) {
      let delegations = [];
      try {
        delegations = await this.delegationService.getMyDelegations();
      } catch (error) {
        console.warn("[GameAccessView] No se pudieron refrescar delegaciones V21:", error?.message || error);
      }

      if (delegations.length > 0) {
        return this.delegatedView.render(containerId, delegations);
      }
    }

    const view = await this._fullView();
    return view.render(containerId, gameId, resolvedTeamId);
  }
}

export default GameAccessView;
