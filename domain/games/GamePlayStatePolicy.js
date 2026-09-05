/**
 * @fileoverview Canonical sporting lifecycle for a basketball game.
 * @description Separates what is happening in the game (`play_state`) from
 * whether historical data may be edited (`edit_state`).
 */

export const GamePlayState = Object.freeze({
  SCHEDULED: "SCHEDULED",
  READY: "READY",
  LIVE: "LIVE",
  FINISHED: "FINISHED",
  CANCELLED: "CANCELLED"
});

export const GAME_PLAY_STATE_LABEL = Object.freeze({
  [GamePlayState.SCHEDULED]: "Programado",
  [GamePlayState.READY]: "Preparado",
  [GamePlayState.LIVE]: "En juego",
  [GamePlayState.FINISHED]: "Finalizado",
  [GamePlayState.CANCELLED]: "Cancelado"
});

const TRANSITIONS = Object.freeze({
  [GamePlayState.SCHEDULED]: Object.freeze([GamePlayState.READY, GamePlayState.CANCELLED]),
  [GamePlayState.READY]: Object.freeze([GamePlayState.SCHEDULED, GamePlayState.LIVE, GamePlayState.CANCELLED]),
  [GamePlayState.LIVE]: Object.freeze([GamePlayState.FINISHED]),
  [GamePlayState.FINISHED]: Object.freeze([]),
  [GamePlayState.CANCELLED]: Object.freeze([])
});

export function normalizeGamePlayState(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return Object.values(GamePlayState).includes(normalized)
    ? normalized
    : GamePlayState.SCHEDULED;
}

export function allowedGamePlayTransitions(state) {
  return TRANSITIONS[normalizeGamePlayState(state)] || [];
}

export function canTransitionGamePlayState(from, to) {
  const target = normalizeGamePlayState(to);
  return allowedGamePlayTransitions(from).includes(target);
}

export function gameLifecycleComposite({ playState, editState = "OPEN" } = {}) {
  const sport = normalizeGamePlayState(playState);
  const edit = String(editState || "OPEN").trim().toUpperCase() === "LOCKED" ? "LOCKED" : "OPEN";
  return Object.freeze({
    playState: sport,
    editState: edit,
    canCapture: sport === GamePlayState.LIVE && edit === "OPEN",
    canCorrect: sport === GamePlayState.FINISHED && edit === "OPEN",
    historical: sport === GamePlayState.FINISHED && edit === "LOCKED"
  });
}

export default Object.freeze({
  states: GamePlayState,
  labels: GAME_PLAY_STATE_LABEL,
  allowedTransitions: allowedGamePlayTransitions,
  canTransition: canTransitionGamePlayState,
  composite: gameLifecycleComposite
});
