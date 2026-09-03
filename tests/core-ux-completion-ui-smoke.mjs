import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL=process.env.CORE_UX_BASE_URL || "http://127.0.0.1:4173";
const TEAM_ID="11111111-1111-4111-8111-111111111111";
const TS_ID="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P1="10000000-0000-4000-8000-000000000001";
const P2="10000000-0000-4000-8000-000000000002";

function assertCondition(value,label,message) {
  if(!value) throw new Error(`[${label}] ${message}`);
}

async function installBase(page) {
  await page.goto(BASE_URL,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>Boolean(window.iqApp),null,{timeout:20000});
  await page.evaluate(() => {
    document.body.innerHTML='<main id="core-ux-host" style="min-height:100vh;width:100%;"></main>';
  });
}

async function trainingScenario(page,label) {
  await page.evaluate(async ({TEAM_ID,TS_ID,P1,P2}) => {
    const { DataStore }=await import("/services/DataStore.js");
    const { TrainingView }=await import("/views/TrainingView.js");
    const { PermissionService }=await import("/security/PermissionService.js");

    const players=[
      {id:P1,team_id:TEAM_ID,first_name:"Víctor",last_name:"Base",jersey:7},
      {id:P2,team_id:TEAM_ID,first_name:"Paula",last_name:"Escolta",jersey:12}
    ];
    const season={
      team_season_id:TS_ID,teamSeasonId:TS_ID,team_id:TEAM_ID,teamId:TEAM_ID,
      name:"2025/2026",start_date:"2025-09-01",end_date:"2026-06-30",
      data_status:"ACTIVE",source:"v3"
    };

    DataStore.getActiveTeamId=()=>TEAM_ID;
    DataStore.getActiveTeamSeasonId=()=>TS_ID;
    DataStore.getActiveSeasonContext=()=>season;
    DataStore.getActiveSeasonDisplayName=()=>"2025/2026";
    DataStore.getTeamById=()=>({id:TEAM_ID,name:"Equipo Demo"});
    DataStore.getSeasonParticipantPlayers=()=>players;
    DataStore.getPlayersEligibleOnDate=()=>players;
    DataStore.seasons=[season];

    const auth=new PermissionService();
    auth.setCurrentUser({
      id:"coach-user",email:"coach@example.test",role:"ENTRENADOR",
      assigned_team_ids:[TEAM_ID],allowed_team_season_ids:[TS_ID],
      contextualMemberships:[{
        team_season_id:TS_ID,team_id:TEAM_ID,function_role:"ENTRENADOR",status:"ACTIVE"
      }]
    });

    window.__coreTraining={
      updateCalls:[],externalUpdateCalls:[],
      sessions:[{
        id:"session-1",team_season_id:TS_ID,session_date:"2026-02-05",
        title:"Entreno original",objective:"Objetivo original",
        start_time:"18:00:00",end_time:"19:00:00",duration_minutes:60,intensity:6,
        status:"PLANNED",
        blocks:[{id:"b1",block_order:1,title:"Tiro",activity_code:"SHOOTING",duration_minutes:20,intensity:6}],
        participants:[{
          id:"tp1",player_id:P1,attendance_status:"PRESENT",
          participated_minutes:60,rpe:7,internal_load:420,notes:"Carga registrada"
        }]
      }],
      external:[{
        id:"ext-1",team_season_id:TS_ID,player_id:P1,activity_date:"2026-02-06",
        title:"Tecnificación original",provider_type:"EXTERNAL_COACH",
        provider_name:"Academia Demo",duration_minutes:50,intensity:6,rpe:5,
        source_type:"EXTERNAL_COACH",objective:"Tiro",notes:"Nota original"
      }]
    };

    const view=new TrainingView(null,auth);
    window.__coreTrainingView=view;
    view.service.getCapabilities=async()=>({
      ready:true,training_core:true,external_development:true,activity_catalog:true,
      update_training:true,update_external_development:true,frozen_season_guard:true
    });
    view.service.listActivityTypes=async()=>[];
    view.service.listSessions=async()=>structuredClone(window.__coreTraining.sessions);
    view.service.listExternalDevelopment=async()=>structuredClone(window.__coreTraining.external);
    view.service.setParticipant=async()=>true;
    view.service.archiveSession=async()=>true;
    view.service.createSession=async()=>{throw new Error("CREATE_NOT_EXPECTED");};
    view.service.createExternalDevelopment=async()=>{throw new Error("CREATE_EXTERNAL_NOT_EXPECTED");};

    view.service.updateSession=async args=>{
      window.__coreTraining.updateCalls.push(structuredClone(args));
      const session=window.__coreTraining.sessions[0];
      const before=structuredClone(session.participants);
      session.session_date=args.sessionDate;
      session.title=args.title;
      session.objective=args.objective;
      session.start_time=args.startTime;
      session.end_time=args.endTime;
      session.duration_minutes=args.durationMinutes;
      session.intensity=args.intensity;
      session.blocks=(args.blocks||[]).map((item,index)=>({...item,id:"edited-"+index,block_order:index+1}));
      session.participants=before.filter(item=>args.participantIds.includes(item.player_id));
      return session.id;
    };
    view.service.updateExternalDevelopment=async args=>{
      window.__coreTraining.externalUpdateCalls.push(structuredClone(args));
      Object.assign(window.__coreTraining.external[0],{
        player_id:args.playerId,activity_date:args.activityDate,title:args.title,
        provider_type:args.providerType,provider_name:args.providerName,
        duration_minutes:args.durationMinutes,intensity:args.intensity,rpe:args.rpe,
        objective:args.objective,notes:args.notes
      });
      return args.externalDevelopmentId;
    };

    await view.render("core-ux-host",TEAM_ID);
  },{TEAM_ID,TS_ID,P1,P2});

  await page.click(".p360-edit-session");
  await page.waitForSelector('#p360-training-form[data-editing-session-id="session-1"]');
  const prefill=await page.evaluate((playerId)=>({
    title:document.querySelector("#p360-training-title")?.value,
    start:document.querySelector("#p360-training-start-time")?.value,
    end:document.querySelector("#p360-training-end-time")?.value,
    p1Checked:document.querySelector(`input[name="p360-training-player"][value="${playerId}"]`)?.checked,
    duration:document.querySelector("#p360-training-duration")?.value
  }),P1);
  assertCondition(prefill.title==="Entreno original",label,"El entreno no precarga título");
  assertCondition(prefill.start==="18:00" && prefill.end==="19:00",label,"No precarga horario");
  assertCondition(prefill.p1Checked===true,label,"No precarga jugador existente");
  assertCondition(prefill.duration==="60",label,"No precarga duración calculada");

  await page.fill("#p360-training-title","Entreno corregido");
  await page.fill("#p360-training-start-time","18:15");
  await page.fill("#p360-training-end-time","19:15");
  await page.dispatchEvent("#p360-training-end-time","change");
  await page.click('#p360-training-form button[type="submit"]');
  await page.waitForFunction(()=>window.__coreTraining.updateCalls.length===1);

  const trainingResult=await page.evaluate(()=>({
    call:window.__coreTraining.updateCalls[0],
    participant:window.__coreTraining.sessions[0].participants[0],
    cardTitle:document.querySelector(".p360-session-card h3")?.textContent || ""
  }));
  assertCondition(trainingResult.call.title==="Entreno corregido",label,"Update de entreno no envía título");
  assertCondition(trainingResult.call.durationMinutes===60,label,"Update no recalcula duración");
  assertCondition(trainingResult.participant.attendance_status==="PRESENT",label,"Editar entreno borró asistencia");
  assertCondition(trainingResult.participant.rpe===7,label,"Editar entreno borró RPE");
  assertCondition(trainingResult.participant.participated_minutes===60,label,"Editar entreno borró minutos");
  assertCondition(trainingResult.cardTitle.includes("Entreno corregido"),label,"UI no refleja entreno corregido");

  await page.click('[data-p360-tab="external"]');
  await page.click(".p360-edit-external");
  await page.waitForSelector('#p360-external-form[data-editing-external-id="ext-1"]');
  assertCondition(await page.inputValue("#p360-external-title")==="Tecnificación original",label,"Tecnificación no precarga");
  await page.fill("#p360-external-title","Tecnificación corregida");
  await page.fill("#p360-external-provider","Academia Nueva");
  await page.click('#p360-external-form button[type="submit"]');
  await page.waitForFunction(()=>window.__coreTraining.externalUpdateCalls.length===1);

  const externalResult=await page.evaluate(()=>({
    call:window.__coreTraining.externalUpdateCalls[0],
    card:document.querySelector(".p360-external-card h3")?.textContent || "",
    overflow:document.documentElement.scrollWidth>window.innerWidth+1
  }));
  assertCondition(externalResult.call.title==="Tecnificación corregida",label,"Update tecnificación no envía título");
  assertCondition(externalResult.call.providerName==="Academia Nueva",label,"Update tecnificación no envía proveedor");
  assertCondition(externalResult.card.includes("Tecnificación corregida"),label,"UI no refleja tecnificación corregida");
  assertCondition(!externalResult.overflow,label,"Training/tecnificación produce overflow horizontal");
}

