import assert from "node:assert/strict";
import fs from "node:fs";
import { buildFamilyWeeklyPlan } from "../domain/family/FamilyDevelopmentPlanEngine.js";
import { FAMILY_AI_PRODUCTS_EXTENDED, FAMILY_AI_POLICY } from "../config/family-ai-products.config.js";
import { PLAYER360_AI_GATEWAY_CONFIG } from "../config/player360-ai-gateway.config.js";

const sql = fs.readFileSync("supabase/ready/20260905_apply_family_development_context_v1.sql", "utf8");
const service = fs.readFileSync("services/family/FamilyWorkspaceService.js", "utf8");
const view = fs.readFileSync("views/family/FamilyWorkspaceView.js", "utf8");

assert.equal(FAMILY_AI_POLICY.commerciallyAvailable, false);
assert.equal(FAMILY_AI_POLICY.providerGenerationEnabled, false);
assert.equal(PLAYER360_AI_GATEWAY_CONFIG.generationEnabled, false);
assert.deepEqual(PLAYER360_AI_GATEWAY_CONFIG.allowedAudiences, ["STAFF"]);
for (const product of Object.values(FAMILY_AI_PRODUCTS_EXTENDED)) {
  assert.equal(product.status, "DISABLED", `${product.code} no debe venderse todavía`);
}

const plan = buildFamilyWeeklyPlan({
  allowed: true,
  objective: { title: "Mejorar toma de decisiones", targets: [
    { metric_name: "Lectura de ventaja", priority_weight: 3 },
    { metric_name: "Finalización", priority_weight: 1 }
  ] },
  recent_training: [{ id: 1 }],
  recent_external_development: [{ id: 2 }],
  recent_games: [{ id: 3 }]
});
assert.equal(plan.allowed, true);
assert.equal(plan.status, "OBJECTIVE_READY");
assert.equal(plan.primaryFocus, "Lectura de ventaja");
assert.equal(plan.evidence.trainingSessions, 1);
assert.equal(plan.evidence.technificationSessions, 1);
assert.equal(plan.evidence.recentGames, 1);
assert.ok(plan.actions.some(item => item.includes("Lectura de ventaja")));
assert.doesNotMatch(JSON.stringify(plan), /rpe|internal_load|nutrition|recovery|neuro/i);

const noObjective = buildFamilyWeeklyPlan({ allowed: true });
assert.equal(noObjective.status, "NEEDS_SHARED_OBJECTIVE");
assert.ok(noObjective.limitations.length >= 1);

assert.match(sql, /iq_v10_family_development_context\(uuid,uuid\)/);
assert.match(sql, /family_can_view_player\(auth\.uid\(\),p_player_id\)/);
assert.match(sql, /'DEVELOPMENT_PLAN'/);
assert.match(sql, /g\.team_season_id=v_team_season_id/);
assert.match(sql, /FAMILY_WEEKLY_PLAN_VIEWED/);
assert.match(sql, /'allowed',false,'reason_code','DEVELOPMENT_NO_SEASON_DATA'/);
assert.doesNotMatch(sql, /'rpe'\s*,\s*(?:tp|ts|ed|pgs|g)\./i);
assert.doesNotMatch(sql, /'notes'\s*,\s*(?:tp|ts|ed|pgs|g)\./i);
assert.doesNotMatch(sql, /provider_name/i);
assert.match(service, /iq_v10_family_development_context/);
assert.match(view, /buildFamilyWeeklyPlan/);
assert.match(view, /data-family-weekly-plan/);
assert.match(view, /Productos inteligentes, todavía no activados/);

console.log("FAMILY_DEVELOPMENT_PRIORITY2_CONTRACT_OK");