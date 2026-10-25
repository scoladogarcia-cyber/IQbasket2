import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeTrainingPortfolio,summarizeGamePortfolio,
 mergeAuthorizedCareer,evidenceQuality,summarizeAssessmentTime,formatBasketballMinutes} from '../domain/player360/PlayerPassportPortfolio.js';
import {PlayerPassportPortfolioService} from '../services/player360/PlayerPassportPortfolioService.js';

const training=[
 {training_session_id:'a',session_date:'2026-10-01',session_kind:'TEAM',
   session_status:'PLANNED',classification_review:'PENDING',
   attendance_status:'PRESENT',participated_minutes:60,recorded_minutes:60,accredited_minutes:0},
 {training_session_id:'b',session_date:'2026-09-02',session_kind:'TECHNIFICATION',
   session_status:'COMPLETED',classification_review:'REVIEWED',
   attendance_status:'PRESENT',participated_minutes:90,recorded_minutes:90,accredited_minutes:90}
];
const result=summarizeTrainingPortfolio(training);
assert.equal(result.totalRegistered,150);
assert.equal(result.totalAccredited,90);
assert.equal(result.pendingMinutes,60);
assert.equal(result.reviewPending,1);
assert.equal(formatBasketballMinutes(result.totalRegistered),'2 h 30 min');
const games=summarizeGamePortfolio([
 {game_id:'g1',authorization_context_id:'ts1',minutes:22,points:11,assists:3,offensive_rebounds:1,defensive_rebounds:4,steals:2},
 {game_id:'g1',authorization_context_id:'ts1',minutes:22,points:11},
 {game_id:'g2',authorization_context_id:'ts2',minutes:null,points:7}
]);
assert.equal(games.games,2);assert.equal(games.minutes,22);
assert.equal(games.points,18);assert.equal(games.unknownMinutes,1);
const current={evaluations:[{id:'e1',evaluation_date:'2025-01-01'}],measurements:[{id:'m1'}]};
const merged=mergeAuthorizedCareer(current,[{evaluations:[{id:'e1'},{id:'e2',evaluation_date:'2026-01-01'}],measurements:[{id:'m1'}]}]);
assert.deepEqual(merged.evaluations.map(x=>x.id),['e2','e1']);
const quality=evidenceQuality([{code:'A',min_evidence:8},{code:'B',min_evidence:5}],
 new Map([['A',{score:4,evidence_count:0}],['B',{score:3,evidence_count:5,context:'JR',confidence:'HIGH'}]]));
assert.deepEqual({rated:quality.rated,verified:quality.verified,withoutEvidence:quality.withoutEvidence},{rated:2,verified:1,withoutEvidence:1});
assert.equal(summarizeAssessmentTime([{assessment_duration_minutes:25},{assessment_duration_minutes:null}]).unknownEvaluations,1);

const rowsByTable={
 iq_passport_training_minutes_v68:training,
 iq_passport_game_evidence_v68:[{game_id:'g1',minutes:22}],
 player_evaluations:[{id:'e1',assessment_duration_minutes:25}]
};
const client={
 rpc:async(name,args)=>{
   if(name==='iq_v68_player_passport_career')return {data:{category:'Cadete Masculino',career:[{evaluations:[],measurements:[]}]},error:null};
   if(name==='iq_v68_passport_shared_career')return {data:[],error:null};
   if(name==='iq_v4e2_wellness_capabilities')return {data:{can_read:false,can_create:false,can_update:false},error:null};
   throw Error('Unexpected RPC '+name);
 },
 from(table){
   let matched=null;
   return {select(){return this;},eq(key,v){matched=v;return this;},order(){return this;},
     async range(start,end){assert.equal(matched,'p1');return {data:(rowsByTable[table]||[]).slice(start,end+1),error:null};}
   };
 }
};
const portfolio=await new PlayerPassportPortfolioService(client).load({playerId:'p1',teamSeasonId:'ts1'});
assert.equal(portfolio.career.category,'Cadete Masculino');
assert.equal(portfolio.training.rows.length,2);
assert.equal(portfolio.wellness.recovery.allowed,false);
const {PASSPORT_CATEGORY_VOCABULARY_V68,PASSPORT_DIFFICULTY_LEVELS_V68,passportCategoryContext}=
  await import('../config/playerPassportCategoriesV68.config.js');
assert.equal(PASSPORT_CATEGORY_VOCABULARY_V68.some(x=>x.code==='ESCOBOL'),true);
assert.equal(PASSPORT_CATEGORY_VOCABULARY_V68.some(x=>x.code==='PREINFANTIL'),true);
assert.equal(PASSPORT_CATEGORY_VOCABULARY_V68.some(x=>x.code==='SENIOR'),true);
assert.equal(PASSPORT_DIFFICULTY_LEVELS_V68.length,5);
assert.equal(passportCategoryContext('Cadete Masculino').canonicalCode,'CADET');
assert.equal(passportCategoryContext('Infantil').automaticScoreBonus,0);


const sql=readFileSync(new URL('../supabase/migrations/20261025120000_player_passport_portfolio_v68.sql',import.meta.url),'utf8');
const guided=readFileSync(new URL('../supabase/migrations/20261025124500_player_passport_guided_scoring_v68.sql',import.meta.url),'utf8');
const view=readFileSync(new URL('../views/player360/passport/PlayerPassportView.js',import.meta.url),'utf8');
assert.match(sql,/security_invoker=true/);assert.match(sql,/iq_v4_can_access_player_passport/);
assert.match(sql,/iqbasket_recovery_20261025/);
const shared=readFileSync(new URL('../supabase/migrations/20261025133000_player_passport_shared_history_v68.sql',import.meta.url),'utf8');
assert.match(shared,/family_can_view_player/);
assert.match(shared,/share_with_player is true/);
assert.match(shared,/is_private,false/);assert.match(guided,/PASSPORT_EVIDENCE_INSUFFICIENT/);
assert.match(guided,/PASSPORT_DIFFICULTY_REQUIRED/);
assert.match(guided,/PLAYER_PASSPORT_EDIT_DENIED/);
for(const segment of ['overview','skills','evolution','training','games','evidence','habits','evaluation'])assert.ok(view.includes(segment));
assert.match(view,/pp-assessment-minutes/);
assert.match(view,/saveGuidedEvaluation/);
assert.match(view,/Con evidencia suficiente/);
console.log('PASS Player Passport V68: category, licensed career, minutes, stats, wellness RBAC, evidence and UI');
