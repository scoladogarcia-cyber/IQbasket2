import assert from "node:assert/strict";
import { chromium, webkit } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const engine=process.env.QA_BROWSER==="webkit"?webkit:chromium;
const browser=await engine.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

try {
  await installBrowserNetworkStubs(page);
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>Boolean(window.iqApp),null,{timeout:20000});
  await page.evaluate(async()=>{
    const { DataStore }=await import("/services/DataStore.js");
    const { TrainingCompleteEditV54View }=await import("/views/training/TrainingCompleteEditV54View.js");
    const teamId="11111111-1111-4111-8111-111111111111";
    const seasonId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const players=[1,2,3].map(i=>({id:`10000000-0000-4000-8000-00000000000${i}`,first_name:`Jugador ${i}`,last_name:"Test",jersey:i}));
    const otherPlayers=Array.from({length:17},(_,index)=>({
      id:`90000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,
      first_name:`Invitado ${index+1}`,
      last_name:"Memoria",
      jersey:20+index,
      primary_position:"Alero",
      team_name:"Otro equipo",
      is_current_roster:false,
      is_current_team:false
    }));
    const directoryPlayers=[
      ...players.map(p=>({
        player_id:p.id,first_name:p.first_name,last_name:p.last_name,jersey:p.jersey,
        primary_position:"Base",team_name:"Equipo prueba",is_current_roster:true,is_current_team:true
      })),
      ...otherPlayers.map(p=>({player_id:p.id,...p}))
    ];
    const source={
      id:"20000000-0000-4000-8000-000000000001",team_season_id:seasonId,session_date:"2026-10-02",
      title:"Trabajo previo",start_time:"19:00:00",end_time:"20:20:00",duration_minutes:80,intensity:6,status:"COMPLETED",
      objective:"Atacar ventajas",notes:"Nota antigua que no debe clonarse",
      metadata:{training_focus_codes:["TECHNICAL","GAME_5V5"],training_focus_schema_version:"1.0"},
      blocks:[{id:"30000000-0000-4000-8000-000000000001",block_order:1,title:"5c5",activity_code:"SCRIMMAGE",duration_minutes:30,intensity:6,objective:"Decidir rápido"}],
      participants:players.slice(0,2).map((p,i)=>({id:`40000000-0000-4000-8000-00000000000${i+1}`,player_id:p.id,attendance_status:"PRESENT",participated_minutes:80,rpe:6}))
    };
    DataStore.getActiveTeamId=()=>teamId;
    DataStore.getActiveTeamSeasonId=()=>seasonId;
    DataStore.getActiveSeasonContext=()=>({team_season_id:seasonId,name:"2026/2027",start_date:"2026-09-01",end_date:"2027-06-30",data_status:"ACTIVE"});
    DataStore.getActiveSeasonDisplayName=()=> "2026/2027";
    DataStore.getTeamById=()=>({id:teamId,name:"Equipo prueba"});
    DataStore.getSeasonParticipantPlayers=()=>players;
    DataStore.getTeamPlayers=()=>players;
    DataStore.getPlayersEligibleOnDate=()=>players;
    const auth={canPreview:()=>true,can:()=>true};
    const view=new TrainingCompleteEditV54View(null,auth);
    view._load=async function(){
      this.sessions=[source];this.externalSessions=[];this.activityTypes=[];
      this.capabilities={ready:true,training_core:true};this.blockAssignments=[];
      this.completeEditReady=true;this.lastError=null;
    };
    view.service.createSession=async payload=>{window.__v55CreateCalls.push(structuredClone(payload));return "new-session";};
    view.playerDirectoryService.search=async ({query="",page=1,pageSize=15})=>{
      const q=String(query||"").trim().toLowerCase();
      const filtered=q
        ? directoryPlayers.filter(p=>[`${p.first_name} ${p.last_name}`,p.team_name,p.jersey].join(" ").toLowerCase().includes(q))
        : directoryPlayers;
      const start=(page-1)*pageSize;
      return {
        rows:filtered.slice(start,start+pageSize).map(p=>({...p,total_count:filtered.length})),
        page,pageSize,total:filtered.length,pages:filtered.length?Math.ceil(filtered.length/pageSize):0
      };
    };
    document.body.innerHTML='<main id="v55-test"></main>';
    window.__v55CreateCalls=[];
    window.__v55View=view;
    await view.render("v55-test",teamId);
  });

  await page.locator("#p360-create-training-panel > summary").click();
  assert.equal(await page.locator('input[name="p360-training-focus"]').count(),6);
  assert.equal(await page.locator('input[name="p360-training-player"]:checked').count(),3);
  assert.equal(await page.locator('input[name="p360-training-player"]').count(),15);
  assert.match(await page.locator(".p360-player-pagination").textContent(),/máximo 15/);

  await page.locator("#p360-clone-source").selectOption("20000000-0000-4000-8000-000000000001");
  await page.locator("#p360-clone-training").click();

  assert.equal(await page.locator('input[name="p360-training-focus"][value="TECHNICAL"]').isChecked(),true);
  assert.equal(await page.locator('input[name="p360-training-focus"][value="GAME_5V5"]').isChecked(),true);
  assert.equal(await page.locator("#p360-training-start-time").inputValue(),"19:00");
  assert.equal(await page.locator("#p360-training-end-time").inputValue(),"20:20");
  assert.equal(await page.locator("#p360-training-duration").inputValue(),"80");
  assert.equal(await page.locator("#p360-training-notes").inputValue(),"");
  assert.equal(await page.locator(".p360-block-row").count(),1);
  assert.equal(await page.locator('input[name="p360-training-player"]:checked').count(),3);

  await page.locator("#p360-training-date").fill("2026-10-04");
  await page.dispatchEvent("#p360-training-date", "change");
  await page.waitForTimeout(120);

  await page.locator("#p360-player-search").fill("Invitado 17");
  await page.waitForTimeout(350);
  assert.equal(await page.locator('input[name="p360-training-player"]').count(),1);
  await page.locator('input[name="p360-training-player"]').check();
  assert.match(await page.locator(".p360-selected-count").textContent(),/4 seleccionado/);
  await page.locator("#p360-player-search").fill("");
  await page.waitForTimeout(350);
  assert.equal(await page.locator('input[name="p360-training-player"]').count(),15);
  assert.match(await page.locator(".p360-selected-count").textContent(),/4 seleccionado/);
  await page.locator("#p360-training-notes").fill("Salida de presión y finalizaciones con contacto.");
  await page.locator('input[name="p360-training-focus"][value="SHOOT_FINISH"]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.locator('#p360-training-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.__v55CreateCalls.length===1,null,{timeout:12000});

  const saved=await page.evaluate(()=>window.__v55CreateCalls[0]);
  assert.deepEqual(saved.focusCodes.sort(),["GAME_5V5","SHOOT_FINISH","TECHNICAL"]);
  assert.equal(saved.cloneSourceId,"20000000-0000-4000-8000-000000000001");
  assert.equal(saved.entryMode,"CLONE");
  assert.equal(saved.notes,"Salida de presión y finalizaciones con contacto.");
  assert.equal(saved.durationMinutes,80);
  assert.equal(saved.participants.length,4);
  assert.ok(saved.participants.some(row=>row.player_id==="90000000-0000-4000-8000-000000000017"));
  assert.equal(saved.blocks.length,1);
  assert.ok(saved.title.includes("Técnica"));
  console.log(`PASS Training V55 browser ${process.env.QA_BROWSER||"chromium"}: quick checks, default roster and safe clone.`);
} finally {
  await browser.close();
}
