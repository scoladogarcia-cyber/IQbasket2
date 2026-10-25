import assert from "node:assert/strict";
import fs from "node:fs";
import {buildTrainingImportPreflightV76,verifyTrainingImportPreflightV76} from "../services/exchange/TrainingImportPreflightV76.js";
import {exportTrainingEvidenceCsvV75,previewTrainingEvidenceCsvV75} from "../services/exchange/TrainingEvidenceExchangeV75.js";
import {parseBoxScoreCsv} from "../services/reports/BoxScoreExchangeV53.js";
const sessions=[{id:"training1",team_season_id:"season1",updated_at:"2026-10-25T10:00:00Z",
  session_date:"2026-10-24",title:"Pases",metadata:{session_kind:"TEAM"},
  duration_minutes:75,participants:[
    {id:"participant1",player_id:"player1",updated_at:"2026-10-25T10:01:00Z",attendance_status:"PRESENT",participated_minutes:40},
    {id:"participant2",player_id:"player2",updated_at:"2026-10-25T10:01:30Z",attendance_status:"PLANNED",participated_minutes:null}
]}];
const cvs=exportTrainingEvidenceCsvV75({sessions,teamSeasonId:"season1"});
const matrix=parseBoxScoreCsv(cvs.content);
matrix[1][8]="55";
matrix[2][7]="ABSENT";matrix[2][8]="0";
const text=matrix.map(r=>r.map(s=>'"'+String(s??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
const preview=previewTrainingEvidenceCsvV75(text,{sessions,teamSeasonId:"season1"});
assert.equal(preview.changed,2);
const plan=buildTrainingImportPreflightV76({preview,sessions,teamSeasonId:"season1"});
assert.equal(plan.changed,2);
assert.equal(plan.canWrite,false);
assert.equal(plan.status,"PREVIEW_ONLY");
assert.equal(plan.changes[0].participantId,"participant1");
assert.equal(plan.changes[1].proposed.minutes,0);
assert.ok(verifyTrainingImportPreflightV76(plan,sessions));
const stale=[{...sessions[0],participants:sessions[0].participants.map((p,i)=>i===0?{...p,updated_at:"2026-10-25T10:02:00Z"}:p)}];
assert.throws(()=>verifyTrainingImportPreflightV76(plan,stale),/actualizados/);
assert.throws(()=>buildTrainingImportPreflightV76({preview,sessions,teamSeasonId:"other"}),/fuera/);
assert.throws(()=>buildTrainingImportPreflightV76({preview,sessions,teamSeasonId:"season1",seasonStatus:"FROZEN"}),/cerrada/);
assert.throws(()=>buildTrainingImportPreflightV76({preview,sessions:[{...sessions[0],updated_at:null}],teamSeasonId:"season1"}),/sin versión/);
assert.throws(()=>buildTrainingImportPreflightV76({preview:{...preview,writable:true},sessions,teamSeasonId:"season1"}),/CSV completo/);
const ui=fs.readFileSync(new URL("../views/TrainingView.js",import.meta.url),"utf8");
assert.match(ui,/buildTrainingImportPreflightV76/);
assert.match(ui,/[Vv]erificación de versiones/);
console.log("PASS V76: versioned, identity-checked, read-only training import preflight.");
