import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TranslationStore } from "../services/TranslationStore.js";
import { I18n } from "../services/I18nService.js";

const panel = readFileSync(new URL("../views/training/TrainingIntelligencePanelV58.js", import.meta.url), "utf8");
const locales = ["es", "ca", "en", "fr"];
const keys = [
  "heading", "classifyTitle", "classifyHelp", "allocationTitle", "allocationHelp",
  "allocationSave", "save", "focusMinutes", "focusEmpty", "classified", "sessions",
  "hours", "attendance", "avgRpe", "totalLoad", "unclassified", "explicitDose",
  "load7", "players", "player", "minutes", "load", "latestWeeks", "week",
  "sessionAbbr", "sessionMinutes", "noData", "method", "windows",
  "sessionMinutesShort", "errorDuration", "errorClassify", "errorDose", "errorFocus"
];
for (const locale of locales) {
  await TranslationStore.setLanguage(locale);
  assert.equal(I18n.getLocale(), locale);
  for (const key of keys) {
    const full = "training.v58." + key;
    assert.notEqual(TranslationStore.t(full), full, locale + ": " + full);
  }
  for (const code of ["TECHNICAL","SHOOT_FINISH","TACTICAL_TEAM","GAME_5V5","PHYSICAL","RECOVERY_PREMATCH"]) {
    const full = "training.focus." + code;
    assert.notEqual(TranslationStore.t(full), full, locale + ": " + full);
  }
}
await TranslationStore.setLanguage("en");
assert.equal(TranslationStore.t("training.v58.save"), "Save");
assert.equal(TranslationStore.t("training.focus.PHYSICAL"), "Physical conditioning");
await TranslationStore.setLanguage("fr");
assert.match(TranslationStore.t("training.v58.classifyTitle", {count:2}), /2/);
assert.match(panel, /this\.t\("training\.v58\.classifyTitle"/);
assert.match(panel, /this\._focusLabel\(item\.code\)/);
assert.match(panel, /min-height:44px/);
assert.doesNotMatch(panel, /<summary>Clasificar histórico/);
console.log("PASS Training V85: four languages for focus classification and analytics, mobile touch targets.");
