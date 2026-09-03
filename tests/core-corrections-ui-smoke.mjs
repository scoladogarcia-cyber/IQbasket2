import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL=process.env.CORE_CORRECTIONS_BASE_URL || "http://127.0.0.1:4173/";
const TEAM_ID="11111111-1111-4111-8111-111111111111";
const TS_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEASON_ID="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P1="10000000-0000-4000-8000-000000000001";
const P2="10000000-0000-4000-8000-000000000002";
const GAME_ID="20000000-0000-4000-8000-000000000001";

function check(condition,name,message) {
  if(!condition) throw new Error(`[${name}] ${message}`);
}

async function trainingScenario(page,name) {
  await page.evaluate(async ({TEAM_ID,TS_ID,SEASON_ID,P1,P2}) => {
    const {DataStore}=await import("/services/DataStore.js");
    const {TrainingView}=await import("/views/TrainingView.js");
    const {PermissionService}=await import("/security/PermissionService.js");

    const players=[
      {id:P1,team_id:TEAM_ID,first_name:"Víctor",last_name:"Base",jersey:7},
      {id:P2,team_id:TEAM_ID,first_name:"Paula",last_name:"Escolta",jersey:12}
    ];
    const season={
      team_season_id:TS_ID,teamSeasonId:TS_ID,team_id:TEAM_ID,teamId:TEAM_ID,
      season_id:SEASON_ID,name:"2025/2026",start_date:"2025-09-01",end_date:"2026-06-30"
    };

    DataStore.getActiveTeamId=()=>TEAM_ID;
    DataStore.getActiveTeamSeasonId=()=>TS_ID;
    DataStore.getActiveSeasonContext=()=>season;
    DataStore.getActiveSeasonDisplayName=()=>"2025/2026";
    DataStore.getTeamById=()=>({id:TEAM_ID,name:"Equipo Demo"});
    DataStore.getSeasonParticipantPlayers=()=>players;
    DataStore.getTeamPlayers=()=>players;
    DataStore.getPlayersForActiveSeason=()=>players;
    DataStore.getPlayersEligibleOnDate=()=>players;

    const auth=new PermissionService();
    auth.setCurrentUser({
      id:"coach-user",email:"coach@example.test",role:"ENTRENADOR",global_role:"ENTRENADOR",
      assigned_team_ids:[TEAM_ID],allowed_team_season_ids:[TS_ID],
      contextualMemberships:[{
        team_season_id:TS_ID,team_id:TEAM_ID,season_id:SEASON_ID,
        function_role:"ENTRENADOR",status:"ACTIVE"
      }]
    });

    window.__core={
      updates:[],externalUpdates:[],
      sessions:[{
        id:"session-1",team_season_id:TS_ID,session_date:"2026-02-05",
        start_time:"17:00:00",end_time:"18:15:00",duration_minutes:75,
        title:"Sesión existente",objective:"Trabajo técnico",intensity:6.5,status:"COMPLETED",
        blocks:[{
          id:"block-1",training_session_id:"session-1",block_order:1,
          title:"Finalizaciones",activity_code:"FINISHING",duration_minutes:20,intensity:7
        }],
        participants:[{
          id:"part-1",training_session_id:"session-1",player_id:P1,
          attendance_status:"PRESENT",participated_minutes:60,rpe:6,internal_load:360,notes:""
        }]
      }],
      external:[{
        id:"external-1",team_season_id:TS_ID,player_id:P1,activity_date:"2026-02-06",
        title:"Tecnificación tiro",provider_type:"EXTERNAL_COACH",provider_name:"Academia Demo",
        source_type:"EXTERNAL_COACH",duration_minutes:50,intensity:6,rpe:5,
        internal_load:250,objective:"Tiro exterior",notes:"Inicial"
      }]
    };

    const view=new TrainingView(null,auth);
    window.__coreView=view;
    view.service.getCapabilities=async()=>({
      ready:true,training_core:true,training_edit:true,
      external_development:true,external_development_edit:true,
      activity_catalog:true,temporal_roster_validation:true
    });
    view.service.listActivityTypes=async()=>[];
    view.service.listSessions=async()=>structuredClone(window.__core.sessions);
    view.service.listExternalDevelopment=async()=>structuredClone(window.__core.external);
    view.service.updateSession=async args=>{
      window.__core.updates.push(structuredClone(args));
      const row=window.__core.sessions.find(x=>x.id===args.trainingSessionId);
      Object.assign(row,{
        session_date:args.sessionDate,title:args.title,objective:args.objective,
        duration_minutes:args.durationMinutes,intensity:args.intensity,
        start_time:args.startTime,end_time:args.endTime,
        blocks:(args.blocks||[]).map((b,i)=>({...b,training_session_id:row.id,block_order:i+1}))
      });
      return row.id;
    };
    view.service.updateExternalDevelopment=async args=>{
      window.__core.externalUpdates.push(structuredClone(args));
      const row=window.__core.external.find(x=>x.id===args.externalSessionId);
      Object.assign(row,{
        player_id:args.playerId,activity_date:args.activityDate,title:args.title,
        activity_code:args.activityCode,provider_type:args.providerType,
        provider_name:args.providerName,objective:args.objective,
        duration_minutes:args.durationMinutes,intensity:args.intensity,rpe:args.rpe,
        source_type:args.sourceType,notes:args.notes
      });
      return row.id;
    };
    view.service.createSession=async()=>{throw new Error("UNEXPECTED_CREATE_TRAINING");};
    view.service.createExternalDevelopment=async()=>{throw new Error("UNEXPECTED_CREATE_EXTERNAL");};
    view.service.setParticipant=async()=>true;
    view.service.archiveSession=async()=>true;

    document.body.innerHTML='<main id="core-host"></main>';
    await view.render("core-host",TEAM_ID);
  },{TEAM_ID,TS_ID,SEASON_ID,P1,P2});

  const edit=page.locator(".p360-edit-session").first();
  check(await edit.count()===1,name,"Falta Editar sesión");
  await edit.click();
  await page.waitForSelector('#p360-training-form[data-editing-session-id="session-1"]');

  const pre=await page.evaluate(()=>({
    title:document.querySelector("#p360-training-title")?.value,
    start:document.querySelector("#p360-training-start-time")?.value,
    end:document.querySelector("#p360-training-end-time")?.value,
    confirmedChecked:document.querySelector('input[name="p360-training-player"][value="10000000-0000-4000-8000-000000000001"]')?.checked,
    confirmedDisabled:document.querySelector('input[name="p360-training-player"][value="10000000-0000-4000-8000-000000000001"]')?.disabled,
    blockId:document.querySelector(".p360-block-row")?.dataset.blockId,
    overflow:document.documentElement.scrollWidth>window.innerWidth+1
  }));
  check(pre.title==="Sesión existente",name,"Edición entrenamiento no precarga título");
  check(pre.start==="17:00" && pre.end==="18:15",name,"Edición no precarga horario");
  check(pre.confirmedChecked && pre.confirmedDisabled,name,"Asistencia confirmada no queda protegida");
  check(pre.blockId==="block-1",name,"Edición pierde identidad del bloque");
  check(!pre.overflow,name,"Overflow al editar entrenamiento");

  await page.fill("#p360-training-title","Sesión corregida");
  await page.fill("#p360-training-end-time","18:30");
  await page.dispatchEvent("#p360-training-end-time","input");
  await page.locator('#p360-training-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.__core.updates.length===1);

  const updated=await page.evaluate(()=>({
    call:window.__core.updates[0],
    title:window.__core.sessions[0].title,
    visible:[...document.querySelectorAll(".p360-session-card h3")].some(x=>x.textContent.includes("Sesión corregida"))
  }));
  check(updated.call.durationMinutes===90,name,"Duración editada no se recalcula desde horario");
  check(updated.call.blocks[0].id==="block-1",name,"Update no conserva block id");
  check(updated.title==="Sesión corregida" && updated.visible,name,"Entrenamiento editado no se refleja");

  await page.locator('[data-p360-tab="external"]').click();
  const externalEdit=page.locator(".p360-edit-external").first();
  check(await externalEdit.count()===1,name,"Falta Editar tecnificación");
  await externalEdit.click();
  await page.waitForSelector('#p360-external-form[data-editing-external-id="external-1"]');
  check(await page.inputValue("#p360-external-title")==="Tecnificación tiro",name,"Tecnificación no precarga");
  await page.fill("#p360-external-title","Tecnificación corregida");
  await page.fill("#p360-external-provider","Academia Corregida");
  await page.locator('#p360-external-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.__core.externalUpdates.length===1);

  const ext=await page.evaluate(()=>({
    call:window.__core.externalUpdates[0],
    title:window.__core.external[0].title,
    visible:[...document.querySelectorAll(".p360-external-card h3")].some(x=>x.textContent.includes("Tecnificación corregida")),
    overflow:document.documentElement.scrollWidth>window.innerWidth+1
  }));
  check(ext.call.externalSessionId==="external-1",name,"Update tecnificación usa ID incorrecto");
  check(ext.title==="Tecnificación corregida" && ext.visible,name,"Tecnificación editada no se refleja");
  check(!ext.overflow,name,"Overflow tras editar tecnificación");
}

async function player360TabsScenario(page,name) {
  const result=await page.evaluate(async () => {
    const {Player360View}=await import("/views/Player360View.js");
    const view=new Player360View(null,null);
    view.wellnessPanel={
      isModuleAvailable:module=>["nutrition","recovery"].includes(module),
      isAvailable:()=>true
    };
    view.analyticsPanel={isAvailable:()=>false};
    view._can=()=>false;
    view.activeTab="nutrition";
    const tabs=view._renderTabs();
    return {tabs};
  });
  check(result.tabs.includes("🥤 Nutrición"),name,"Nutrición no está visible como pestaña propia");
  check(result.tabs.includes("🌙 Recuperación"),name,"Recuperación no está visible como pestaña propia");
  check(!result.tabs.includes("🌱 Apoyo"),name,"Sigue apareciendo la pestaña genérica Apoyo");
}

async function boxscoreScenario(page,name) {
  await page.evaluate(async ({TEAM_ID,TS_ID,SEASON_ID,P1,GAME_ID}) => {
    const {DataStore}=await import("/services/DataStore.js");
    const {GameBoxScoreView}=await import("/views/GameBoxScoreView.js");
    const {PermissionService}=await import("/security/PermissionService.js");

    const player={id:P1,team_id:TEAM_ID,first_name:"Paula",last_name:"Escolta",jersey:12};
    const game={
      id:GAME_ID,team_id:TEAM_ID,team_season_id:TS_ID,season_id:SEASON_ID,
      date:"2026-05-10",opponent:"Rival",team_score:20,opponent_score:18,
      starter_ids:[P1],edit_state:"OPEN",status:"Finalizado"
    };
    const stats=[{
      game_id:GAME_ID,player_id:P1,starter:true,minutes:20,points:10,
      fg2_made:2,fg2_attempted:4,fg3_made:2,fg3_attempted:5,
      ft_made:0,ft_attempted:0,off_reb:1,def_reb:2,assists:3,steals:1,
      blocks:0,turnovers:1,fouls_committed:1,fouls_drawn:2
    }];
    window.__box={game,stats,events:[],saves:[]};

    DataStore.getActiveTeamId=()=>TEAM_ID;
    DataStore.getActiveTeamSeasonId=()=>TS_ID;
    DataStore.getGames=()=>[window.__box.game];
    DataStore.getSeasonParticipantPlayers=()=>[player];
    DataStore.getPlayers=()=>[player];
    DataStore.getPlayerGameStats=()=>structuredClone(window.__box.stats);
    DataStore.getGameEvents=()=>structuredClone(window.__box.events);
    DataStore.init=async()=>true;

    const makeAuth=role=>{
      const auth=new PermissionService();
      auth.setCurrentUser({
        id:"user-"+role,email:role==="INVITADO"?"test@test.com":"user@example.test",
        role,global_role:role,assigned_team_ids:[TEAM_ID],allowed_team_season_ids:[TS_ID],
        contextualMemberships:role==="INVITADO"?[]:[{
          team_season_id:TS_ID,team_id:TEAM_ID,season_id:SEASON_ID,function_role:role,status:"ACTIVE"
        }]
      });
      return auth;
    };

    async function render(role) {
      const view=new GameBoxScoreView(null,makeAuth(role));
      view.correctionService.saveManualBoxScore=async payload=>{
        window.__box.saves.push(structuredClone(payload));
        return {game_id:payload.gameId,updated_players:payload.stats.length};
      };
      window.__boxView=view;
      document.body.innerHTML='<main id="box-host"></main>';
      await view.render("box-host",GAME_ID);
    }
    window.__renderBox=render;
    await render("ENTRENADOR");
  },{TEAM_ID,TS_ID,SEASON_ID,P1,GAME_ID});

  let state=await page.evaluate(()=>({
    code:document.querySelector(".boxscore-edit-state")?.dataset.editability,
    save:Boolean(document.querySelector("#btn-save-boxscore")),
    disabled:document.querySelector(".bs-input")?.disabled,
    height:document.querySelector(".bs-input")?.getBoundingClientRect().height,
    overflow:document.documentElement.scrollWidth>window.innerWidth+1
  }));
  check(state.code==="MANUAL_BOXSCORE" && state.save && !state.disabled,name,"Boxscore manual abierto no queda editable");
  check(state.height>=43,name,"Inputs boxscore no son táctiles");
  // El contenedor de tabla puede hacer scroll; no exigimos que la tabla completa quepa.

  await page.locator('.bs-input[data-field="minutes"]').first().fill("22");
  await page.locator("#btn-save-boxscore").click();
  await page.waitForFunction(()=>window.__box.saves.length===1);
  const saved=await page.evaluate(()=>window.__box.saves[0]);
  check(saved.gameId===GAME_ID && saved.stats[0].minutes===22,name,"Guardado manual no llega al servicio");

  await page.evaluate(async () => {
    window.__box.events=[{id:"event-1",game_id:window.__box.game.id,action_type:"fg2_made"}];
    await window.__renderBox("ENTRENADOR");
  });
  state=await page.evaluate(()=>({
    code:document.querySelector(".boxscore-edit-state")?.dataset.editability,
    save:Boolean(document.querySelector("#btn-save-boxscore")),
    pbp:Boolean(document.querySelector("#btn-correct-pbp")),
    disabled:document.querySelector(".bs-input")?.disabled
  }));
  check(state.code==="PLAY_BY_PLAY_SOURCE" && !state.save && state.pbp && state.disabled,name,"PBP no protege boxscore derivado");

  await page.evaluate(async () => {
    window.__box.events=[];
    window.__box.game.edit_state="LOCKED";
    await window.__renderBox("ENTRENADOR");
  });
  state=await page.evaluate(()=>({
    code:document.querySelector(".boxscore-edit-state")?.dataset.editability,
    save:Boolean(document.querySelector("#btn-save-boxscore")),
    disabled:document.querySelector(".bs-input")?.disabled
  }));
  check(state.code==="GAME_LOCKED" && !state.save && state.disabled,name,"Partido cerrado permite editar boxscore");

  await page.evaluate(async () => {
    window.__box.game.edit_state="OPEN";
    await window.__renderBox("INVITADO");
  });
  state=await page.evaluate(()=>({
    code:document.querySelector(".boxscore-edit-state")?.dataset.editability,
    save:Boolean(document.querySelector("#btn-save-boxscore")),
    disabled:document.querySelector(".bs-input")?.disabled
  }));
  check(state.code==="READ_ONLY_ROLE" && !state.save && state.disabled,name,"INVITADO puede editar boxscore");
}

for(const spec of [
  {name:"desktop-1440x900",viewport:{width:1440,height:900}},
  {name:"iphone-390x844",viewport:{width:390,height:844}}
]) {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:spec.viewport});
  await installBrowserNetworkStubs(page);
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("dialog",async dialog=>dialog.accept());
  await page.goto(BASE_URL,{waitUntil:"domcontentloaded"});
  await trainingScenario(page,spec.name);
  await player360TabsScenario(page,spec.name);
  await boxscoreScenario(page,spec.name);
  if(errors.length) throw new Error(`[${spec.name}] pageerror: ${errors.join(" | ")}`);
  console.log(JSON.stringify({viewport:spec.name,status:"PASS"}));
  await browser.close();
}

console.log("CORE_CORRECTIONS_UI_SMOKE_OK");
