import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateLiveMinutes } from "../domain/games/LiveMinutesEngine.js";
import { renderFullGameBoxScoreTables } from "../views/reports/FullGameBoxScoreTables.js";

const players = ["a","b","c","d","e","f","g"];
const projection = calculateLiveMinutes({
  playerIds: players,
  periodNames: ["Q1"],
  getPeriodDuration: () => 600,
  lineupEvents: [
    { id:"start", period:"Q1", timeRemaining:600, onCourt:["a","b","c","d","e"] },
    { id:"sub", period:"Q1", timeRemaining:300, onCourt:["a","b","c","f","g"] },
    { id:"close", period:"Q1", timeRemaining:0, onCourt:["a","b","c","f","g"] }
  ]
});

assert.equal(projection.hasTimeline, true);
assert.deepEqual(Object.fromEntries(projection.minutesByPlayer), {
  a:10,b:10,c:10,d:5,e:5,f:5,g:5
});
assert.equal(projection.totalRoundedMinutes, 50);

const noTimeline = calculateLiveMinutes({
  playerIds:["a","b"],
  periodNames:["Q1"],
  getPeriodDuration:()=>600,
  lineupEvents:[]
});
assert.equal(noTimeline.hasTimeline, false);
assert.equal(noTimeline.minutesByPlayer.get("a"), 0);

const report = renderFullGameBoxScoreTables({
  game:{ opponent:"Test" },
  players:[{id:"p1",jersey:4,first_name:"Pau",last_name:"Test"}],
  stats:[{
    player_id:"p1",starter:true,minutes:0,points:2,
    fg2_made:1,fg2_attempted:1,fg3_made:0,fg3_attempted:0,
    ft_made:0,ft_attempted:0,off_reb:0,def_reb:0,assists:0,
    steals:0,blocks:0,turnovers:0,fouls_committed:0,fouls_drawn:0
  }]
});
assert.match(report,/Minutaje N\/D/);
assert.match(report,/>N\/D<\/td>/);

const service = await readFile(new URL("../services/games/GameCaptureDelegationService.js", import.meta.url), "utf8");
const baseView = await readFile(new URL("../views/LiveScoreHUDView.js", import.meta.url), "utf8");
const fastView = await readFile(new URL("../views/LiveScoreHUDViewV38.js", import.meta.url), "utf8");
const offlineView = await readFile(new URL("../views/LiveScoreHUDViewV58.js", import.meta.url), "utf8");
const sync = await readFile(new URL("../services/games/LiveCaptureSyncService.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261013130000_v62_live_lineup_minutes.sql", import.meta.url), "utf8");

assert.match(service,/iq_v62_game_capture_snapshot/);
assert.match(service,/iq_v62_save_game_capture/);
assert.match(fastView,/_formatLineupsForSave/);
assert.match(fastView,/lineups:\s*this\._formatLineupsForSave\(\)/);
assert.match(baseView,/snapshot\.lineups/);
assert.match(baseView,/calculateLiveMinutes/);
assert.match(offlineView,/payload\.lineups/);
assert.match(sync,/remoteSnapshot\?\.lineups/);

assert.match(migration,/create table if not exists public\.game_lineup_events/i);
assert.match(migration,/cardinality\(on_court_player_ids\) = 5/i);
assert.match(migration,/revoke all on table public\.game_lineup_events from anon, authenticated/i);
assert.match(migration,/create or replace function public\.iq_v62_save_game_capture/i);
assert.match(migration,/create or replace function public\.iq_v62_game_capture_snapshot/i);

console.log("V62 live minutes: lineup persistence, recovery and missing-minute semantics OK");
