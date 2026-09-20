/** Regression contract for legacy game FK and editable season-only eligibility. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RosterEligibilityDateService } from "../services/roster/RosterEligibilityDateService.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const bridge = read("supabase/migrations/20260920110000_repair_team_season_legacy_game_fk.sql");
const eligibility = read("supabase/migrations/20260920111000_adjust_roster_start_safely.sql");
const grantFix = read("supabase/migrations/20260920112000_roster_start_revoke_anon.sql");
const html = read("index.html");
const enhancer = read("features/roster/RosterEligibilityDateEnhancer.js");

assert.match(bridge, /INSERT INTO public\.seasons \(team_id, name, start_date, end_date\)/i);
assert.match(bridge, /legacy_season_id = legacy_id/);
assert.match(bridge, /iq_v3_attach_legacy_season\(result_row\.id\)/);
assert.match(bridge, /iq_v3_is_global_superadmin\(\)/);
assert.doesNotMatch(bridge, /delete from public\.(?:games|player_game_stats|seasons)/i);
assert.match(eligibility, /iq_v3_can_manage_roster\(p_team_season_id\)/);
assert.match(eligibility, /TEAM_SEASON_FROZEN/);
assert.match(eligibility, /ROSTER_DATE_OUTSIDE_SEASON/);
assert.match(eligibility, /ROSTER_DATE_MULTI_STINT_REQUIRES_REVIEW/);
assert.match(eligibility, /ROSTER_START_AFTER_RECORDED_PARTICIPATION/);
assert.match(eligibility, /public\.player_game_stats/);
assert.match(eligibility, /public\.game_events/);
assert.match(eligibility, /starter_ids/);
assert.match(eligibility, /FROM PUBLIC, anon/);
assert.match(grantFix, /FROM PUBLIC, anon/);
assert.match(grantFix, /TO authenticated/);
assert.doesNotMatch(eligibility, /delete from public\./i);
assert.match(html, /features\/roster\/RosterEligibilityDateEnhancer\.js/);
assert.match(enhancer, /Permission\.MANAGE_ROSTER/);
assert.match(enhancer, /type = "date"/);
assert.match(enhancer, /await service\.updateStart/);

const calls = [];
const client = { rpc: async (name, params) => {
  calls.push({ name, params });
  return { data: { id: "membership-id" }, error: null };
}};
const service = new RosterEligibilityDateService(client);
const actual = await service.updateStart({ teamSeasonId: "ts-1", playerId: "player-1", newStart: "2026-09-02" });
assert.equal(actual.id, "membership-id");
assert.deepEqual(calls[0], {
  name: "iq_v3_update_roster_start",
  params: { p_team_season_id: "ts-1", p_player_id: "player-1", p_new_start: "2026-09-02" }
});
await assert.rejects(() => service.updateStart({ teamSeasonId: "ts-1", playerId: "player-1", newStart: "2026-02-30" }), /fecha válida/);
assert.equal(calls.length, 1, "La validación local no debe llamar al servidor.");
const denied = new RosterEligibilityDateService({ rpc: async () => ({ data: null, error: new Error("TEAM_SEASON_MANAGE_DENIED") }) });
await assert.rejects(() => denied.updateStart({ teamSeasonId: "ts-1", playerId: "player-1", newStart: "2026-09-02" }), /TEAM_SEASON_MANAGE_DENIED/);
console.log("Season game FK and roster eligibility regression: OK");
