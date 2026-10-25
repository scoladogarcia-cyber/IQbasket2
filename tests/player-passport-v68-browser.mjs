import assert from 'node:assert/strict';
import {chromium,webkit} from '@playwright/test';
import {installBrowserNetworkStubs} from './browser-test-support.mjs';
const engine=process.env.QA_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
try{
  await installBrowserNetworkStubs(page);
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.iqApp),null,{timeout:20000});
  await page.evaluate(async()=>{
    const {PlayerPassportView}=await import('/views/player360/passport/PlayerPassportView.js');
    const catalog=await (await fetch('/config/player-passport.catalog.json')).json();
    document.body.innerHTML='<main id="passport-test"></main>';
    const v=new PlayerPassportView({rpc:async()=>({data:null,error:null})},{canPreview:()=>true});
    v._seasonId=()=> 'season-1';
    v._players=()=>[{id:'player-1',jersey:10,primary_position:'Base'}];
    v.service.getPassport=async()=>({
      player:{id:'player-1',first_name:'Jugador',last_name:'QA',birth_date:'2011-08-23'},
      team:{team_name:'Club prueba',season_name:'2026-2027'},
      catalog,allowed:true,
      evaluations:[{id:'eval-1',evaluation_date:'2026-10-10',title:'Histórica',
        scores:[{metric_code:'TEC-BOT-02',score:3,evidence_count:0,confidence_label:'MEDIUM'}]}],
      measurements:[]
    });
    v.portfolioService.load=async()=>({
      sharedEvaluations:[],career:{category:'Cadete Masculino',career:[]},
      training:{error:null,rows:[
        {training_session_id:'t1',session_date:'2026-10-01',session_kind:'TEAM',session_status:'PLANNED',attendance_status:'PRESENT',participated_minutes:60,recorded_minutes:60,accredited_minutes:0,classification_review:'PENDING'},
        {training_session_id:'t2',session_date:'2026-09-01',session_kind:'TECHNIFICATION',session_status:'COMPLETED',attendance_status:'PRESENT',participated_minutes:30,recorded_minutes:30,accredited_minutes:30,classification_review:'REVIEWED'}
      ]},
      games:{error:null,rows:[{game_id:'g1',game_date:'2026-10-05',authorization_context_id:'season-1',minutes:20,points:12,assists:4,offensive_rebounds:1,defensive_rebounds:3}]},
      assessmentTime:{error:null,rows:[{id:'eval-1',assessment_duration_minutes:null}]},
      wellness:{recovery:{allowed:false,rows:[],error:null},nutrition:{allowed:false,rows:[],error:null}}
    });
    v.service.saveGuidedEvaluation=async payload=>{window.__qaSaved=payload;return 'new-eval';};
    window.__qaView=v;
    await v.render('passport-test','player-1','club-1');
  });
  assert.match(await page.locator('.pp-hero').innerText(),/Cadete Masculino/);
  assert.match(await page.locator('.pp-quality-panel').innerText(),/Con observaciones suficientes/);
  assert.match(await page.locator('.pp-training-totals').innerText(),/1 h 30 min/);
  await page.locator('[data-pp-section="games"]').click();
  assert.match(await page.locator('.pp-panel').last().innerText(),/Partidos y estadísticas reales/);
  await page.locator('[data-pp-section="evolution"]').click();
  assert.match(await page.locator('.pp-panel').first().innerText(),/Trayectoria del jugador/);
  await page.locator('[data-pp-section="habits"]').click();
  assert.match(await page.locator('.pp-page').innerText(),/Acceso restringido/);
  await page.locator('[data-pp-section="evaluation"]').click();
  await page.locator('#pp-toggle').click();
  assert.equal(await page.locator('.pp-difficulty').count()>0,true);
  const item=page.locator('.pp-eval-card').first();
  await item.locator('.pp-score button[data-score="4"]').click();
  await item.locator('.pp-difficulty').selectOption('D3');
  await item.locator('.pp-count').fill('8');
  await page.locator('#pp-form button[type="submit"]').click();
  await page.waitForFunction(()=>Boolean(window.__qaSaved));
  const saved=await page.evaluate(()=>window.__qaSaved);
  assert.equal(saved.scores.length,1);
  assert.equal(saved.scores[0].difficulty_tier,'D3');
  assert.equal(saved.scores[0].evidence_count,8);
  assert.equal(saved.assessmentDurationMinutes,null);
  console.log('PASS Passport V68 '+(process.env.QA_BROWSER||'chromium')+': responsive navigation, data, RBAC copy and guided save');
}finally{await browser.close();}
