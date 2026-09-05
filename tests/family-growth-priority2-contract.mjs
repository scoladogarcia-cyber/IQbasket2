import fs from "node:fs";
import assert from "node:assert/strict";
import { buildFamilyGrowthState } from "../domain/family/FamilyGrowthEngine.js";
import { FamilyGrowthStage, FAMILY_GROWTH_CONFIG, FAMILY_PRICE_HYPOTHESES } from "../config/family-growth.config.js";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const sql = fs.readFileSync("supabase/ready/20260905_apply_family_product_analytics_v1.sql", "utf8");
const service = fs.readFileSync("services/analytics/ProductAnalyticsService.js", "utf8");
const view = fs.readFileSync("views/family/FamilyWorkspaceView.js", "utf8");

const passport = games => ({
  career_totals: { games },
  career: [{ training_sessions: 3, technification_sessions: 2 }],
  recent_games: games ? [{ opponent: "Demo", points: 8, minutes: 20 }] : []
});

const start = buildFamilyGrowthState({ product: { plan_code: "FAMILY_FREE" }, passport: passport(0), player360: { allowed: false } });
assert.equal(start.stage, FamilyGrowthStage.START);
assert.equal(start.conversion.visible, false);

const building = buildFamilyGrowthState({ product: { plan_code: "FAMILY_FREE" }, passport: passport(4), player360: { allowed: false } });
assert.equal(building.stage, FamilyGrowthStage.BUILDING_HISTORY);
assert.equal(building.conversion.visible, false);

const ready = buildFamilyGrowthState({ product: { plan_code: "FAMILY_FREE" }, passport: passport(6), player360: { allowed: false } });
assert.equal(ready.stage, FamilyGrowthStage.INSIGHT_READY);
assert.equal(ready.conversion.visible, true);
assert.equal(ready.conversion.targetPlanCode, "FAMILY");

const family = buildFamilyGrowthState({
  product: { plan_code: "FAMILY" }, passport: passport(8),
  player360: { allowed: true, access: { development_plan: true } }
});
assert.equal(family.conversion.visible, false, "Family Pro must stay hidden while AI products are unavailable");
assert.equal(FAMILY_GROWTH_CONFIG.checkoutEnabled, false);
assert.equal(FAMILY_GROWTH_CONFIG.priceDisplayEnabled, false);
assert.ok(FAMILY_PRICE_HYPOTHESES.A.FAMILY.monthlyCents > 0);

assert.match(sql, /create table public\.product_analytics_events/i);
assert.match(sql, /revoke all on table public\.product_analytics_events from public,anon,authenticated/i);
assert.match(sql, /PRODUCT_EVENT_PLAYER_ACCESS_DENIED/i);
assert.match(sql, /iq_v3_is_global_superadmin/i);
assert.match(sql, /FAMILY_PLAN_INTEREST_CLICKED/);
assert.doesNotMatch(sql, /points|rebounds|assists|wellness|nutrition|recovery/i,
  "Product telemetry schema must not persist sporting or sensitive metrics");

assert.match(service, /iq_v9_track_product_event/);
assert.doesNotMatch(service, /metadata/);
assert.match(view, /Lo importante, de un vistazo/);
assert.match(view, /data-family-interest/);
assert.match(view, /FAMILY_INSIGHT_OFFER_VIEWED/);
assert.match(view, /Sin cargos ni contratación en este paso/);
assert.ok(ROLE_PERMISSIONS[UserRole.SUPERADMIN].includes(Permission.VIEW_BUSINESS_METRICS));
assert.ok(!ROLE_PERMISSIONS[UserRole.ADMIN].includes(Permission.VIEW_BUSINESS_METRICS));

console.log("FAMILY_GROWTH_PRIORITY2_CONTRACT_OK");
