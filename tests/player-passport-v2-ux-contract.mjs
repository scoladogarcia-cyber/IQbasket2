import assert from "node:assert/strict";
import fs from "node:fs";

const player=fs.readFileSync(new URL("../views/PlayerStatsView.js",import.meta.url),"utf8");
const settings=fs.readFileSync(new URL("../views/TranslationsView.js",import.meta.url),"utf8");
const passport=fs.readFileSync(new URL("../views/player360/passport/PlayerPassportView.js",import.meta.url),"utf8");
const training=fs.readFileSync(new URL("../views/training/TrainingCompleteEditV54View.js",import.meta.url),"utf8");
const service=fs.readFileSync(new URL("../services/player360/PlayerPassportService.js",import.meta.url),"utf8");
const exportService=fs.readFileSync(new URL("../services/player360/PlayerPassportExportService.js",import.meta.url),"utf8");

assert.match(player,/input-photo-file/);
assert.match(player,/preparePlayerPhoto/);
assert.match(player,/#\/passport\/\$\{encodeURIComponent/);
assert.match(settings,/edit-p-photo-file/);
assert.match(settings,/photo_url:\s*photoUrl/);

assert.match(passport,/Añadir primera valoración/);
assert.match(passport,/Cómo valorar/);
assert.match(passport,/Ver criterios de valoración/);
assert.match(passport,/exportPassportWord/);
assert.match(passport,/exportPassportCardPng/);
assert.match(passport,/iq_passport_training_context/);
assert.match(training,/Valorar pasaporte desde esta sesión/);
assert.match(training,/iq_passport_training_context/);
assert.match(service,/iq_v4_save_player_passport_evaluation_v2/);
assert.match(exportService,/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
assert.match(exportService,/image\/png/);
assert.match(exportService,/renderIdentityCard/);
assert.match(exportService,/renderValuesCard/);
assert.match(exportService,/_Perfil\.png/);
assert.match(exportService,/_Valores\.png/);
console.log("player-passport-v2-ux-contract OK");
