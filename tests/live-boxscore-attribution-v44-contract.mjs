import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildPlayerStatBaselines,
  projectLivePlayerStats,
  projectPbpCounters
} from "../domain/games/LiveCaptureStatsProjector.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

const playerA = "11111111-1111-4111-8111-111111111111";
const playerB = "22222222-2222-4222-8222-222222222222";
const roster = [
  { id: playerA, isConvoked: true, isStarter: true },
  { id: playerB, isConvoked: true, isStarter: false }
];

const loadedEvents = [
  { player_id: playerA, action_type: "fg2_made", points: 2, isOpponent: false }
];
const existingStats = [
  {
    player_id: playerA,
    minutes: 17,
    points: 5,
    fg2_made: 1,
    fg2_attempted: 2,
    assists: 2,
    plus_minus: 3
  }
];

const baselines = buildPlayerStatBaselines(existingStats, loadedEvents);
assert.equal(baselines.get(playerA).points, 3, "Debe conservar puntos históricos no explicados por PBP.");
assert.equal(baselines.get(playerA).fg2_made, 0);
assert.equal(baselines.get(playerA).fg2_attempted, 1, "Debe conservar intentos históricos sin evento granular.");
assert.equal(baselines.get(playerA).assists, 2);
assert.equal(baselines.get(playerA).minutes, 17);

const currentEvents = [
  ...loadedEvents,
  { player_id: playerA, action_type: "assists", points: 0, isOpponent: false },
  { player_id: playerB, action_type: "def_reb", points: 0, isOpponent: false },
  { player_id: playerB, action_type: "steals", points: 0, isOpponent: false },
  { player_id: playerB, action_type: "turnovers", points: 0, isOpponent: false },
  { player_id: playerA, action_type: "ft_made", points: 1, isOpponent: false, onCourt: [playerA, playerB] },
  { action_type: "opp_pts", points: 2, isOpponent: true, onCourt: [playerA, playerB] }
];

const projected = projectLivePlayerStats({ roster, events: currentEvents, baselines });
const a = projected.find(row => row.player_id === playerA);
const b = projected.find(row => row.player_id === playerB);
assert.ok(a && b);
assert.equal(a.points, 6, "Stored baseline + loaded PBP + new FT must reach BoxScore.");
assert.equal(a.fg2_made, 1);
assert.equal(a.fg2_attempted, 2);
assert.equal(a.ft_made, 1);
assert.equal(a.ft_attempted, 1);
assert.equal(a.assists, 3);
assert.equal(a.minutes, 17, "Live sync must not erase pre-existing minutes.");
assert.equal(a.plus_minus, 2, "Current on-court +1/-2 is added to stored plus/minus baseline.");
assert.equal(b.def_reb, 1);
assert.equal(b.steals, 1);
assert.equal(b.turnovers, 1);
assert.equal(b.plus_minus, -1);

const afterUndo = projectLivePlayerStats({
  roster,
  events: currentEvents.filter(event => event.action_type !== "assists"),
  baselines
});
assert.equal(afterUndo.find(row => row.player_id === playerA).assists, 2, "Undo must also remove the persisted live stat.");

const counters = projectPbpCounters([
  { player_id: playerB, action_type: "fg3_made", points: 3 },
  { player_id: playerB, action_type: "fg3_attempted", points: 0 },
  { player_id: playerB, action_type: "off_reb" },
  { player_id: playerB, action_type: "fouls_committed" }
]);
assert.equal(counters.get(playerB).points, 3);
assert.equal(counters.get(playerB).fg3_made, 1);
assert.equal(counters.get(playerB).fg3_attempted, 2);
assert.equal(counters.get(playerB).off_reb, 1);
assert.equal(counters.get(playerB).fouls_committed, 1);

const [viewSource, registrySource, v38Source, releaseText] = await Promise.all([
  read("views/LiveScoreHUDViewV44.js"),
  read("services/LazyViewRegistry.js"),
  read("views/LiveScoreHUDViewV38.js"),
  read("release.json")
]);

// Regression proof: V38 used stats:null; V44 must replace it at the adapter boundary.
assert.match(v38Source, /stats:\s*null/);
assert.match(viewSource, /stats:\s*projectLivePlayerStats/);
assert.match(viewSource, /active_player_action/);
assert.match(viewSource, /data-v44-player-action-id/);
assert.match(viewSource, /onCourtPlayerIds/);
assert.match(viewSource, /players\.length === 5/);
assert.match(viewSource, /position:fixed/);
assert.match(viewSource, /_applyProjectedStatsToActaMap/);
assert.match(viewSource, /super\._bindActaEvents/);
assert.match(registrySource, /LiveScoreHUDViewV44/);
assert.match(registrySource, /attachLiveWriterLeaseV43/);
assert.match(registrySource, /attachLiveCaptureStartGate/);

const release = JSON.parse(releaseText);
const baselineRelease = "2026.09.08.27";
const parts = value => String(value || "").split(".").map(part => Number(part) || 0);
const compare = (left, right) => {
  const aParts = parts(left);
  const bParts = parts(right);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i += 1) {
    if ((aParts[i] || 0) > (bParts[i] || 0)) return 1;
    if ((aParts[i] || 0) < (bParts[i] || 0)) return -1;
  }
  return 0;
};
assert.ok(compare(release.release, baselineRelease) >= 0, "La release V44 no puede retroceder.");
if (release.release === baselineRelease) {
  assert.equal(release.label, "live-boxscore-attribution-v44");
}

console.log("V44 live BoxScore attribution contract OK");
