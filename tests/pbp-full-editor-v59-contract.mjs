import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canonicalGameEventAction,
  compareGameEventsChronological,
  gameEventLabel
} from "../domain/games/GameEventCatalog.js";

const legacyMade2={id:"b",period:1,game_clock:"07:30",action_type:"fg2_attempted",points:2,made:true};
assert.equal(canonicalGameEventAction(legacyMade2),"fg2_made");
assert.equal(gameEventLabel(legacyMade2),"T2 anotado");

const ordered=[
  {id:"4",period:2,game_clock:"09:00",event_sequence:4},
  {id:"2",period:1,game_clock:"07:30",event_sequence:2},
  {id:"1",period:1,game_clock:"08:00",event_sequence:1},
  {id:"3",period:1,game_clock:"05:00",event_sequence:3}
].sort(compareGameEventsChronological);
assert.deepEqual(ordered.map(x=>x.id),["1","2","3","4"]);

const root=new URL("../",import.meta.url);
const [view,service,migration,registry]=await Promise.all([
  readFile(new URL("views/games/ScopedGameBoxScoreLiveV59View.js",root),"utf8"),
  readFile(new URL("services/games/GameCaptureDelegationService.js",root),"utf8"),
  readFile(new URL("supabase/migrations/20261004223000_pbp_order_full_editor_v59.sql",root),"utf8"),
  readFile(new URL("services/LazyViewRegistry.js",root),"utf8")
]);

assert.match(view,/data-v59-edit-event/);
assert.match(view,/data-v59-player/);
assert.match(view,/data-v59-action/);
assert.match(view,/Guardar cambios/);
assert.match(view,/compareGameEventsChronological/);
assert.match(view,/captureService\.editEvent/);
assert.match(service,/iq_v59_game_capture_snapshot/);
assert.match(service,/iq_v59_edit_game_event/);
assert.match(migration,/event_sequence integer/i);
assert.match(migration,/game_event_edit_audit/i);
assert.match(migration,/GAME_EVENT_SCORE_EDIT_REQUIRES_COMPLETE_EVENT_LOG/i);
assert.match(migration,/refresh_score_from_events/i);
assert.match(migration,/recompute_team_game_stats/i);
assert.match(migration,/with ordinality/i);
assert.match(migration,/client_event_key/i);
assert.match(registry,/ScopedGameBoxScoreLiveV59View/);

console.log("V59 ordered PBP + full event editor contract OK");
