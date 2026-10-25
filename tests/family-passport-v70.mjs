import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatFamilyMinutes,presentFamilyPassportBrief}
  from '../domain/family/FamilyPassportBriefPresenter.js';
import {renderFamilyPassportBrief}
  from '../views/family/FamilyPassportBriefPanel.js';
import {FamilyWorkspaceService} from '../services/family/FamilyWorkspaceService.js';

assert.equal(formatFamilyMinutes(null),'No disponible');
assert.equal(formatFamilyMinutes(undefined),'No disponible');
assert.equal(formatFamilyMinutes(0),'0 h 00 min');
assert.equal(formatFamilyMinutes(750),'12 h 30 min');
assert.equal(formatFamilyMinutes(-2),'No disponible');
const sample={
 player_id:'p1',category:'Cadete Masculino',team_name:'Equipo A',season_name:'2026/27',
 training_access:true,training:{
  sessions:9,recorded_minutes:750,accredited_minutes:180,pending_minutes:570,
  pending_sessions:7,classification_to_review:2,without_minutes:1
 },
 evaluation_access:true,evaluation_quality:{
   attributes_rated:69,with_documented_observations:0,pending_documentation:69,
   scientific_calibration:'PENDING'
 }
};
const permitted={section_access:{basic_stats:true},career_totals:{games:12,minutes:180}};
const model=presentFamilyPassportBrief(sample,permitted);
assert.equal(model.training.recorded,'12 h 30 min');
assert.equal(model.training.accredited,'3 h 00 min');
assert.equal(model.training.pending,'9 h 30 min');
assert.equal(model.evaluation.needsEvidence,69);
assert.equal(model.category,'Cadete Masculino');
const html=renderFamilyPassportBrief(sample,permitted);
assert.match(html,/Pasaporte en un vistazo/);
assert.match(html,/SU HISTORIA, NO SU EQUIPO/);
assert.match(html,/12 h 30 min/);
assert.match(html,/3 h 00 min/);
assert.match(html,/No significa que el jugador no haya entrenado/);
assert.match(html,/validaci[oó]n cient[ií]fica/i);
assert.doesNotMatch(html,/Global score|OVR|ranking/i);
const noAccess=presentFamilyPassportBrief({player_id:'p1',training_access:false,evaluation_access:false},{});
assert.equal(noAccess.training.available,false);
assert.equal(noAccess.competition.available,false);
assert.equal(noAccess.evaluation.available,false);
assert.doesNotMatch(renderFamilyPassportBrief({player_id:'p1',training_access:false,evaluation_access:false},{}),/>0 h 00 min</);

let invoked=null;
const service=new FamilyWorkspaceService({rpc:async(name,args)=>{
 invoked={name,args};return {data:sample,error:null};
}});
const output=await service.getPassportBrief('p1');
assert.equal(output.category,'Cadete Masculino');
assert.deepEqual(invoked,{name:'iq_v70_family_passport_brief',args:{p_player_id:'p1'}});

const sql=readFileSync(new URL('../supabase/migrations/20261025162000_family_passport_brief_v70.sql',import.meta.url),'utf8');
assert.match(sql,/family_can_view_player\(auth.uid\(\),p_player_id\)/);
assert.match(sql,/iq_saas_entitlement_check\('PLAYER',p_player_id,null,'GAME_HISTORY',1\)/);
assert.match(sql,/iq_saas_entitlement_check\('PLAYER',p_player_id,null,'PLAYER_PASSPORT',1\)/);
assert.match(sql,/grant execute on function public.iq_v70_family_passport_brief\(uuid\) to authenticated/);
assert.match(sql,/revoke all on function public.iq_v70_family_passport_brief\(uuid\) from public,anon/);
assert.match(sql,/coalesce\(e.is_private,false\)=false/);
const view=readFileSync(new URL('../views/family/FamilyWorkspaceV32View.js',import.meta.url),'utf8');
assert.match(view,/data-family-passport-brief/);
assert.match(view,/requestId!==this._passportBriefRequestId/);
assert.match(view,/await super\.render/);
console.log('PASS V70 family passport: separate entitlements, unknown vs zero, no fabricated rating, UI scope');
