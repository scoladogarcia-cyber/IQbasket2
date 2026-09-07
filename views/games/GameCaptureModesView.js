/**
 * @fileoverview Role/resource-aware game list for IQBasket capture modes.
 * @description Keeps broad game editing separate from the three resource-scoped
 * capture capabilities: live play-by-play, quick capture and Acta/BoxScore.
 * Delegated users never receive EDIT_GAME as a side effect of capture access.
 */
import { Permission } from "../../security/PermissionService.js";
import { GameLiveEditorView } from "../GameLiveEditorView.js";

function modeButtonStyle(kind = "quick") {
  const styles = {
    quick: "background:#fff7ed;color:#9a3412;border:1px solid #fdba74;",
    scope: "background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;"
  };
  return `${styles[kind] || styles.quick}padding:8px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;min-height:44px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;`;
}

export class GameCaptureModesView extends GameLiveEditorView {
  _can(permission, game = {}) {
    return Boolean(this.auth?.canPreview?.(permission, this._gameContext(game)));
  }

  /**
   * The legacy list remains authoritative for normal staff operations. After it
   * renders, this extension adapts only the capture actions to the resource-level
   * permissions already enforced by PermissionService and the V21/V30 RPCs.
   */
  async _renderGamesList(container, teamId) {
    await super._renderGamesList(container, teamId);
    this._decorateCaptureModes(container, teamId);
  }

  _decorateCaptureModes(container, teamId) {
    container.querySelectorAll(".game-item-card").forEach(card => {
      const editButton = card.querySelector(".btn-open-court-direct[data-id]");
      const gameId = editButton?.dataset.id
        || card.querySelector(".btn-live-existing-game[data-id]")?.dataset.id
        || null;
      const game = this.games.find(row => String(row.id) === String(gameId));
      if (!game) return;

      const locked = this._isGameLocked(game) || this._isTeamSeasonFrozen(teamId);
      const canEditGame = !locked && this._can(Permission.EDIT_GAME, game);
      const canLive = !locked && this._can(Permission.RECORD_LIVE_GAME, game);
      const canQuick = !locked && this._can(Permission.RECORD_QUICK_GAME, game);
      const canActa = !locked && this._can(Permission.EDIT_BOXSCORE, game);
      const hasCaptureScope = canLive || canQuick || canActa;
      const actions = editButton?.parentElement || card.querySelector(".btn-live-existing-game")?.parentElement;
      if (!actions) return;

      // Broad metadata/game editing is deliberately not implied by capture access.
      // Removing this dead action avoids the misleading EDIT_GAME alert reported
      // by Family users while preserving it for staff who really can edit a game.
      if (editButton && !canEditGame) editButton.remove();

      const liveButton = actions.querySelector(".btn-live-existing-game");
      if (liveButton) {
        if (canLive) {
          liveButton.textContent = "⚡ Anotación en vivo";
          liveButton.removeAttribute("disabled");
        } else {
          liveButton.remove();
        }
      }

      const boxScoreButton = [...actions.querySelectorAll("button")].find(button =>
        String(button.getAttribute("onclick") || "").includes("#/boxscore/")
      );
      if (boxScoreButton) {
        boxScoreButton.textContent = canActa ? "📋 Acta / BoxScore" : "📋 BoxScore";
      }

      if (canQuick && !actions.querySelector(`[data-quick-capture-id="${CSS.escape(String(game.id))}"]`)) {
        const quick = document.createElement("a");
        quick.href = `#/easy-entry/${encodeURIComponent(String(game.id))}`;
        quick.dataset.quickCaptureId = String(game.id);
        quick.setAttribute("style", modeButtonStyle("quick"));
        quick.textContent = "🏀 Partido rápido";

        if (boxScoreButton) actions.insertBefore(quick, boxScoreButton);
        else actions.appendChild(quick);
      }

      if (hasCaptureScope && !card.querySelector(".game-capture-scope-note")) {
        const note = document.createElement("div");
        note.className = "game-capture-scope-note";
        note.setAttribute("style", `${modeButtonStyle("scope")}width:100%;cursor:default;min-height:auto;padding:6px 9px;font-size:10px;`);
        const modes = [
          canLive ? "en vivo" : null,
          canQuick ? "rápido" : null,
          canActa ? "acta" : null
        ].filter(Boolean).join(" · ");
        note.textContent = `🔐 Captura autorizada para este partido: ${modes}`;
        actions.appendChild(note);
      }
    });
  }
}

export default GameCaptureModesView;
