/**
 * @fileoverview Role/resource-aware game list for IQBasket capture modes.
 * @description Keeps broad game editing separate from resource-scoped capture
 * capabilities, V39 spectator mode and V40 confirmed destructive deletion.
 * Delegated users never receive EDIT_GAME or CREATE_GAME as a side effect of
 * capture access.
 */
import { Permission } from "../../security/PermissionService.js";
import { DataStore } from "../../services/DataStore.js";
import { GameDeletionServiceV40 } from "../../services/games/GameDeletionServiceV40.js";
import { GameLiveEditorView } from "../GameLiveEditorView.js";
import { LiveGameSetupV39View } from "./LiveGameSetupV39View.js";

function modeButtonStyle(kind = "quick") {
  const styles = {
    live: "background:#1e3a8a;color:#fff;border:1px solid #1e3a8a;",
    quick: "background:#fff7ed;color:#9a3412;border:1px solid #fdba74;",
    spectator: "background:#ecfeff;color:#155e75;border:1px solid #67e8f9;",
    scope: "background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;"
  };
  return `${styles[kind] || styles.quick}padding:8px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;min-height:44px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;`;
}

function boxScoreButtonOf(card) {
  return [...card.querySelectorAll("button,a")].find(node => {
    const route = `${node.getAttribute("href") || ""} ${node.getAttribute("onclick") || ""}`;
    return route.includes("#/boxscore/");
  }) || null;
}

