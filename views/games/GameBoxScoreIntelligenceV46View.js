/**
 * @fileoverview V46 read-only extension of the established GameBoxScoreView.
 * @description Preserves the complete V44/V45 BoxScore behavior and injects a
 * deterministic, privacy-preserving team reading from the already-authorized
 * persisted stats. No new write path or permission is introduced.
 */

import { GameBoxScoreView as GameBoxScoreBaseView } from "../GameBoxScoreBaseView.js";
import { buildGameIntelligence } from "../../domain/intelligence/GameIntelligenceEngine.js";
import { normalizeGameStatsForIntelligence } from "../../domain/intelligence/GameIntelligenceInputAdapter.js";
import { renderGameIntelligencePanel } from "../components/GameIntelligencePanelV46.js";

/**
 * Keep delegated capture inside its authorized workspace while normal team
 * users return to the complete game list after a successful save.
 * @param {boolean} isGameScopedOnly
 * @returns {string}
 */
export function resolveBoxScorePostSaveDestination(isGameScopedOnly = false) {
  return isGameScopedOnly ? "#/dashboard" : "#/games";
}

/**
 * The legacy BoxScore implementation confirms a successful persistence by
 * disabling Save and then re-rendering the same game. A failed save re-enables
 * the button and never calls render, so this predicate does not redirect errors.
 * @param {{targetGameId?:string|null, selectedGameId?:string|null, saveButtonDisabled?:boolean}} input
 * @returns {boolean}
 */
export function isConfirmedBoxScoreSaveRerender({
  targetGameId = null,
  selectedGameId = null,
  saveButtonDisabled = false
} = {}) {
  return Boolean(
    targetGameId
    && saveButtonDisabled
    && String(targetGameId) === String(selectedGameId)
  );
}

export class GameBoxScoreIntelligenceV46View extends GameBoxScoreBaseView {
  /**
   * Preserve the public render contract while converting the parent's
   * post-save re-render into the requested return to Partidos. The underlying
   * save completes before the parent invokes this render again.
   */
  async render(containerId = "dashboard-content-area", targetGameId = null) {
    const container = document.getElementById(containerId);
    const saveButton = container?.querySelector("#btn-save-boxscore");

    if (isConfirmedBoxScoreSaveRerender({
      targetGameId,
      selectedGameId: this.selectedGameId,
      saveButtonDisabled: Boolean(saveButton?.disabled)
    })) {
      window.location.hash = resolveBoxScorePostSaveDestination(this.isGameScopedOnly);
      return;
    }

    return super.render(containerId, targetGameId);
  }

  _renderGameBoxScoreDetail(container, containerId) {
    const result = super._renderGameBoxScoreDetail(container, containerId);
    this._injectGameIntelligence(container);
    return result;
  }

  /**
   * UI enhancement only. The parent view remains the authority for loading,
   * RBAC gating, RLS-backed scoped reads and BoxScore persistence.
   * @param {HTMLElement} container
   */
  _injectGameIntelligence(container) {
    if (!container || !Array.isArray(this.gameStats)) return;

    try {
      container.querySelector("#game-intelligence-v46")?.remove();

      const canonicalStats = normalizeGameStatsForIntelligence(this.gameStats);
      const intelligence = buildGameIntelligence({ playerStats: canonicalStats });
      const markup = renderGameIntelligencePanel({
        intelligence,
        t: (key, fallback) => this.t(key, fallback)
      });

      // Detail has a single BoxScore table shell. Insert immediately before it
      // so the reading remains visible without interfering with editable rows.
      const tableShell = container.querySelector("table")?.parentElement;
      if (!tableShell) return;
      tableShell.insertAdjacentHTML("beforebegin", markup);
    } catch (error) {
      // Intelligence is additive: a malformed legacy row must never make the
      // underlying BoxScore unavailable. Keep failure isolated to this panel.
      console.warn("[GameIntelligenceV46] Read-only panel unavailable", error);
    }
  }
}

export default GameBoxScoreIntelligenceV46View;
