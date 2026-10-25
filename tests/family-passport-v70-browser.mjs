import assert from 'node:assert/strict';
import {chromium,webkit} from '@playwright/test';
import {installBrowserNetworkStubs} from './browser-test-support.mjs';

const kind=process.env.QA_BROWSER||'chromium';
const browser=await (kind==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
try{
 await installBrowserNetworkStubs(page);
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.iqApp),null,{timeout:20000});
 const result=await page.evaluate(async()=>{
  const {FamilyWorkspaceV32View}=await import('/views/family/FamilyWorkspaceV32View.js');
  const ID='11111111-1111-4111-8111-111111111111';
  const v=new FamilyWorkspaceV32View({rpc:async()=>({data:null,error:null})},null);
  v.analytics.trackSafely=async()=>null;
  v.analytics.trackOncePerSession=async()=>null;
  v.service.listPlayers=async()=>[{player_id:ID,first_name:'Alex',last_name:'Demo',team_name:'Equipo A',season_name:'2026/27'}];
  v.service.bootstrapFree=async()=>({});
  v.service.getProductSnapshot=async()=>({plan_code:'FAMILY_FREE',subject_covered:true});
  v.service.getPassport=async()=>({
   player:{id:ID,first_name:'Alex',last_name:'Demo'},
   section_access:{basic_stats:true,game_history:true,basic_timeline:true},
   career_totals:{games:12,minutes:160},
   recent_games:[],career:[{season_name:'2026/27',team_name:'Equipo A',games:12,points:85}]
  });
  v.service.getPassportBrief=async()=>({
   player_id:ID,category:'Cadete Masculino',team_name:'Equipo A',season_name:'2026/27',
   training_access:true,training:{recorded_minutes:750,accredited_minutes:0,pending_minutes:750,sessions:10,pending_sessions:10,classification_to_review:3,without_minutes:0},
   evaluation_access:true,evaluation_quality:{attributes_rated:69,with_documented_observations:0,pending_documentation:69}
  });
  v.service.getPlayer360Snapshot=async()=>({allowed:false,reason_code:'ENTITLEMENT_NOT_INCLUDED'});
  v.service.getDevelopmentContext=async()=>({allowed:false,reason_code:'ENTITLEMENT_NOT_INCLUDED'});
  v.service.getDevelopmentCycle=async()=>({allowed:false});
  const host=document.createElement('div');host.id='family-passport-v70-test';
  document.body.replaceChildren(host);
  await v.render(host,{id:ID});
  return {
   brief:host.querySelector('[data-family-passport-brief]')?.textContent||'',
   width:host.scrollWidth,
   viewport:window.innerWidth,
   workspace:Boolean(host.querySelector('.family-dashboard')),
   selected:v.playerId
  };
 });
 assert.equal(result.selected,'11111111-1111-4111-8111-111111111111');
 assert.ok(result.workspace,'Existing family dashboard must remain visible');
 assert.equal(await page.locator('[data-family-passport-brief]').count(),1);
 assert.equal(await page.locator('[data-family-passport-brief]').isVisible(),true,'Family passport must appear without opening advanced analysis');
 for(const s of ['Cadete Masculino','12 h 30 min','0 h 00 min','Pendiente de validar','Valoraciones']){
   assert.ok(result.brief.includes(s),'Expected: '+s+' in '+result.brief.slice(0,1000));
 }
 assert.ok(result.width<=result.viewport+2,'Mobile overflow: '+JSON.stringify(result));
 console.log('PASS family passport V70 '+kind+': authorized glimpse, honest training data, no horizontal overflow');
}finally{await browser.close();}
