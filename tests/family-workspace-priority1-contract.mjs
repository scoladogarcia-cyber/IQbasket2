import fs from "node:fs";
import assert from "node:assert/strict";
import { presentFamilyPlayer360 } from "../domain/family/FamilyPlayer360Presenter.js";
import { FAMILY_PLAN_PRESENTATION, FAMILY_PRODUCT_PRINCIPLES } from "../config/family.config.js";

const sql = fs.readFileSync("supabase/ready/20260904_apply_family_workspace_priority1_v1.sql", "utf8");
const service = fs.readFileSync("services/family/FamilyWorkspaceService.js", "utf8");
const view = fs.readFileSync("views/family/FamilyWorkspaceView.js", "utf8");
const permissions = fs.readFileSync("security/permissions.js", "utf8");
const router = fs.readFileSync("index.js", "utf8");
const layout = fs.readFileSync("views/LayoutView.js", "utf8");

assert.equal(FAMILY_PRODUCT_PRINCIPLES.checkoutEnabled, false);
assert.ok(FAMILY_PLAN_PRESENTATION.FAMILY_FREE);
assert.ok(FAMILY_PLAN_PRESENTATION.FAMILY);
assert.ok(FAMILY_PLAN_PRESENTATION.FAMILY_PRO);
assert.doesNotMatch(JSON.stringify(FAMILY_PLAN_PRESENTATION), /€|eur|price|stripe/i);

assert.match(sql, /family_player_link_invitations/i);
assert.match(sql, /extensions\.digest\(v_code,'sha256'\)/i);
assert.match(sql, /FAMILY_LINK_EMAIL_MISMATCH/i);
assert.match(sql, /relationship_type='GUARDIAN'/i);
assert.match(sql, /iq_v8_family_bootstrap_free/i);
assert.match(sql, /iq_v8_family_player_passport/i);
assert.match(sql, /iq_v8_family_player360_snapshot/i);
assert.match(sql, /not e\.is_private and e\.share_with_player/i);
assert.doesNotMatch(sql, /nutrition.*recent_games|recovery.*recent_games|neuro.*recent_games/i);
assert.match(service, /iq_v8_family_list_players/);
assert.match(service, /iq_v8_family_claim_link/);
assert.match(service, /iq_v8_family_player_passport/);
assert.match(service, /iq_v8_family_player360_snapshot/);
assert.match(view, /Qué ha pasado/);
assert.match(view, /Cómo evoluciona/);
assert.match(view, /Qué significa/);
assert.match(view, /Qué hacemos ahora/);
assert.match(permissions, /VIEW_FAMILY_WORKSPACE/);
assert.match(permissions, /INVITE_FAMILY_LINK/);
assert.match(router, /lazyViews\.get\("familyworkspace"\)/);
assert.match(layout, /route: "family"/);

const games = Array.from({ length: 10 }, (_, index) => ({
  points: index < 5 ? 12 : 8,
  rebounds: index < 5 ? 6 : 5,
  assists: index < 5 ? 4 : 3,
  minutes: index < 5 ? 26 : 23,
  fg3_made: index < 5 ? 2 : 1,
  fg3_attempted: 5
}));
const presented = presentFamilyPlayer360({ recent_games: games, shared_evaluations: [], objective: null });
assert.equal(presented.enoughEvidence, true);
assert.ok(presented.evolution.length > 0);
assert.ok(presented.next.length > 0);
assert.doesNotMatch(JSON.stringify(presented), /diagnos|causad|lesi[oó]n/i);

console.log("FAMILY_WORKSPACE_PRIORITY1_CONTRACT_OK");
