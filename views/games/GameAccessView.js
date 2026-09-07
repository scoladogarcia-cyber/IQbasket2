/**
 * @fileoverview Access-aware entry point for the Partidos route.
 * @description Users with a real team-season scope keep the full
 * GameLiveEditorView. Users whose effective authority for the selected season
 * comes only from V21 per-game delegation receive a minimal delegated-game
 * landing instead of team-wide game data.
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

  /**
   * Distinguishes a real contextual team-season scope from legacy team-only
   * compatibility. A stale `assigned_team_ids` entry must never mask a valid
   * per-game delegation, otherwise delegated Family/guest users are routed to
   * the team-wide editor and cannot see their assigned game.
   */
  _hasNormalTeamSeasonScope(teamId, teamSeasonId = null) {
    if (!teamId || typeof this.auth?.canAccessTeam !== "function") return false;
    if (!this.auth.canAccessTeam(teamId)) return false;

    if (teamSeasonId && typeof this.auth?.canAccessTeamSeason === "function") {
      return Boolean(this.auth.canAccessTeamSeason(teamSeasonId));
    }

    // Compatibility for old contexts that genuinely do not expose a
    // team-season identifier. Modern routes should normally resolve one.
    return true;
  }

  async render(containerId = "dashboard-content-area", gameId = null, teamId = null) {
    const resolvedTeamId = teamId || DataStore.getActiveTeamId?.() || null;
    const resolvedTeamSeasonId = DataStore.getActiveTeamSeasonId?.() || null;

    // A specific game opened through the team editor keeps the historical path.
    // Delegated capture and BoxScore use their dedicated /live/:id and
    // /boxscore/:id routes, where V21/V28 enforce resource-level authority.
    if (gameId) {
      const view = await this._fullView();
      return view.render(containerId, gameId, resolvedTeamId);
    }

    if (!this._hasNormalTeamSeasonScope(resolvedTeamId, resolvedTeamSeasonId)) {
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