async function nutritionScenario(page,label) {
  await page.evaluate(async ({TEAM_ID,TS_ID,P1}) => {
    const { Player360View }=await import("/views/Player360View.js");
    const { PermissionService }=await import("/security/PermissionService.js");

    const auth=new PermissionService();
    auth.setCurrentUser({
      id:"coach-user",email:"coach@example.test",role:"ENTRENADOR",
      assigned_team_ids:[TEAM_ID],allowed_team_season_ids:[TS_ID],
      contextualMemberships:[{
        team_season_id:TS_ID,team_id:TEAM_ID,function_role:"ENTRENADOR",status:"ACTIVE"
      }]
    });

    const view=new Player360View(null,auth);
    view.teamId=TEAM_ID;
    view.teamSeasonId=TS_ID;
    view.player={id:P1};
    view.wellnessPanel.isAvailable=()=>true;

    const host=document.querySelector("#core-ux-host");
    host.innerHTML='<div id="tabs-host"></div>';
    host.querySelector("#tabs-host").innerHTML=view._renderTabs();
    window.__nutritionTabs={
      text:host.textContent || "",
      nutrition:Boolean(host.querySelector('[data-p360c-tab="nutrition"]')),
      recovery:Boolean(host.querySelector('[data-p360c-tab="recovery"]')),
      support:Boolean(host.querySelector('[data-p360c-tab="wellness"]'))
    };
  },{TEAM_ID,TS_ID,P1});

  const tabs=await page.evaluate(()=>window.__nutritionTabs);
  assertCondition(tabs.nutrition,label,"Nutrición no aparece como pestaña de primer nivel");
  assertCondition(tabs.recovery,label,"Recuperación no aparece como pestaña de primer nivel");
  assertCondition(!tabs.support,label,"Sigue apareciendo la pestaña genérica Apoyo");
}

