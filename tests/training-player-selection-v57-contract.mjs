import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TrainingPlayerDirectoryService } from "../services/player360/TrainingPlayerDirectoryService.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const view = read("../views/TrainingView.js");
const completeView = read("../views/training/TrainingCompleteEditV54View.js");
const sql = read("../supabase/migrations/20261004190000_training_guest_selection_v57.sql");

assert.ok(
  view.indexOf('id="p360-training-player-options"') < view.indexOf('id="p360-training-advanced"'),
  "Quick-create player selector must be visible before advanced details."
);
assert.match(completeView,/v57-edit-player-search/);
assert.match(completeView,/v57-add-edit-player/);
assert.match(completeView,/máximo 15/);
assert.match(completeView,/Jugadores registrados en esta sesión/);
assert.match(completeView,/añadirlos al entrenamiento no los incorpora a la plantilla/);
assert.match(completeView,/data-directory-authorized/);

assert.match(sql,/participant_origin text not null default 'ROSTER'/);
assert.match(sql,/training_participants_origin_check/);
assert.match(sql,/iq_v57_can_select_training_player/);
assert.match(sql,/iq_v57_resolve_training_players/);
assert.match(sql,/PLAYER_NOT_AUTHORIZED_FOR_TRAINING/);
assert.match(sql,/new\.participant_origin:=case when v_roster_eligible then 'ROSTER' else 'GUEST' end/);
assert.match(sql,/participant_origin=excluded\.participant_origin/);
assert.match(sql,/not public\.iq_v57_can_select_training_player\(v_player_id,p_team_season_id\)/);
assert.doesNotMatch(sql,/insert\s+into\s+public\.roster_memberships/i);
assert.doesNotMatch(sql,/update\s+public\.roster_memberships/i);

let resolveArgs=null;
const service=new TrainingPlayerDirectoryService({
  rpc:async(name,args)=>{
    assert.equal(name,"iq_v57_resolve_training_players");
    resolveArgs=args;
    return {data:[{player_id:"p1",first_name:"Guest"}],error:null};
  }
});
const resolved=await service.resolve({teamSeasonId:"ts1",playerIds:["p1","p1","p2"]});
assert.deepEqual(resolveArgs,{p_team_season_id:"ts1",p_player_ids:["p1","p2"]});
assert.equal(resolved.length,1);

console.log("PASS Training V57: visible create selector, paginated edit search and guest-only participation.");
