import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// No browser needed: stable storage stub before importing the i18n singletons.
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
const { I18n } = await import("../services/I18nService.js");
const { TranslationStore } = await import("../services/TranslationStore.js");
const { BUNDLED_LANGUAGE_CATALOG_V80 } = await import("../services/i18n/BundledLanguageCatalogV80.js");
const { trainingValidationIssuesV83, trainingValidationErrorCodeV83 } = await import("../services/player360/TrainingValidationPreflightV83.js");
const { buildTrainingOverviewV83 } = await import("../services/player360/TrainingOverviewAnalyticsV83.js");

for (const [locale, expectedTeam, expectedHeading] of [
  ["es", "Equipo", "Seguimiento de entrenamientos"],
  ["ca", "Equip", "Seguiment dels entrenaments"],
  ["en", "Team", "Training overview"],
  ["fr", "Équipe", "Suivi des entraînements"]
]) {
  await TranslationStore.setLanguage(locale);
  assert.equal(TranslationStore.t("team"), expectedTeam);
  assert.equal(TranslationStore.t("training.overview.title"), expectedHeading);
  assert.equal(I18n.getLocale(), locale);
  assert.equal(storage.get("iq_locale"), locale);
  assert.equal(storage.get("iq_lang"), locale);
  for (const key of Object.keys(BUNDLED_LANGUAGE_CATALOG_V80.es).filter(x => x.startsWith("training.overview.") || x.startsWith("training.validation."))) {
    assert.ok(BUNDLED_LANGUAGE_CATALOG_V80[locale][key], locale + " missing " + key);
  }
}

// Regression: direct I18nService locale changes must not leave the legacy store in Spanish.
I18n.setLocale("en");
await TranslationStore.initAllTranslations();
assert.equal(TranslationStore.t("team"), "Team");
assert.equal(TranslationStore.getDictionary().team, "Team");
I18n.setLocale("ca");
assert.equal(TranslationStore.t("team"), "Equip");

const today = "2026-11-10";
const base = { id: "training-1", session_date: "2026-11-09", status: "PLANNED", duration_minutes: 90, participants: [
  { player_id: "p1", attendance_status: "PLANNED", participated_minutes: null },
  { player_id: "p2", attendance_status: "PRESENT", participated_minutes: 40 }
] };
assert.deepEqual(trainingValidationIssuesV83(base, today).map(x => x.code), ["ATTENDANCE_PENDING"]);
assert.deepEqual(trainingValidationIssuesV83({ ...base, participants: [{ player_id: "p2", attendance_status: "PRESENT", participated_minutes: 91 }] }, today).map(x => x.code), ["INVALID_MINUTES"]);
assert.deepEqual(trainingValidationIssuesV83({ ...base, participants: [] }, today).map(x => x.code), ["NO_PARTICIPANTS"]);
assert.ok(trainingValidationIssuesV83({ ...base, duration_minutes: null }, today).some(x => x.code === "DURATION"));
assert.ok(trainingValidationIssuesV83({ ...base, session_date: "2026-12-01" }, today).some(x => x.code === "FUTURE"));
assert.equal(trainingValidationErrorCodeV83(new Error("TRAINING_PARTICIPANTS_NEED_CONFIRMATION")), "ATTENDANCE_PENDING");

const ready = { ...base, id: "ready", participants: [{ player_id: "p1", attendance_status: "PRESENT", participated_minutes: 90 }] };
const completed = {
  ...ready, id: "done", status: "COMPLETED",
  participants: [
    { player_id: "p1", attendance_status: "PRESENT", participated_minutes: 90 },
    { player_id: "p2", attendance_status: "ABSENT", participated_minutes: 0 }
  ],
  metadata: { training_focus_codes: ["TECHNICAL"] }
};
const future = { ...base, id: "future", session_date: "2026-11-20" };
const overview = buildTrainingOverviewV83([base, ready, completed, future], today);
assert.equal(overview.validated, 1);
assert.equal(overview.pending, 2);
assert.equal(overview.ready, 1);
assert.equal(overview.needsReview, 1);
assert.equal(overview.upcoming, 1);
assert.equal(overview.sessionMinutesValidated, 90);
assert.equal(overview.playerMinutesValidated, 90, "Planned minutes must never be credited");
assert.equal(overview.attendancePct, 50);
assert.equal(overview.focusCoveragePct, 100);
assert.equal(overview.weeks.reduce((sum, week) => sum + week.validated, 0), 1);

const source = readFileSync(new URL("../views/TrainingView.js", import.meta.url), "utf8");
assert.match(source, /trainingValidationIssuesV83/);
assert.match(source, /this\.trainingValidationFeedback=\{passed:succeeded,details:failures\}/);
assert.match(source, /training\.validation\.allPresentConfirm/);
assert.match(source, /p360-overview-filter-pending/);
assert.match(source, /training\.ui\.heroTitle/);
console.log("PASS V83 language switching, validation preflight, preserved feedback, verified dashboard totals.");