async function boxscoreScenario(page,label) {
  await page.evaluate(async ({TEAM_ID,TS_ID,P1,P2}) => {
    const { DataStore }=await import("/services/DataStore.js");
    const { GameBoxScoreView }=await import("/views/GameBoxScoreView.js");
    const { PermissionService }=await import("/security/PermissionService.js");

    const players=[
      {id:P1,team_id:TEAM_ID,first_name:"Víctor",last_name:"Base",jersey:7},
      {id:P2,team_id:TEAM_ID,first_name:"Paula",last_name:"Escolta",jersey:12}
    ];
    const openGame={
      id:"game-open",team_id:TEAM_ID,team_season_id:TS_ID,date:"2026-02-10",
      opponent:"Rival A",team_score:2,opponent_score:0,edit_state:"OPEN",
      starter_ids:[P1],period_minutes:10,overtime_minutes:5
    };
    const lockedGame={
      ...openGame,id:"game-locked",opponent:"Rival B",edit_state:"LOCKED"
    };
    const statsByGame={
      "game-open":[
        {game_id:"game-open",player_id:P1,starter:true,minutes:10,points:2,fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:0,blocks_made:0,turnovers:0,fouls_committed:0,fouls_drawn:0},
        {game_id:"game-open",player_id:P2,starter:false,minutes:0,points:0,fg2_made:0,fg2_attempted:0,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:0,blocks_made:0,turnovers:0,fouls_committed:0,fouls_drawn:0}
      ],
      "game-locked":[
        {game_id:"game-locked",player_id:P1,starter:true,minutes:10,points:2,fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,steals:0,blocks_made:0,turnovers:0,fouls_committed:0,fouls_drawn:0}
      ]
    };

    DataStore.getGames=()=>[openGame,lockedGame];
    DataStore.getSeasonParticipantPlayers=()=>players;
    DataStore.getPlayers=()=>players;
    DataStore.getPlayerGameStats=(_playerId,gameId)=>structuredClone(statsByGame[gameId]||[]);
    DataStore.getActiveTeamId=()=>TEAM_ID;
    DataStore.getActiveTeamSeasonId=()=>TS_ID;
    DataStore.getActiveSeasonContext=()=>({team_season_id:TS_ID,team_id:TEAM_ID,data_status:"ACTIVE"});
    DataStore.loadGameEvents=async ids=>ids.includes("game-open")
      ? [{game_id:"game-open",player_id:P1,action_type:"fg2_made",period:1,game_clock:"09:30"}]
      : [];
    DataStore.getGameEvents=()=>[];
    DataStore.init=async()=>true;

    const auth=new PermissionService();
    auth.setCurrentUser({
      id:"coach-user",email:"coach@example.test",role:"ENTRENADOR",
      assigned_team_ids:[TEAM_ID],allowed_team_season_ids:[TS_ID],
      contextualMemberships:[{
        team_season_id:TS_ID,team_id:TEAM_ID,function_role:"ENTRENADOR",status:"ACTIVE"
      }]
    });

    window.__boxscoreCalls=[];
    const fakeSupabase={
      async rpc(name,args={}) {
        if(name==="iq_core_ux_can_edit_boxscore") {
          return {data:args.p_game_id==="game-open",error:null};
        }
        if(name==="iq_core_ux_save_boxscore_correction") {
          window.__boxscoreCalls.push(structuredClone(args));
          return {data:true,error:null};
        }
        return {data:null,error:{message:"Unexpected RPC "+name}};
      }
    };

    const view=new GameBoxScoreView(fakeSupabase,auth);
    window.__boxscoreView=view;
    await view.render("core-ux-host","game-open");
  },{TEAM_ID,TS_ID,P1,P2});

  await page.waitForSelector("#btn-save-boxscore");
  const openState=await page.evaluate(()=>({
    enabled:[...document.querySelectorAll(".bs-input")].every(el=>!el.disabled),
    width:document.querySelector(".bs-input")?.getBoundingClientRect().width || 0,
    height:document.querySelector(".bs-input")?.getBoundingClientRect().height || 0,
    hasMode:(document.body.textContent || "").includes("Modo corrección de acta"),
    consistency:(document.querySelector("#boxscore-consistency-status")?.textContent || "").replace(/\s+/g," ").trim(),
    pbpLink:document.querySelector('a[href="#/live-entry/game-open"]')?.getAttribute("href") || ""
  }));
  assertCondition(openState.enabled,label,"Partido OPEN sigue con Boxscore deshabilitado");
  assertCondition(openState.width>=44 && openState.height>=44,label,"Inputs Boxscore no alcanzan 44×44");
  assertCondition(openState.hasMode,label,"Falta modo corrección de acta");
  assertCondition(openState.consistency.includes("coinciden"),label,"No compara Boxscore con Play-by-Play");
  assertCondition(openState.pbpLink==="#/live-entry/game-open",label,"Falta acceso a corregir Play-by-Play");

  const assistInput=page.locator(`tr[data-player-id="${P1}"] .bs-input[data-field="assists"]`);
  await assistInput.fill("1");
  await page.waitForFunction(()=>document.querySelector("#boxscore-consistency-status")?.textContent?.includes("discrepancia"));
  await page.fill("#boxscore-correction-reason","Corrección según acta oficial");

  let confirms=0;
  page.on("dialog",async dialog=>{
    if(dialog.type()==="confirm") confirms+=1;
    await dialog.accept();
  });
  await page.click("#btn-save-boxscore");
  await page.waitForFunction(()=>window.__boxscoreCalls.length===1);

  const save=await page.evaluate(()=>window.__boxscoreCalls[0]);
  assertCondition(save.p_source_mode==="MANUAL_OVERRIDE",label,"Con PBP no usa modo MANUAL_OVERRIDE");
  assertCondition(save.p_reason==="Corrección según acta oficial",label,"No audita motivo");
  assertCondition(save.p_discrepancies.some(item=>item.metric==="assists"),label,"No persiste discrepancia");
  assertCondition(confirms===1,label,"No pide confirmación ante discrepancia");

  await page.evaluate(async () => {
    await window.__boxscoreView.render("core-ux-host","game-locked");
  });
  const lockedState=await page.evaluate(()=>({
    save:Boolean(document.querySelector("#btn-save-boxscore")),
    disabled:[...document.querySelectorAll(".bs-input")].every(el=>el.disabled),
    readOnly:(document.body.textContent || "").includes("Solo Lectura") || (document.body.textContent || "").includes("Solo lectura")
  }));
  assertCondition(!lockedState.save,label,"Partido LOCKED muestra Guardar Boxscore");
  assertCondition(lockedState.disabled,label,"Partido LOCKED tiene inputs editables");
  assertCondition(lockedState.readOnly,label,"Partido LOCKED no comunica sólo lectura");
}

async function runViewport(browser,label,viewport) {
  const page=await browser.newPage({viewport});
  await installBrowserNetworkStubs(page);
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",msg=>{ if(msg.type()==="error" && !/favicon|404/i.test(msg.text())) errors.push(msg.text()); });

  await installBase(page);
  await trainingScenario(page,label);
  await nutritionScenario(page,label);
  await boxscoreScenario(page,label);

  const finalState=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth>window.innerWidth+1
  }));
  assertCondition(!finalState.overflow,label,"El bloque Core UX produce overflow horizontal global");
  assertCondition(errors.length===0,label,"Errores de navegador: "+errors.join(" | "));

  console.log(JSON.stringify({viewport:label,status:"PASS"}));
  await page.close();
}

const browser=await chromium.launch({headless:true});
try {
  await runViewport(browser,"desktop-1440x900",{width:1440,height:900});
  await runViewport(browser,"iphone-390x844",{width:390,height:844});
  console.log("CORE_UX_COMPLETION_UI_OK");
} finally {
  await browser.close();
}
