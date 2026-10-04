import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TRAINING_PLAYER_PAGE_SIZE,
  TrainingPlayerDirectoryService
} from "../services/player360/TrainingPlayerDirectoryService.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const view = read("../views/TrainingView.js");
const sql = read("../supabase/migrations/20261004183000_training_player_directory_v56.sql");

assert.equal(TRAINING_PLAYER_PAGE_SIZE, 15);
assert.match(sql,/iq_v56_search_training_players/);
assert.match(sql,/least\(15/);
assert.match(sql,/iq_v4_can_manage_training/);
assert.match(sql,/is_current_roster/);
assert.match(sql,/v_is_superadmin/);
assert.match(sql,/club_season_memberships/);
assert.match(sql,/revoke all on function public\.iq_v56_search_training_players[\s\S]*from public,anon/);
assert.match(sql,/grant execute on function public\.iq_v56_search_training_players[\s\S]*to authenticated/);

for (const marker of [
  "p360-player-search",
  "p360-player-pagination",
  "máximo 15",
  "Plantilla actual",
  "Seleccionar visibles",
  "trainingPlayerSelection",
  "TrainingPlayerDirectoryService"
]) assert.ok(view.includes(marker), `Missing Training V56 UI marker: ${marker}`);

let rpcArgs = null;
const service = new TrainingPlayerDirectoryService({
  rpc: async (name, args) => {
    assert.equal(name, "iq_v56_search_training_players");
    rpcArgs = args;
    return {
      data: [{
        player_id: "p1",
        first_name: "Ada",
        last_name: "Demo",
        total_count: 31,
        is_current_roster: true
      }],
      error: null
    };
  }
});
const result = await service.search({
  teamSeasonId: "team-season",
  query: "ada",
  page: 2,
  pageSize: 999
});
assert.equal(rpcArgs.p_page_size, 15);
assert.equal(rpcArgs.p_page, 2);
assert.equal(rpcArgs.p_query, "ada");
assert.equal(result.total, 31);
assert.equal(result.pages, 3);

console.log("PASS Training V56: secure paginated player directory capped at 15 rows.");
