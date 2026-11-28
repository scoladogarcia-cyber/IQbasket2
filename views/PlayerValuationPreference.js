/** Presentation preference shared by player statistics and reports. */
import { TranslationStore } from "../services/TranslationStore.js";

const storageKey = "iqbasket:player-valuation";
let preference;

export function getPlayerValuation() {
  if (preference === undefined) {
    try {
      preference = globalThis.localStorage?.getItem(storageKey);
    } catch {
      preference = null;
    }
  }
  return preference !== "efficiency"
    ? { field: "pir", label: "PIR" }
    : { field: "efficiency", label: "FIBA (EFF)" };
}

export function setPlayerValuation(field) {
  preference = field === "pir" ? "pir" : "efficiency";
  try {
    globalThis.localStorage?.setItem(storageKey, preference);
  } catch {
    // Keep the in-memory choice when browser storage is unavailable.
  }
}

export function renderPlayerValuationToggle() {
  const current = getPlayerValuation();
  const next = current.field === "pir" ? "efficiency" : "pir";
  const nextLabel = next === "pir" ? "PIR" : "FIBA (EFF)";
  return `<button type="button" id="player-valuation-toggle" value="${next}" style="min-height:44px">
    ${TranslationStore.t("common.playerValuationToggle", { current: current.label, next: nextLabel })}
  </button>`;
}
