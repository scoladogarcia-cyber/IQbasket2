import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const BASE_URL=process.env.PLAYER360_BASE_URL || "http://127.0.0.1:4173";

const metrics=[
  {
    id:"m-energy",module:"recovery",code:"DAILY_ENERGY",name:"Energía percibida",
    description:"Nivel subjetivo de energía.",value_type:"SCALE",unit:"SCALE_1_5",
    min_value:1,max_value:5,step:1,options:[],sort_order:10
  },
  {
    id:"m-fatigue",module:"recovery",code:"FATIGUE",name:"Fatiga percibida",
    description:"Sensación general de fatiga.",value_type:"SCALE",unit:"SCALE_1_5",
    min_value:1,max_value:5,step:1,options:[],sort_order:20
  }
];

const rawEntries=[
  ["2026-08-23",2,4],
  ["2026-08-26",2,4],
  ["2026-08-30",4,2],
  ["2026-09-01",4,2],
  ["2026-09-04",5,1]
].map(([entry_date,energy,fatigue],index)=>({
  id:`entry-${index+1}`,
  player_id:"player-1",
  team_season_id:"team-season-1",
  module:"recovery",
  entry_date,
  source_type:"PLAYER_SELF_REPORT",
  captured_by:"user-1",
  created_at:`${entry_date}T10:00:00.000Z`,
  updated_at:`${entry_date}T10:00:00.000Z`,
  observations:[
    {metric_code:"DAILY_ENERGY",value_type:"SCALE",value:energy,unit:"SCALE_1_5",quality:1},
    {metric_code:"FATIGUE",value_type:"SCALE",value:fatigue,unit:"SCALE_1_5",quality:1}
  ]
}));

async function runViewport(name,viewport){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  await installBrowserNetworkStubs(page);
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));

  await page.goto(BASE_URL,{waitUntil:"domcontentloaded"});
  await page.evaluate(async ({metrics,rawEntries})=>{
    const { WellnessSupportPanel }=await import("/views/player360/WellnessSupportPanel.js");
    const service={
      supabase:{},
      async resolveAccessContext({module}){
        return {
          ready:true,module,purpose:"SPORT_PERFORMANCE",
          can_read:true,can_create:false,can_update:false,can_archive:false,
          manual_input_enabled:true,external_import_enabled:false,
          recommendations_enabled:true,ai_processing_enabled:false
        };
      },
      async listMetrics({module}){
        return module==="recovery" ? structuredClone(metrics) : [];
      },
      async listEntries({module}){
        return module==="recovery" ? structuredClone(rawEntries) : [];
      }
    };
    const panel=new WellnessSupportPanel({service,can:()=>true,modules:["recovery"]});
    await panel.load({
      teamSeasonId:"team-season-1",
      playerId:"player-1",
      dateBounds:{min:"2026-08-01",max:"2026-09-30"}
    });
    const root=document.createElement("main");
    root.id="wellness-v2-test-root";
    document.body.innerHTML="";
    document.body.appendChild(root);
    root.innerHTML=panel.render();
    await panel.bind(root,{onChanged:async()=>{root.innerHTML=panel.render();}});
  },{metrics,rawEntries});

  await page.waitForSelector(".p360w-trend-section");
  const state=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll(".p360w-trend")];
    const energy=cards.find(card=>(card.textContent||"").includes("Energía percibida"));
    const history=document.querySelector(".p360w-history")?.textContent || "";
    return {
      cardCount:cards.length,
      energyText:energy?.textContent || "",
      history,
      disclaimer:document.querySelector(".p360w-trend-disclaimer")?.textContent || "",
      overflow:document.documentElement.scrollWidth>window.innerWidth+1,
      rootWidth:document.querySelector("#wellness-v2-test-root")?.getBoundingClientRect().width || 0,
      viewportWidth:window.innerWidth
    };
  });

  if(state.cardCount!==2) throw new Error(`[${name}] trend cards=${state.cardCount}`);
  if(!state.energyText.includes("↑ Sube")) throw new Error(`[${name}] energy direction missing`);
  if(!state.energyText.includes("4,33") && !state.energyText.includes("4.33")) {
    throw new Error(`[${name}] 7-day energy average missing: ${state.energyText}`);
  }
  if(!state.energyText.includes("3,4") && !state.energyText.includes("3.4")) {
    throw new Error(`[${name}] 28-day energy average missing: ${state.energyText}`);
  }
  if(!state.history.includes("Energía percibida")) throw new Error(`[${name}] catalog name missing in history`);
  if(state.history.includes("DAILY_ENERGY")) throw new Error(`[${name}] raw metric code leaked into history`);
  if(!/No es un diagnóstico/i.test(state.disclaimer)) throw new Error(`[${name}] non-clinical disclaimer missing`);
  if(state.overflow || state.rootWidth>state.viewportWidth+1) {
    throw new Error(`[${name}] responsive overflow: ${JSON.stringify(state)}`);
  }
  if(errors.length) throw new Error(`[${name}] pageerror: ${errors.join(" | ")}`);

  console.log(JSON.stringify({viewport:name,status:"PASS",state}));
  await browser.close();
}

for(const spec of [
  {name:"desktop-1440x900",viewport:{width:1440,height:900}},
  {name:"iphone-390x844",viewport:{width:390,height:844}}
]){
  await runViewport(spec.name,spec.viewport);
}

console.log("PLAYER360_PHASE4E3_UI_OK");
