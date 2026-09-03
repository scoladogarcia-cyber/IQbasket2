import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL=process.env.PLAYER360_BASE_URL || "http://127.0.0.1:4173";

async function installFixture(page) {
  await page.goto(BASE_URL,{waitUntil:"domcontentloaded"});

  await page.evaluate(async () => {
    const { WellnessSupportPanel }=await import("/views/player360/WellnessSupportPanel.js");

    const metrics={
      recovery:[
        {
          id:"m-fatigue",module:"recovery",code:"FATIGUE",name:"Fatiga percibida",
          description:"Sensación general de fatiga antes de la actividad.",
          value_type:"SCALE",unit:"SCALE_1_5",min_value:1,max_value:5,step:1,options:[]
        },
        {
          id:"m-readiness",module:"recovery",code:"READINESS",name:"Preparación percibida",
          description:"Sensación general de preparación.",
          value_type:"SCALE",unit:"SCALE_1_5",min_value:1,max_value:5,step:1,options:[]
        }
      ],
      nutrition:[
        {
          id:"m-hydration",module:"nutrition",code:"HYDRATION_ADHERENCE",name:"Hidratación percibida",
          description:"Cumplimiento percibido de la pauta personal.",
          value_type:"SCALE",unit:"SCALE_1_5",min_value:1,max_value:5,step:1,options:[]
        },
        {
          id:"m-fueling",module:"nutrition",code:"PRE_TRAINING_FUELING",name:"Ingesta previa planificada",
          description:"Se siguió la pauta personal prevista.",
          value_type:"BOOLEAN",unit:"BOOLEAN",min_value:null,max_value:null,step:null,options:[]
        }
      ]
    };

    const store={recovery:[],nutrition:[]};
    window.__wellnessCalls={save:[],archive:[],externalImport:0,ai:0};

    const service={
      supabase:{},
      async resolveAccessContext({module}) {
        return {
          ready:true,module,purpose:"PLAYER_SELF_SERVICE",
          can_read:true,can_create:true,can_update:true,can_archive:true,
          manual_input_enabled:true,external_import_enabled:false,
          recommendations_enabled:true,ai_processing_enabled:false
        };
      },
      async listMetrics({module}) {
        return structuredClone(metrics[module] || []);
      },
      async listEntries({module}) {
        return structuredClone(store[module] || []);
      },
      async saveManualEntry(payload) {
        window.__wellnessCalls.save.push(structuredClone(payload));
        const id=payload.entryId || `entry-${window.__wellnessCalls.save.length}`;
        const moduleMetrics=new Map((metrics[payload.module] || []).map(item=>[item.code,item]));
        const entry={
          id,
          player_id:payload.playerId,
          team_season_id:payload.teamSeasonId,
          module:payload.module,
          entry_date:payload.entryDate,
          source_type:"PLAYER_SELF_REPORT",
          captured_by:"user-1",
          created_at:"2026-09-03T12:00:00.000Z",
          updated_at:"2026-09-03T12:00:00.000Z",
          observations:payload.values.map(item=>{
            const metric=moduleMetrics.get(item.metric_code);
            return {
              metric_code:item.metric_code,
              value_type:metric?.value_type || "SCALE",
              value:item.value,
              unit:metric?.unit || null,
              quality:1
            };
          })
        };
        const index=store[payload.module].findIndex(item=>item.id===id);
        if(index>=0) store[payload.module][index]=entry;
        else store[payload.module].unshift(entry);
        return id;
      },
      async archiveEntry({entryId}) {
        window.__wellnessCalls.archive.push(entryId);
        for(const module of Object.keys(store)) {
          const index=store[module].findIndex(item=>item.id===entryId);
          if(index>=0) store[module].splice(index,1);
        }
        return true;
      }
    };

    const panel=new WellnessSupportPanel({service,can:()=>true});
    await panel.load({
      teamId:"team-1",
      teamSeasonId:"team-season-1",
      playerId:"player-1",
      dateBounds:{min:"2025-09-01",max:"2026-06-30"}
    });

    const container=document.createElement("main");
    container.id="wellness-test-root";
    document.body.innerHTML="";
    document.body.appendChild(container);

    async function renderPanel() {
      container.innerHTML=panel.render();
      await panel.bind(container,{onChanged:renderPanel});
    }

    window.__wellnessPanel=panel;
    window.__wellnessStore=store;
    window.__wellnessRefresh=renderPanel;
    await renderPanel();
  });
}

