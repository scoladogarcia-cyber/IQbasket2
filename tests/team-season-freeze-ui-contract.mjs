import assert from "node:assert/strict";
import fs from "node:fs";

const seasonView = fs.readFileSync(new URL("../views/SeasonManagementView.js", import.meta.url), "utf8");
const settingsView = fs.readFileSync(new URL("../views/TranslationsView.js", import.meta.url), "utf8");
const gameView = fs.readFileSync(new URL("../views/GameLiveEditorView.js", import.meta.url), "utf8");
const approvalService = fs.readFileSync(new URL("../services/ApprovalCenterService.js", import.meta.url), "utf8");
const approvalView = fs.readFileSync(new URL("../views/ApprovalCenterView.js", import.meta.url), "utf8");
const translations = fs.readFileSync(new URL("../services/TranslationStore.js", import.meta.url), "utf8");

assert.match(seasonView, /Datos cerrados/);
assert.match(seasonView, /Datos abiertos/);
assert.match(seasonView, /data-action="freeze-scope-data"/);
assert.match(seasonView, /data-action="reopen-scope-data"/);
assert.match(seasonView, /data-action="request-freeze-scope-data"/);
assert.match(seasonView, /Sólo se reabrirán los partidos que fueron bloqueados por su cierre de temporada/i);

assert.match(settingsView, /rosterSeasonFrozen/);
assert.match(settingsView, /canManageRosterNow/);
assert.match(settingsView, /Temporada cerrada[\s\S]*plantilla y los partidos[\s\S]*solo lectura/i);

assert.match(gameView, /_isTeamSeasonFrozen/);
assert.match(gameView, /const seasonFrozen = this\._isTeamSeasonFrozen\(teamId\)/);
assert.match(gameView, /const canReopen = !seasonFrozen && locked/);
assert.match(gameView, /Temporada cerrada[\s\S]*BoxScore[\s\S]*informes/i);
assert.match(gameView, /Reábrela antes de registrar un nuevo partido/i);

assert.match(approvalService, /TEAM_SEASON_FREEZE/);
assert.match(approvalService, /SeasonFreezeService/);
assert.match(approvalService, /seasonFreezeService\.resolveRequest/);
assert.match(approvalView, /approvals\.type_season_freeze/);
assert.match(approvalView, /approve_season_freeze_confirm/);

for (const value of [
  "Cierre de temporada",
  "Tancament de temporada",
  "Season closure",
  "Clôture de saison"
]) {
  assert.ok(translations.includes(value), "Falta traducción: " + value);
}

console.log("TEAM_SEASON_FREEZE_UI_CONTRACT_OK");
