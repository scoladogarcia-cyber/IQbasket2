/**
 * @fileoverview Pure post-save navigation policy for BoxScore V46.
 * @description Keeps success detection and destination selection independent
 * from DOM, persistence and browser routing so they remain deterministic and testable.
 */

export function resolveBoxScorePostSaveDestination(isGameScopedOnly = false) {
  return isGameScopedOnly ? "#/dashboard" : "#/games";
}

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

export default {
  resolveBoxScorePostSaveDestination,
  isConfirmedBoxScoreSaveRerender
};