function gameIdFromBoxScore(node) {
  if (!node) return null;
  const route = `${node.getAttribute("href") || ""} ${node.getAttribute("onclick") || ""}`;
  const match = route.match(/#\/boxscore\/([0-9a-f-]{36})/i);
  return match?.[1] || null;
}

export class GameCaptureModesView extends GameLiveEditorView {
  constructor(gameController, authController) {
    super(gameController, authController);
    this.gameDeletionService = new GameDeletionServiceV40(this.supabase);
  }

  _can(permission, game = {}) {
    return Boolean(this.auth?.canPreview?.(permission, this._gameContext(game)));
  }

  /**
   * The legacy list remains authoritative for normal staff operations. After it
   * renders, this extension adapts only capture/streaming/destructive actions.
   */
  async _renderGamesList(container, teamId) {
    await super._renderGamesList(container, teamId);
    this._decorateConfirmedDeletion(container, teamId);
    this._decorateCaptureModes(container, teamId);
    this._decorateNewLiveGame(container, teamId);
  }

  /**
   * Removes the legacy optimistic delete listener by cloning each button.
   * The card disappears only after the database RPC confirms the transaction.
   */
  _decorateConfirmedDeletion(container, teamId) {
    container.querySelectorAll(".btn-delete-game-direct[data-id]").forEach(legacyButton => {
      const button = legacyButton.cloneNode(true);
      legacyButton.replaceWith(button);

      button.addEventListener("click", async event => {
        event.preventDefault();
        const id = String(event.currentTarget.dataset.id || "");
        const game = this.games.find(row => String(row.id) === id) || null;
        if (!game || !this._canDeleteGame(game)) return;

        const opponent = game.opponent || game.opponent_name || game.opponentName || "Rival";
        if (!confirm(`¿Eliminar definitivamente el partido contra ${opponent}? Se borrarán sus estadísticas y jugadas asociadas. Esta acción no se puede deshacer.`)) return;

        const currentButton = event.currentTarget;
        currentButton.disabled = true;
        try {
          await this.gameDeletionService.deleteGame({
            gameId: id,
            reason: "Eliminación confirmada desde la lista de partidos"
          });

          // Remote-first: refresh from the source of truth only after confirmation.
          DataStore.isLoaded = false;
          await DataStore.init(teamId, true);
          this.games = DataStore.getGames(teamId) || [];
          await this._renderGamesList(container, teamId);
          alert("✅ Partido eliminado definitivamente.");
        } catch (error) {
          console.error("[GameCaptureModesView] Error eliminando partido:", error);
          alert(`❌ ${error.message || error}`);
          currentButton.disabled = false;
        }
      });
    });
  }

  _decorateNewLiveGame(container, teamId) {
    const legacyButton = container.querySelector("#btn-create-game-hud");
    if (!legacyButton) return;

    // Clone removes the legacy listener that launched an in-memory HUD without
    // gameId. V39 always persists first so lease/live sync/followers are valid.
    const button = legacyButton.cloneNode(true);
    legacyButton.replaceWith(button);

    const context = { teamId };
    const canLaunch = !this._isTeamSeasonFrozen(teamId)
      && Boolean(this.auth?.canPreview?.(Permission.CREATE_GAME, context))
      && Boolean(this.auth?.canPreview?.(Permission.RECORD_LIVE_GAME, context))
      && Boolean(this.auth?.canPreview?.(Permission.PREPARE_GAME, context))
      && Boolean(this.auth?.canPreview?.(Permission.START_GAME, context));

    button.textContent = `⚡ Nuevo partido en vivo${canLaunch ? "" : " 🔒"}`;
    button.disabled = !canLaunch;
    button.setAttribute("aria-disabled", String(!canLaunch));
    button.style.cursor = canLaunch ? "pointer" : "not-allowed";
    button.style.opacity = canLaunch ? "1" : ".58";

    button.addEventListener("click", () => {
      if (!canLaunch) return;
      const setup = new LiveGameSetupV39View(this.supabase, this.auth);
      setup.render("dashboard-content-area", teamId);
    });
  }

  _decorateCaptureModes(container, teamId) {
    container.querySelectorAll(".game-item-card").forEach(card => {
      const editButton = card.querySelector(".btn-open-court-direct[data-id]");
      const existingLiveButton = card.querySelector(".btn-live-existing-game[data-id]");
      const boxScoreButton = boxScoreButtonOf(card);
      const gameId = editButton?.dataset.id
        || existingLiveButton?.dataset.id
        || gameIdFromBoxScore(boxScoreButton)
        || null;
      const game = this.games.find(row => String(row.id) === String(gameId));
      if (!game) return;

      const locked = this._isGameLocked(game) || this._isTeamSeasonFrozen(teamId);
      const canEditGame = !locked && this._can(Permission.EDIT_GAME, game);
      const canLive = !locked && this._can(Permission.RECORD_LIVE_GAME, game);
      const canQuick = !locked && this._can(Permission.RECORD_QUICK_GAME, game);
      const canActa = !locked && this._can(Permission.EDIT_BOXSCORE, game);
      const canViewBox = this._can(Permission.VIEW_BOXSCORE, game);
      const hasCaptureScope = canLive || canQuick || canActa;
      const actions = editButton?.parentElement
        || existingLiveButton?.parentElement
        || boxScoreButton?.parentElement
        || null;
      if (!actions) return;

      if (editButton && !canEditGame) editButton.remove();

      let liveButton = actions.querySelector(".btn-live-existing-game");
      if (canLive) {
        if (liveButton) {
          liveButton.textContent = "⚡ Anotación en vivo";
          liveButton.removeAttribute("disabled");
        } else {
          liveButton = document.createElement("a");
          liveButton.href = `#/live/${encodeURIComponent(String(game.id))}`;
          liveButton.dataset.liveCaptureId = String(game.id);
          liveButton.setAttribute("style", modeButtonStyle("live"));
          liveButton.textContent = "⚡ Anotación en vivo";
          if (boxScoreButton) actions.insertBefore(liveButton, boxScoreButton);
          else actions.prepend(liveButton);
        }
      } else if (liveButton) {
        liveButton.remove();
      }

      if (boxScoreButton) {
        boxScoreButton.textContent = canActa ? "📋 Acta / BoxScore" : "📋 BoxScore";
      }

      if (canViewBox && !actions.querySelector(`[data-live-view-id="${CSS.escape(String(game.id))}"]`)) {
        const spectator = document.createElement("a");
        spectator.href = `#/boxscore/${encodeURIComponent(String(game.id))}/live`;
        spectator.dataset.liveViewId = String(game.id);
        spectator.setAttribute("style", modeButtonStyle("spectator"));
        spectator.textContent = "📡 Marcador / Acta";
        if (boxScoreButton) actions.insertBefore(spectator, boxScoreButton);
        else actions.appendChild(spectator);
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