async function runViewport(name,viewport) {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  await installBrowserNetworkStubs(page);

  const pageErrors=[];
  const consoleErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  page.on("console",message=>{
    if(message.type()==="error") consoleErrors.push(message.text());
  });
  page.on("dialog",async dialog=>dialog.accept());

  await installFixture(page);

  const initial=await page.evaluate(()=>({
    hasRecovery:(document.body.textContent || "").includes("Recuperación"),
    hasNutrition:(document.body.textContent || "").includes("Nutrición"),
    hasPrivacyCopy:(document.body.textContent || "").includes("No recoge diagnósticos"),
    externalButtons:[...document.querySelectorAll("button")].filter(button=>
      /import|wearable|conectar app/i.test(button.textContent || "")
    ).length,
    textareas:document.querySelectorAll("textarea").length,
    overflow:document.documentElement.scrollWidth>window.innerWidth+1
  }));

  if(!initial.hasRecovery || !initial.hasNutrition) throw new Error(`[${name}] módulos no renderizados`);
  if(!initial.hasPrivacyCopy) throw new Error(`[${name}] falta copy de minimización`);
  if(initial.externalButtons!==0) throw new Error(`[${name}] importación externa visible`);
  if(initial.textareas!==0) throw new Error(`[${name}] hay texto libre en el formulario`);
  if(initial.overflow) throw new Error(`[${name}] overflow inicial`);

  await page.locator("#p360w-new").click();
  await page.waitForSelector("#p360w-form");
  await page.fill("#p360w-entry-date","2026-05-15");
  await page.selectOption('[data-metric-code="FATIGUE"]',"4");
  await page.selectOption('[data-metric-code="READINESS"]',"2");

  const buttons=await page.locator("#p360w-form button").allTextContents();
  if(!buttons.some(text=>text.trim()==="Cancelar") || !buttons.some(text=>text.trim()==="Guardar")) {
    throw new Error(`[${name}] faltan Cancelar/Guardar`);
  }

  await page.locator("#p360w-cancel").click();
  await page.waitForFunction(()=>!document.querySelector("#p360w-form"));

  let state=await page.evaluate(()=>({
    saves:window.__wellnessCalls.save.length,
    recoveryEntries:window.__wellnessStore.recovery.length
  }));
  if(state.saves!==0 || state.recoveryEntries!==0) {
    throw new Error(`[${name}] Cancelar ha persistido datos: ${JSON.stringify(state)}`);
  }

  await page.locator("#p360w-new").click();
  await page.waitForSelector("#p360w-form");
  await page.fill("#p360w-entry-date","2026-05-15");
  await page.selectOption('[data-metric-code="FATIGUE"]',"4");
  await page.selectOption('[data-metric-code="READINESS"]',"2");
  await page.locator('#p360w-form button[type="submit"]').click();

  await page.waitForFunction(()=>window.__wellnessCalls.save.length===1);
  await page.waitForFunction(()=>document.querySelectorAll(".p360w-history-card").length===1);
  await page.waitForFunction(()=>document.querySelectorAll(".p360w-recommendation").length===2);

  const saved=await page.evaluate(()=>({
    call:window.__wellnessCalls.save[0],
    entries:window.__wellnessStore.recovery.length,
    recommendationText:[...document.querySelectorAll(".p360w-recommendation")]
      .map(node=>node.textContent || "").join(" | "),
    externalImport:window.__wellnessCalls.externalImport,
    ai:window.__wellnessCalls.ai,
    textareaCount:document.querySelectorAll("textarea").length,
    overflow:document.documentElement.scrollWidth>window.innerWidth+1,
    panelWidth:document.querySelector(".p360w-panel")?.getBoundingClientRect().width || 0,
    viewportWidth:window.innerWidth
  }));

  if(saved.call.entryDate!=="2026-05-15") throw new Error(`[${name}] fecha incorrecta`);
  if(saved.call.module!=="recovery") throw new Error(`[${name}] módulo incorrecto`);
  if(saved.call.purpose!=="PLAYER_SELF_SERVICE") throw new Error(`[${name}] propósito incorrecto`);
  if(saved.call.values.length!==2) throw new Error(`[${name}] valores incorrectos`);
  if(saved.entries!==1) throw new Error(`[${name}] historial no actualizado`);
  if(!saved.recommendationText.includes("Revisa la carga del día")) {
    throw new Error(`[${name}] falta recomendación de fatiga`);
  }
  if(!saved.recommendationText.includes("Prioriza calidad sobre cantidad")) {
    throw new Error(`[${name}] falta recomendación de readiness`);
  }
  if(saved.externalImport!==0 || saved.ai!==0) {
    throw new Error(`[${name}] se activó una integración prohibida`);
  }
  if(saved.textareaCount!==0) throw new Error(`[${name}] apareció texto libre`);
  if(saved.overflow || saved.panelWidth>saved.viewportWidth+1) {
    throw new Error(`[${name}] responsive inválido: ${JSON.stringify(saved)}`);
  }

  await page.locator(".p360w-edit").click();
  await page.waitForSelector("#p360w-form");
  const editValues=await page.evaluate(()=>({
    fatigue:document.querySelector('[data-metric-code="FATIGUE"]')?.value,
    readiness:document.querySelector('[data-metric-code="READINESS"]')?.value
  }));
  if(editValues.fatigue!=="4" || editValues.readiness!=="2") {
    throw new Error(`[${name}] edición no precarga valores`);
  }
  await page.locator("#p360w-cancel").click();
  await page.waitForFunction(()=>!document.querySelector("#p360w-form"));
  state=await page.evaluate(()=>({saves:window.__wellnessCalls.save.length}));
  if(state.saves!==1) throw new Error(`[${name}] cancelar edición generó escritura`);

  const relevantConsoleErrors=consoleErrors.filter(message=>
    !/favicon|Failed to load resource.*404/i.test(message)
  );
  if(pageErrors.length) throw new Error(`[${name}] pageerror: ${pageErrors.join(" | ")}`);
  if(relevantConsoleErrors.length) throw new Error(`[${name}] console error: ${relevantConsoleErrors.join(" | ")}`);

  console.log(JSON.stringify({viewport:name,initial,saved,status:"PASS"}));
  await browser.close();
}

for(const spec of [
  {name:"desktop-1440x900",viewport:{width:1440,height:900}},
  {name:"iphone-390x844",viewport:{width:390,height:844}}
]) {
  await runViewport(spec.name,spec.viewport);
}

console.log("PLAYER360_PHASE4E2_UI_OK");
