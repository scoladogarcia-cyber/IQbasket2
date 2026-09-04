import assert from "node:assert/strict";

import {
  PLAYER360_WELLNESS_CONFIG,
  PLAYER360_WELLNESS_DEFAULT_METRICS,
  PLAYER360_WELLNESS_PROHIBITED_DEFAULT_CODES
} from "../config/player360-wellness.config.js";
import { WellnessRecommendationEngine } from "../domain/player360/WellnessRecommendationEngine.js";
import {
  WellnessTrendEngine,
  WELLNESS_TREND_DIRECTION
} from "../domain/player360/WellnessTrendEngine.js";

assert.equal(PLAYER360_WELLNESS_CONFIG.contractVersion,"PLAYER360_WELLNESS_V2");
assert.deepEqual(PLAYER360_WELLNESS_CONFIG.trendWindowsDays,[7,28]);
assert.equal(PLAYER360_WELLNESS_CONFIG.externalImportEnabled,false);
assert.equal(PLAYER360_WELLNESS_CONFIG.aiProcessingEnabled,false);
assert.equal(PLAYER360_WELLNESS_CONFIG.allowFreeTextValue,false);

const energyMetric=PLAYER360_WELLNESS_DEFAULT_METRICS.find(metric => metric.code === "DAILY_ENERGY");
assert.ok(energyMetric,"DAILY_ENERGY must be part of the V2 catalog");
assert.equal(energyMetric.module,"recovery");
assert.equal(energyMetric.value_type,"SCALE");
assert.equal(energyMetric.min_value,1);
assert.equal(energyMetric.max_value,5);

const configuredCodes=new Set(PLAYER360_WELLNESS_DEFAULT_METRICS.map(metric => metric.code));
for(const prohibitedCode of PLAYER360_WELLNESS_PROHIBITED_DEFAULT_CODES){
  assert.equal(configuredCodes.has(prohibitedCode),false,`prohibited metric leaked into defaults: ${prohibitedCode}`);
}

const metrics=[
  energyMetric,
  PLAYER360_WELLNESS_DEFAULT_METRICS.find(metric => metric.code === "PRE_TRAINING_FUELING")
];

const entries=[
  {
    entry_date:"2026-08-23",
    observations:[
      { metric_code:"DAILY_ENERGY",value_type:"SCALE",value:2,unit:"SCALE_1_5" },
      { metric_code:"PRE_TRAINING_FUELING",value_type:"BOOLEAN",value:false,unit:"BOOLEAN" }
    ]
  },
  {
    entry_date:"2026-08-26",
    observations:[
      { metric_code:"DAILY_ENERGY",value_type:"SCALE",value:2,unit:"SCALE_1_5" },
      { metric_code:"PRE_TRAINING_FUELING",value_type:"BOOLEAN",value:false,unit:"BOOLEAN" }
    ]
  },
  {
    entry_date:"2026-08-30",
    observations:[
      { metric_code:"DAILY_ENERGY",value_type:"SCALE",value:4,unit:"SCALE_1_5" },
      { metric_code:"PRE_TRAINING_FUELING",value_type:"BOOLEAN",value:true,unit:"BOOLEAN" }
    ]
  },
  {
    entry_date:"2026-09-01",
    observations:[
      { metric_code:"DAILY_ENERGY",value_type:"SCALE",value:4,unit:"SCALE_1_5" },
      { metric_code:"PRE_TRAINING_FUELING",value_type:"BOOLEAN",value:true,unit:"BOOLEAN" }
    ]
  },
  {
    entry_date:"2026-09-04",
    observations:[
      { metric_code:"DAILY_ENERGY",value_type:"SCALE",value:5,unit:"SCALE_1_5" },
      { metric_code:"PRE_TRAINING_FUELING",value_type:"BOOLEAN",value:false,unit:"BOOLEAN" }
    ]
  }
];

const analysis=WellnessTrendEngine.analyze({ entries,metrics });
assert.equal(analysis.anchorDate,"2026-09-04");
assert.equal(analysis.shortWindowDays,7);
assert.equal(analysis.longWindowDays,28);
assert.equal(analysis.clinical_claim,false);
assert.equal(analysis.causal_claim,false);
assert.equal(analysis.source,"DETERMINISTIC_TREND");

const energy=analysis.metrics.find(metric => metric.metric_code === "DAILY_ENERGY");
assert.ok(energy);
assert.equal(energy.latest_value,5);
assert.equal(energy.short_samples,3);
assert.equal(energy.previous_short_samples,2);
assert.equal(energy.long_samples,5);
assert.equal(energy.short_value,4.33);
assert.equal(energy.previous_short_value,2);
assert.equal(energy.long_value,3.4);
assert.equal(energy.direction,WELLNESS_TREND_DIRECTION.UP);
assert.equal(energy.clinical_claim,false);
assert.equal(energy.causal_claim,false);

const fueling=analysis.metrics.find(metric => metric.metric_code === "PRE_TRAINING_FUELING");
assert.ok(fueling);
assert.equal(fueling.short_value,0.67);
assert.equal(fueling.previous_short_value,0);
assert.equal(fueling.long_value,0.4);
assert.equal(fueling.direction,WELLNESS_TREND_DIRECTION.UP);

const empty=WellnessTrendEngine.analyze({ entries:[],metrics });
assert.equal(empty.anchorDate,null);
assert.deepEqual(empty.metrics,[]);

const energyRecommendations=WellnessRecommendationEngine.evaluate({
  observations:[{
    module:"recovery",
    metric_code:"DAILY_ENERGY",
    value:2,
    occurred_at:"2026-09-04"
  }]
});
assert.equal(energyRecommendations.length,1);
assert.equal(energyRecommendations[0].code,"SUPPORT_DAILY_ENERGY");
assert.equal(energyRecommendations[0].clinical_claim,false);
assert.equal(energyRecommendations[0].causal_claim,false);

console.log("✅ Phase 4E.3 Wellness V2 trend tests passed");
