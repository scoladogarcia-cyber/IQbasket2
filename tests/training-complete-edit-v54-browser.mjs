import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';
import { installBrowserNetworkStubs } from './browser-test-support.mjs';
const engine=process.env.QA_BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
try {
  await installBrowserNetworkStubs(page);
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.iqApp),null,{timeout:20000});
  await page.evaluate(async()=>{
    const { DataStore }=await import('/services/DataStore.js');
    const { TrainingCompleteEditV54View }=await import('/views/training/TrainingCompleteEditV54View.js');
    const teamId='11111111-1111-4111-8111-111111111111';
    const seasonId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const players=[1,2,3].map(i=>({id:`10000000-0000-4000-8000-00000000000${i}`,first_name:`Jugador ${i}`,last_name:'Test',jersey:i}));
    const session={id:'20000000-0000-4000-8000-000000000001',team_season_id:seasonId,session_date:'2026-09-17',
      title:'Entreno inicial',start_time:'20:00:00',end_time:'21:00:00',duration_minutes:60,intensity:7,status:'PLANNED',
      notes:null,objective:'Tiro',metadata:{training_type:'TECHNICAL'},updated_at:'2026-09-21T06:00:00+00:00',
      blocks:[
        {id:'30000000-0000-4000-8000-000000000001',block_order:1,title:'Primer bloque',duration_minutes:30,activity_code:'SHOOT',updated_at:'2026-09-21T06:01:00+00:00'},
        {id:'30000000-0000-4000-8000-000000000002',block_order:2,title:'Segundo bloque',duration_minutes:30,activity_code:'FIT',updated_at:'2026-09-21T06:02:00+00:00'}
      ],participants:[1,2].map(i=>({id:`40000000-0000-4000-8000-00000000000${i}`,player_id:players[i-1].id,
        attendance_status:'PRESENT',participated_minutes:60,rpe:7,updated_at:`2026-09-21T06:03:0${i}+00:00`}))};
    const assignments=[{id:'50000000-0000-4000-8000-000000000001',block_id:session.blocks[0].id,
      participant_id:session.participants[0].id,participation_status:'FULL',participated_minutes:30,
      updated_at:'2026-09-21T06:04:00+00:00'}];
    DataStore.getActiveTeamId=()=>teamId;
    DataStore.getActiveTeamSeasonId=()=>seasonId;
    DataStore.getActiveSeasonContext=()=>({team_season_id:seasonId,name:'2026/2027',start_date:'2026-09-01',end_date:'2027-06-30',data_status:'ACTIVE'});
    DataStore.getActiveSeasonDisplayName=()=> '2026/2027';
    DataStore.getTeamById=()=>({id:teamId,name:'Equipo prueba'});
    DataStore.getSeasonParticipantPlayers=()=>players;
    DataStore.getTeamPlayers=()=>players;
    DataStore.getPlayersEligibleOnDate=(_team,date)=>date<'2026-09-12'?players.filter(p=>p.id!==players[1].id):players;
    const auth={canPreview:()=>true,can:()=>true};
    const view=new TrainingCompleteEditV54View(null,auth);
    view._load=async function(){this.sessions=[session];this.externalSessions=[];this.activityTypes=[];
      this.capabilities={ready:true,training_core:true};this.blockAssignments=assignments;
      this.completeEditReady=true;this.lastError=null;};
    view.completeService.saveComplete=async payload=>{window.__v54Calls.push(payload);return session.id;};
    document.body.innerHTML='<main id="v54-test"></main>';
    window.__v54Calls=[];
    window.__v54View=view;
    await view.render('v54-test',teamId);
  });
  await page.locator('.p360-edit-session').click();
  const form=page.locator('.v54-complete-form');
  await form.waitFor();
  assert.equal(await form.locator('.v54-date').inputValue(),'2026-09-17');
  assert.equal(await form.locator('.v54-person').count(),3);
  // Changing the date must warn rather than silently discard a confirmed player.
  await form.locator('.v54-date').fill('2026-09-08');
  assert.equal(await form.locator('.v54-eligibility-warning').isVisible(),true);
  await form.locator('.v54-date').fill('2026-09-18');
  assert.equal(await form.locator('.v54-eligibility-warning').isVisible(),false);
  await form.locator('.v54-type').selectOption('TACTICAL');
  await form.locator('.v54-title').fill('Entrenamiento corregido');
  await form.locator('.v54-intensity').fill('5.5');
  const person1=form.locator('.v54-person[data-player-id="10000000-0000-4000-8000-000000000001"]');
  await person1.locator('.v54-person-status').selectOption('PARTIAL');
  await person1.locator('.v54-person-minutes').fill('30');
  await person1.locator('.v54-exceptions summary').click();
  await person1.locator('.v54-assignment').nth(0).locator('.v54-part-status').selectOption('FULL');
  await person1.locator('.v54-assignment').nth(1).locator('.v54-part-status').selectOption('NOT_ATTENDED');
  await person1.locator('.v54-assignment').nth(1).locator('.v54-part-reason').selectOption('LIMITED');
  // Remove another participant explicitly, add a missing one, and add/delete a draft block.
  await form.locator('.v54-person[data-player-id="10000000-0000-4000-8000-000000000002"] .v54-person-included').uncheck();
  await form.locator('.v54-person[data-player-id="10000000-0000-4000-8000-000000000003"] .v54-person-included').check();
  await form.locator('.v54-add-block').click();
  await form.locator('.v54-block').nth(2).locator('.v54-remove-block').click();
  await form.locator('.v54-add-block').click();
  await form.locator('.v54-block').nth(2).locator('.v54-block-title').fill('Bloque añadido');
  await form.locator('.v54-block').nth(2).locator('.v54-block-minutes').fill('30');
  page.once('dialog',dialog=>dialog.accept());
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>window.__v54Calls.length===1,{},{timeout:12000});
  const saved=await page.evaluate(()=>window.__v54Calls[0]);
  assert.equal(saved.date,'2026-09-18');
  assert.equal(saved.trainingType,'TACTICAL');
  assert.equal(saved.intensity,5.5);
  assert.equal(saved.blocks.length,3);
  assert.equal(saved.blocks[2].title,'Bloque añadido');
  assert.equal(saved.participants.length,2);
  assert.equal(saved.removed.length,1);
  assert.equal(saved.confirmedRemovals,true);
  assert.equal(saved.participants[0].blocks[1].status,'NOT_ATTENDED');
  assert.equal(saved.participants[0].blocks[1].reason,'LIMITED');
  assert.equal(saved.revision.assignments.length,1);
  console.log(`PASS Training V54 browser ${process.env.QA_BROWSER||'chromium'}: date, type, intensity, blocks, roster and exceptional participation.`);
} finally { await browser.close(); }
