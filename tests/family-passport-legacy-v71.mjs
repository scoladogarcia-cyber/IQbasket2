import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {presentFamilyPassportBrief} from "../domain/family/FamilyPassportBriefPresenter.js";
import {renderFamilyPassportBrief} from "../views/family/FamilyPassportBriefPanel.js";

const legacy={
  player_id:"test-player",
  category:"Cadete Masculino",
  training_access:true,
  training:{recorded_minutes:750,accredited_minutes:0,pending_minutes:750},
  evaluation_access:true,
  evaluation_quality:{
    attributes_rated:0,
    with_documented_observations:0,
    pending_documentation:0,
    legacy_attributes:5,
    legacy_score_records:60
  }
};
const dashboard={section_access:{basic_stats:true},career_totals:{games:2,minutes:40}};
const model=presentFamilyPassportBrief(legacy,dashboard);
assert.equal(model.evaluation.legacyAttributes,5);
assert.equal(model.evaluation.legacyScoreRecords,60);
const html=renderFamilyPassportBrief(legacy,dashboard);
assert.match(html,/5 habilidades de un sistema de valoración antiguo/);
assert.match(html,/60 registros/);
assert.match(html,/no se comparan directamente/);
assert.match(html,/12 h 30 min/);

const restricted=renderFamilyPassportBrief({
  ...legacy,evaluation_access:false
},dashboard);
assert.doesNotMatch(restricted,/60 registros/);
const migration=readFileSync(new URL(
  "../supabase/migrations/20261025191500_family_passport_legacy_quality_v71.sql",
  import.meta.url
),"utf8");
assert.match(migration,/family_can_view_player/);
assert.match(migration,/share_with_player is true/);
assert.match(migration,/v_legacy_attributes/);
assert.match(migration,/v_legacy_records/);
console.log("PASS family historic evidence V71: distinct skills, records and entitlements");
