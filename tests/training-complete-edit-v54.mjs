import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TrainingCompleteEditV54Service } from '../services/player360/TrainingCompleteEditV54Service.js';
import { TRAINING_TYPE_OPTIONS, BLOCK_PARTICIPATION_OPTIONS } from '../config/trainingEditV54.config.js';

const text = path => readFileSync(new URL(path,import.meta.url),'utf8');
const sql=text('../supabase/migrations/20260921090000_training_complete_edit_v54.sql');
const ui=text('../views/training/TrainingCompleteEditV54View.js');
const v55=text('../views/training/TrainingAttendanceHistoryV55View.js');
const registry=text('../services/LazyViewRegistry.js');

// V55 is the routed view, but must inherit the same single atomic V54 editor.
assert.match(registry,/TrainingAttendanceHistoryV55View/);
assert.match(v55,/extends TrainingCompleteEditV54View/);
assert.match(ui,/completeService\.saveComplete/);
assert.match(ui,/p360-cancel-training-edit/);
for(const item of ['v54-date','v54-type','v54-intensity','v54-block','v54-person','v54-part-status','v54-part-block-minutes','v54-part-reason','v54-eligibility-warning']) assert.ok(ui.includes(item),`Missing field ${item}`);
assert.match(ui,/confirm\(`/);
assert.match(ui,/this\._eligiblePlayers\(/);
assert.match(ui,/this\.editRevisions/);
assert.match(ui,/this\._can\(Permission\.EDIT_TRAINING\)/);
assert.match(ui,/Sin detalle no equivale/);
assert.equal(TRAINING_TYPE_OPTIONS.some(([type])=>type==='TACTICAL'),true);
assert.equal(BLOCK_PARTICIPATION_OPTIONS.some(([type])=>type==='NOT_ATTENDED'),true);

// DDL is additive, scoped to staff; destructive correction only inside a gated RPC.
for(const item of ['create table if not exists public.training_block_participation','enable row level security','revoke all on public.training_block_participation','iq_v4_can_manage_training','iq_v3_player_eligible_on_date','for update','TRAINING_CHILDREN_CHANGED_RELOAD_REQUIRED','TRAINING_REMOVAL_REQUIRES_CONFIRMATION','TRAINING_BLOCK_PARTICIPANT_SCOPE_MISMATCH','grant execute on function public.iq_v54_update_training_complete']) assert.ok(sql.toLowerCase().includes(item.toLowerCase()),`Missing SQL boundary ${item}`);
assert.match(sql,/update public\.training_sessions set/);
assert.match(sql,/on conflict\(training_session_id,player_id\) do update/);
assert.match(sql,/not p_confirm_removals/);
assert.match(sql,/and not\(p\.player_id=any\(v_player_ids\)\)/);

const session={ id:'game-training',updated_at:'2026-09-21T06:00:00+00:00',
  blocks:[{id:'b',updated_at:'2026-09-21T06:01:00+00:00'}],
  participants:[{id:'p',updated_at:'2026-09-21T06:02:00+00:00'}]};
const assignment={id:'assignment',participant_id:'p',block_id:'b',updated_at:'2026-09-21T06:03:00+00:00'};
let rpcArgs;
const client={rpc:async(name,args)=>{assert.equal(name,'iq_v54_update_training_complete');rpcArgs=args;return {data:'game-training',error:null};}};
const service=new TrainingCompleteEditV54Service(client);
const revision=service.revision(session,[assignment,{id:'other',participant_id:'other',updated_at:'2026-09-21T00:00:00Z'}]);
assert.equal(revision.blocks.length,1);
assert.equal(revision.participants.length,1);
assert.equal(revision.assignments.length,1);
const payload={session,teamSeasonId:'season',revision,date:'2026-09-21',title:'Entreno corregido',trainingType:'TACTICAL',
  objective:'Objetivo',notes:'Nota',start:'20:00',end:'21:00',intensity:5,
  blocks:[{key:'b',id:'b',order:1,title:'Tiro',duration_minutes:60}],
  participants:[{player_id:'player',status:'PARTIAL',minutes:30,blocks:[{key:'b',status:'PARTIAL',minutes:30,reason:'LIMITED'}]}],confirmedRemovals:true};
await service.saveComplete(payload);
assert.equal(rpcArgs.p_confirm_removals,true);
assert.deepEqual(rpcArgs.p_participants,payload.participants);
assert.deepEqual(rpcArgs.p_revision,revision);
assert.equal(rpcArgs.p_session_date,'2026-09-21');
assert.equal(rpcArgs.p_training_type,'TACTICAL');
await assert.rejects(()=>new TrainingCompleteEditV54Service({rpc:async()=>({data:null,error:{message:'TRAINING_CHANGED_RELOAD_REQUIRED'}})}).saveComplete(payload),/TRAINING_CHANGED_RELOAD_REQUIRED/);

const allowed=new Set(['b']);
function query(rows) {return {
  select(){return this;},in(){return this;},order(){return this;},
  async range(){return {data:rows,error:null};}
};}
const list=new TrainingCompleteEditV54Service({from:()=>query([{...assignment}])});
assert.equal((await list.listBlockParticipation([session])).length,1);
const malicious=new TrainingCompleteEditV54Service({from:()=>query([{...assignment,block_id:'unrelated'}])});
await assert.rejects(()=>malicious.listBlockParticipation([session]),/fuera/);
assert.deepEqual(await new TrainingCompleteEditV54Service({from:()=>{throw Error('Should not be called');}}).listBlockParticipation([]),[]);
assert.equal(allowed.has('b'),true);
console.log('PASS Training V54: complete editor, transactional RPC contract, staff RLS and block participation.');
