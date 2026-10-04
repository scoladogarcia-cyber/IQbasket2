import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAINING_FOCUS_OPTIONS, TRAINING_FOCUS_CODES } from "../config/trainingEditV54.config.js";
import { buildTrainingFocusAnalytics } from "../domain/player360/TrainingFocusAnalytics.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const view = read("../views/TrainingView.js");
const service = read("../services/player360/TrainingService.js");
const complete = read("../services/player360/TrainingCompleteEditV54Service.js");
const completeView = read("../views/training/TrainingCompleteEditV54View.js");
const exportService = read("../services/player360/TrainingExportService.js");
const sql = read("../supabase/migrations/20261004173000_training_ux_v55.sql");

assert.equal(TRAINING_FOCUS_OPTIONS.length, 6);
assert.deepEqual(TRAINING_FOCUS_CODES, [
  "TECHNICAL","SHOOT_FINISH","TACTICAL_TEAM","GAME_5V5","PHYSICAL","RECOVERY_PREMATCH"
]);

for (const code of TRAINING_FOCUS_CODES) {
  assert.match(sql, new RegExp(code));
}
assert.match(sql,/iq_v55_create_training_session/);
assert.match(sql,/iq_v55_update_training_complete/);
assert.match(sql,/training_focus_codes/);
assert.match(sql,/cloned_from_session_id/);
assert.match(sql,/TRAINING_CLONE_SOURCE_SCOPE_MISMATCH/);
assert.match(service,/iq_v55_create_training_session/);
assert.match(complete,/iq_v55_update_training_complete/);
assert.match(completeView,/Edición rápida/);
assert.match(completeView,/v55-simplified-edit/);
assert.match(completeView,/Más detalles · nombre, intensidad, objetivo y bloques/);
assert.match(completeView,/Jugadores · asistencia, minutos, RPE y Pasaporte/);
assert.match(completeView,/Jugadores registrados en esta sesión/);
assert.match(completeView,/añadirlos al entrenamiento no los incorpora a la plantilla/);

for (const marker of [
  "Entreno rápido",
  "p360-training-focus",
  "p360-training-notes",
  "p360-clone-training",
  "Repetir / copiar",
  "Informe temporada",
  "CSV"
]) assert.ok(view.includes(marker), `Missing V55 UI marker: ${marker}`);

assert.match(exportService,/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
assert.match(exportService,/exportTrainingSeasonCsv/);
assert.match(exportService,/playerExposureMinutes/);

const sessions = [{
  id:"s1",status:"COMPLETED",duration_minutes:80,
  metadata:{training_focus_codes:["TECHNICAL","GAME_5V5"]},
  participants:[
    {player_id:"p1",attendance_status:"PRESENT",participated_minutes:80},
    {player_id:"p2",attendance_status:"PARTIAL",participated_minutes:40}
  ]
},{
  id:"s2",status:"COMPLETED",duration_minutes:60,
  metadata:{training_focus_codes:["SHOOT_FINISH"]},
  participants:[{player_id:"p1",attendance_status:"PRESENT",participated_minutes:60}]
}];
const analytics=buildTrainingFocusAnalytics(sessions);
assert.equal(analytics.totals.sessions,2);
assert.equal(analytics.totals.sessionMinutes,140);
assert.equal(analytics.focuses.find(x=>x.code==="TECHNICAL").focusSessionMinutes,80);
const p1=analytics.players.find(x=>x.playerId==="p1");
assert.equal(p1.participatedMinutes,140);
assert.equal(p1.focuses.find(x=>x.code==="GAME_5V5").playerExposureMinutes,80);
assert.equal(analytics.semantics.causalClaimAllowed,false);
assert.match(analytics.semantics.playerExposureMinutes,/NOT_FOCUS_ALLOCATION/);

console.log("PASS Training V55: quick focus taxonomy, clone, exports and non-causal longitudinal exposure.");
