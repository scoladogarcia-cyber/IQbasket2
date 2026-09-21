import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attendedTraining,trainingAttendanceImpact} from '../domain/training/TrainingAttendanceV55.js';
import {TrainingHistoryV55Service} from '../services/player360/TrainingHistoryV55Service.js';
import {Player360ObservationAssembler} from '../services/player360/Player360ObservationAssembler.js';

const text = path => readFileSync(new URL(path,import.meta.url),'utf8');
const sql=text('../supabase/migrations/20260921110000_training_history_delete_v55.sql');
const historySql=text('../supabase/migrations/20260921110500_training_real_attendance_history_v55.sql');
const freshnessSql=text('../supabase/migrations/20260921111000_training_snapshot_freshness_v55.sql');
const ui=text('../views/training/TrainingAttendanceHistoryV55View.js');
const registry=text('../services/LazyViewRegistry.js');

for(const status of ['PLANNED','ABSENT','EXCUSED']) assert.equal(attendedTraining({attendance_status:status,participated_minutes:90}),false,status);
for(const status of ['PRESENT','PARTIAL']) {
  assert.equal(attendedTraining({attendance_status:status,participated_minutes:30}),true,status);
  assert.equal(attendedTraining({attendance_status:status,participated_minutes:0}),false,status);
}
assert.equal(attendedTraining(null),false);
assert.deepEqual(trainingAttendanceImpact([
  {attendance_status:'PRESENT',participated_minutes:60},
  {attendance_status:'PARTIAL',participated_minutes:15},
  {attendance_status:'ABSENT',participated_minutes:0},
  {attendance_status:'PLANNED',participated_minutes:null}
]),{attended:2,minutes:75,listed:4});

const statuses=['PRESENT','PARTIAL','ABSENT','EXCUSED','PLANNED'];
const sessions=statuses.map((status,i)=>({id:`session-${i}`,session_date:'2026-09-20',
  participants:[{player_id:'player',attendance_status:status,participated_minutes:i===0?60:i===1?15:0,rpe:5,internal_load:120}]}));
sessions.push({id:'archived',status:'ARCHIVED',session_date:'2026-09-20',participants:[{
  player_id:'player',attendance_status:'PRESENT',participated_minutes:60,rpe:5,internal_load:300
}]});
const actual=Player360ObservationAssembler.assemble({playerId:'player',teamSeasonId:'season',trainingSessions:sessions});
const sources=new Set(actual.observations.filter(x=>x.module==='training').map(x=>x.source_id));
assert.deepEqual([...sources].sort(),['session-0','session-1']);
assert.equal(actual.observations.filter(x=>x.module==='training'&&x.metric_code==='PARTICIPATED_MINUTES')
  .reduce((total,x)=>total+Number(x.value),0),75);

let args;
const session={id:'session-0',updated_at:'2026-09-21T07:00:00Z',participants:[],blocks:[]};
const service=new TrainingHistoryV55Service({rpc:async(name,input)=>{
  assert.equal(name,'iq_v55_delete_training');args=input;
  return {data:{deleted:true,session_id:'session-0',participants_removed:2,blocks_removed:1},error:null};
}});
const revision=service.revision(session);
await assert.rejects(()=>service.deleteSession({session,teamSeasonId:'season',revision}),/confirmación/);
const done=await service.deleteSession({session,teamSeasonId:'season',revision,confirmed:true});
assert.equal(done.deleted,true);
assert.equal(args.p_session_id,session.id);
assert.equal(args.p_team_season_id,'season');
assert.deepEqual(args.p_revision,revision);
assert.equal(args.p_confirm,true);
await assert.rejects(()=>new TrainingHistoryV55Service({rpc:async()=>({data:null,error:{message:'TRAINING_DELETE_PERMISSION_OR_FROZEN_SEASON'}})}).deleteSession({session,teamSeasonId:'season',revision,confirmed:true}),/PERMISSION/);

for(const snippet of ['iq_v55_can_delete_training','iq_v4_can_manage_training','iq_v3_is_global_superadmin','iq_v55_delete_training','p_confirm','TRAINING_CHANGED_RELOAD_REQUIRED','TRAINING_CHILDREN_CHANGED_RELOAD_REQUIRED','TRAINING_LINKED_DEVELOPMENT_EVIDENCE_UNLINK_FIRST','training_session_deletion_audit','delete from public.training_sessions','grant execute','revoke all']) assert.ok(sql.includes(snippet),snippet);
for(const name of ['iq_v8_family_player_passport','iq_v32_family_player_passport','iq_v33_family_player_passport','iq_v10_family_development_context','iq_v16_development_cycle_snapshot']) assert.ok(historySql.includes(name),name);
assert.match(historySql,/PRESENT.*PARTIAL/);
assert.match(historySql,/coalesce\(tp\.participated_minutes,0\)>0/);
assert.match(freshnessSql,/invalidated_at is null/);
assert.match(freshnessSql,/after insert or update or delete on public\.training_participants/);
assert.match(freshnessSql,/before update of session_date,status or delete on public\.training_sessions/);
assert.match(ui,/this\._can\(Permission\.DELETE_TRAINING\)/);
assert.match(ui,/v55-mark-present/);
assert.match(ui,/v55-mark-absent/);
assert.match(ui,/v55-delete-session/);
assert.match(ui,/confirm\(message\)/);
assert.match(ui,/deleteService\.deleteSession/);
assert.match(registry,/TrainingAttendanceHistoryV55View/);
console.log('PASS V55: confirmed attendance, player development, scoped transactional deletion and stale snapshots.');
