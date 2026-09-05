/**
 * @fileoverview Progressive game play-state controls for live capture surfaces.
 * @description Makes the sporting lifecycle visible without replacing edit_state.
 * Backend RPCs remain authoritative for each transition.
 */

import { DataStore } from "../../services/DataStore.js";
import { supabase } from "../../config/database.config.js";
import { Permission } from "../../security/PermissionService.js";
import { GamePlayStateService } from "../../services/games/GamePlayStateService.js";
import {
  GamePlayState,
  GAME_PLAY_STATE_LABEL,
  normalizeGamePlayState,
  gameLifecycleComposite
} from "../../domain/games/GamePlayStatePolicy.js";

const service = new GamePlayStateService(supabase);
const BAR_ATTR = "data-game-play-state-v2";
let busy = false;

function routeGameId() {
  const match = String(window.location.hash || "").match(/^#\/(?:easy-entry|entrada-facil|live-entry|live|hud|live-hud)\/([0-9a-f-]{36})(?:$|[/?])/i);
  return match?.[1] || null;
}

function currentGame() {
  const gameId = routeGameId();
  if (!gameId) return null;
  return (DataStore.getGames?.() || []).find(game => String(game.id) === String(gameId)) || null;
}

function contextFor(game) {
  if (!game) return null;
  const teamId = game.team_id || game.teamId || DataStore.getActiveTeamId?.() || null;
  const teamSeasonId = game.team_season_id || game.teamSeasonId || DataStore.getActiveTeamSeasonId?.(teamId) || null;
  return { teamId, teamSeasonId, gameId: game.id };
}

function canOperate(game) {
  const context = contextFor(game);
  if (!context?.teamId || !context?.teamSeasonId) return false;
  return Boolean(DataStore.permissionService?.canPreview?.(Permission.RECORD_LIVE_GAME, context));
}

function stateActions(state) {
  switch (state) {
    case GamePlayState.SCHEDULED:
      return [{ to:GamePlayState.READY, label:"Preparar partido", kind:"primary" }];
    case GamePlayState.READY:
      return [
        { to:GamePlayState.SCHEDULED, label:"Volver a programado", kind:"secondary" },
        { to:GamePlayState.LIVE, label:"Iniciar partido", kind:"primary" }
      ];
    case GamePlayState.LIVE:
      return [{ to:GamePlayState.FINISHED, label:"Finalizar partido", kind:"danger" }];
    default:
      return [];
  }
}

function helperText(composite) {
  if (composite.historical) return "Partido finalizado y bloqueado: histórico en solo lectura.";
  if (composite.canCorrect) return "Partido finalizado: las correcciones siguen permitidas hasta cerrar el acta.";
  if (composite.canCapture) return "Partido en juego: captura activa.";
  if (composite.playState === GamePlayState.READY) return "Preparado para empezar; todavía no está en juego.";
  if (composite.playState === GamePlayState.CANCELLED) return "Partido cancelado.";
  return "Partido programado.";
}

function renderBar(root, game) {
  const playState = normalizeGamePlayState(game.play_state || game.playState);
  const editState = String(game.edit_state || game.editState || "OPEN").toUpperCase();
  const composite = gameLifecycleComposite({ playState, editState });
  const actions = editState === "LOCKED" || !canOperate(game) ? [] : stateActions(playState);

  let bar = root.querySelector(`[${BAR_ATTR}]`);
  if (!bar) {
    bar = document.createElement("section");
    bar.setAttribute(BAR_ATTR, "true");
    bar.className = "game-play-state-v2";
    const main = root.querySelector("#entry-main-content");
    if (main) main.insertAdjacentElement("beforebegin", bar);
    else root.prepend(bar);
  }

  bar.dataset.playState = playState;
  bar.dataset.editState = editState;
  bar.innerHTML = `
    <div class="game-play-state-copy">
      <span class="game-play-state-badge">${GAME_PLAY_STATE_LABEL[playState] || playState}</span>
      <div><strong>${helperText(composite)}</strong><small>Estado deportivo y bloqueo de edición son controles independientes.</small></div>
    </div>
    ${actions.length ? `<div class="game-play-state-actions">${actions.map(action => `
      <button type="button" data-game-play-target="${action.to}" data-kind="${action.kind}">${action.label}</button>
    `).join("")}</div>` : ""}
    <div class="game-play-state-feedback" data-game-play-feedback role="status" aria-live="polite"></div>
  `;

  bindBar(bar, game);
}

function setFeedback(bar, text, type = "info") {
  const node = bar.querySelector("[data-game-play-feedback]");
  if (!node) return;
  node.textContent = text;
  node.dataset.type = type;
}

function bindBar(bar, game) {
  bar.querySelectorAll("[data-game-play-target]").forEach(button => {
    button.addEventListener("click", async () => {
      if (busy) return;
      const target = button.dataset.gamePlayTarget;
      const label = GAME_PLAY_STATE_LABEL[target] || target;
      if (target === GamePlayState.FINISHED && !confirm("¿Finalizar el partido? El acta seguirá abierta para correcciones hasta que se bloquee por separado.")) return;

      busy = true;
      bar.querySelectorAll("button").forEach(item => { item.disabled = true; });
      setFeedback(bar, `Cambiando a ${label}…`);
      try {
        const result = await service.transition({ gameId:game.id, targetState:target });
        game.play_state = result.play_state || target;
        game.playState = game.play_state;
        game.play_state_changed_at = result.changed_at || new Date().toISOString();
        renderBar(bar.closest(".easy-entry-wrapper"), game);
      } catch (error) {
        setFeedback(bar, error?.message || "No se pudo cambiar el estado.", "error");
        bar.querySelectorAll("button").forEach(item => { item.disabled = false; });
      } finally {
        busy = false;
      }
    });
  });
}

function enhance() {
  const game = currentGame();
  const root = document.querySelector(".easy-entry-wrapper");
  if (!game || !root) return;
  renderBar(root, game);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("hashchange", () => queueMicrotask(enhance));
  const start = () => {
    enhance();
    const observer = new MutationObserver(() => enhance());
    observer.observe(document.documentElement, { childList:true, subtree:true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
}

export { enhance as enhanceGamePlayState };
