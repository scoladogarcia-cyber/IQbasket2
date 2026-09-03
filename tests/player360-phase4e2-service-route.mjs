import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { WellnessService } from "../services/player360/WellnessService.js";

const calls=[];
const client={
  async rpc(name,args={}) {
    calls.push({name,args:structuredClone(args)});
    if(name==="iq_v4e2_wellness_capabilities") {
      const purpose=args.p_purpose;
      return {
        data:{
          ready:true,
          manual_input_enabled:true,
          external_import_enabled:false,
          recommendations_enabled:true,
          ai_processing_enabled:false,
          can_read:purpose==="PLAYER_SELF_SERVICE",
          can_create:purpose==="PLAYER_SELF_SERVICE",
          can_update:purpose==="PLAYER_SELF_SERVICE",
          can_archive:purpose==="PLAYER_SELF_SERVICE"
        },
        error:null
      };
    }
    if(name==="iq_v4e2_list_wellness_metric_catalog") {
      return {
        data:[
          {id:"m1",module:args.p_module,code:"FATIGUE",value_type:"SCALE",min_value:1,max_value:5,step:1},
          {id:"m2",module:args.p_module,code:"READINESS",value_type:"SCALE",min_value:1,max_value:5,step:1}
        ],
        error:null
      };
    }
    if(name==="iq_v4e2_list_wellness_entries") {
      return {
        data:[{
          id:"entry-1",
          entry_date:"2026-09-03",
          observations:[{metric_code:"FATIGUE",value_type:"SCALE",value:4}]
        }],
        error:null
      };
    }
    if(name==="iq_v4e2_save_manual_wellness_entry") {
      return {data:"entry-2",error:null};
    }
    if(name==="iq_v4e2_archive_wellness_entry") {
      return {data:true,error:null};
    }
    return {data:null,error:{message:`Unexpected RPC ${name}`}};
  }
};

const service=new WellnessService(client);
const access=await service.resolveAccessContext({
  teamSeasonId:"team-season-1",
  playerId:"player-1",
  module:"recovery"
});
assert.equal(access.purpose,"PLAYER_SELF_SERVICE");
assert.equal(access.can_read,true);
assert.equal(access.external_import_enabled,false);
assert.equal(access.ai_processing_enabled,false);

const capabilityCalls=calls.filter(call=>call.name==="iq_v4e2_wellness_capabilities");
assert.equal(capabilityCalls.length,4);
assert.deepEqual(
  capabilityCalls.map(call=>call.args.p_purpose),
  ["PLAYER_SELF_SERVICE","FAMILY_SUPPORT","SPORT_PERFORMANCE","OPERATIONS"]
);

const metrics=await service.listMetrics({
  teamSeasonId:"team-season-1",
  module:"recovery"
});
assert.equal(metrics.length,2);

const entries=await service.listEntries({
  teamSeasonId:"team-season-1",
  playerId:"player-1",
  module:"recovery",
  purpose:access.purpose,
  fromDate:"2026-09-01",
  toDate:"2026-09-30"
});
assert.equal(entries.length,1);
assert.equal(entries[0].observations.length,1);

const saved=await service.saveManualEntry({
  teamSeasonId:"team-season-1",
  playerId:"player-1",
  module:"recovery",
  entryDate:"2026-09-03",
  purpose:access.purpose,
  values:[
    {metric_code:"fatigue",value:4,ignored:"must not cross service boundary"},
    {metric_code:"readiness",value:2}
  ]
});
assert.equal(saved,"entry-2");

const saveCall=calls.find(call=>call.name==="iq_v4e2_save_manual_wellness_entry");
assert.deepEqual(saveCall.args.p_values,[
  {metric_code:"FATIGUE",value:4},
  {metric_code:"READINESS",value:2}
]);
assert.equal("source_type" in saveCall.args,false);
assert.equal("notes" in saveCall.args,false);
assert.equal("external_provider" in saveCall.args,false);

assert.equal(
  await service.archiveEntry({entryId:"entry-2",purpose:access.purpose}),
  true
);

assert.equal(
  calls.some(call=>String(call.name).toLowerCase().includes("import")),
  false,
  "4E.2 no debe invocar ningún RPC de importación externa."
);

const playerViewSource=readFileSync(
  new URL("../views/Player360View.js",import.meta.url),
  "utf8"
);
assert.match(playerViewSource,/WellnessSupportPanel/);
assert.match(playerViewSource,/tabs\.push\(\{ id: "wellness", label: "🥤 Nutrición \+ recuperación" \}\)/);
assert.match(playerViewSource,/this\.activeTab === "wellness"/);
assert.match(playerViewSource,/this\.wellnessPanel\.bind/);

const wellnessPanelSource=readFileSync(
  new URL("../views/player360/WellnessSupportPanel.js",import.meta.url),
  "utf8"
);
assert.match(wellnessPanelSource,/this\.activeModule = "recovery"/);
assert.match(wellnessPanelSource,/_visibleModules\(\)/);
assert.match(wellnessPanelSource,/this\.allowedModules/);

const nutritionViewSource=readFileSync(
  new URL("../views/NutritionView.js",import.meta.url),
  "utf8"
);
assert.match(nutritionViewSource,/modules: \["nutrition"\]/);
assert.match(nutritionViewSource,/this\.panel\.activeModule = "nutrition"/);
assert.match(nutritionViewSource,/Permission\.VIEW_NUTRITION/);
assert.match(nutritionViewSource,/WellnessSupportPanel/);
assert.match(nutritionViewSource,/#\/nutrition\//);

for (const routerFile of ["../index.js","../app.js"]) {
  const routerSource=readFileSync(new URL(routerFile,import.meta.url),"utf8");
  assert.match(routerSource,/NutritionView/);
  assert.match(routerSource,/case "nutrition"/);
}

const layoutSource=readFileSync(
  new URL("../views/LayoutView.js",import.meta.url),
  "utf8"
);
assert.match(layoutSource,/key: "nutrition"/);
assert.match(layoutSource,/Permission\.VIEW_NUTRITION/);

console.log("PLAYER360_PHASE4E2_SERVICE_ROUTE_OK");
