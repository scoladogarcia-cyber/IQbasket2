import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TrainingAttendanceImportServiceV77,toTrainingImportPayloadV77} from "../services/exchange/TrainingAttendanceImportServiceV77.js";
import {Permission} from "../security/permissions.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
assert.equal(Permission.IMPORT_TRAINING_ATTENDANCE,"IMPORT_TRAINING_ATTENDANCE");
const plan={
  teamSeasonId:"teamseason",status:"PREVIEW_ONLY",canWrite:false,changed:1,sessionCount:1,
  changes:[{sessionId:"s",playerId:"p",participantId:"att",sessionUpdatedAt:"2026-10-25T10:00:00Z",
    participantUpdatedAt:"2026-10-25T10:00:00Z",
    expected:{attendance:"PRESENT",minutes:40},proposed:{attendance:"PARTIAL",minutes:30}}]
};
const fresh=[{id:"s",team_season_id:"teamseason",updated_at:"2026-10-25T10:00:00Z",duration_minutes:60,
  participants:[{id:"att",player_id:"p",updated_at:"2026-10-25T10:00:00Z",attendance_status:"PRESENT",participated_minutes:40}]}];
const freshSessions=fresh;
assert.equal(toTrainingImportPayloadV77(plan)[0].proposed.minutes,30);
assert.throws(()=>toTrainingImportPayloadV77({...plan,canWrite:true}),/vista previa/);
let calls=0;
const client={rpc:async(name,args)=>{calls++;assert.equal(name,"iq_v77_apply_training_attendance_import");
  assert.equal(args.p_changes.length,1);return {data:{changed:1,status:"APPLIED"},error:null};}};
const auth={can:(permission)=>[Permission.IMPORT_TRAINING_ATTENDANCE,Permission.EDIT_TRAINING].includes(permission)};
const service=new TrainingAttendanceImportServiceV77({client,auth});
await assert.rejects(service.apply({plan,freshSessions,confirmed:true}),/habilitada/);
assert.equal(calls,0);
service.config={...service.config,enabled:true};
await assert.rejects(service.apply({plan,freshSessions,confirmed:false}),/confirmar/);
assert.equal(calls,0);
assert.deepEqual(await service.apply({plan,freshSessions,confirmed:true}),{changed:1,status:"APPLIED"});
assert.equal(calls,1);
await assert.rejects(service.apply({plan,freshSessions:[{...fresh[0],updated_at:"2026-10-26T10:00:00Z"}],confirmed:true}),/actualizados|Recarga/);
assert.equal(calls,1);
const blocked=new TrainingAttendanceImportServiceV77({client,auth:{can:()=>false},config:{enabled:true,rpc:"iq_v77_apply_training_attendance_import",confirmation:"APLICAR_ASISTENCIA"}});
await assert.rejects(blocked.apply({plan,freshSessions,confirmed:true}),/permisos/);
assert.equal(calls,1);
const sql=read("supabase/drafts/training_attendance_import_v77.sql");
for(const k of ["SECURITY DEFINER","auth.uid()","iq_v4_can_manage_training",
"iq_v77_private.training_import_grants","FOR UPDATE","updated_at","p_confirmation",
"REVOKE ALL ON FUNCTION public.iq_v77_apply_training_attendance_import",
"GRANT EXECUTE ON FUNCTION public.iq_v77_apply_training_attendance_import","TRAINING_IMPORT_STALE"]){
 assert.ok(sql.includes(k),k);
}
assert.doesNotMatch(read("services/exchange/TrainingAttendanceImportServiceV77.js"),/\.from\(["']training_participants["']\).*\.upsert/s);
console.log("PASS V77 import: disabled gate, separate permission, concurrent modifications and SQL contract.");
