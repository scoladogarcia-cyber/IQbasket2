import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launch = await readFile(new URL("../services/games/LiveGameLaunchService.js", import.meta.url), "utf8");
const setup = await readFile(new URL("../views/games/LiveGameSetupV39View.js", import.meta.url), "utf8");
const gate = await readFile(new URL("../features/game-live/LiveCaptureStartController.js", import.meta.url), "utf8");
const scorer = await readFile(new URL("../views/LiveScoreHUDViewV39.js", import.meta.url), "utf8");
const viewer = await readFile(new URL("../views/games/ScopedGameBoxScoreLiveV39View.js", import.meta.url), "utf8");
const modes = await readFile(new URL("../views/games/GameCaptureModesView.js", import.meta.url), "utf8");
const registry = await readFile(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");
const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url), "utf8"));

assert.match(launch, /Permission\.CREATE_GAME/);
assert.match(launch, /Permission\.RECORD_LIVE_GAME/);
assert.match(launch, /Permission\.PREPARE_GAME/);
assert.match(launch, /Permission\.START_GAME/);
assert.match(launch, /saveGameAndStats/);
assert.match(launch, /targetState: GamePlayState\.READY/);
assert.match(launch, /targetState: GamePlayState\.LIVE/);
assert.ok(launch.indexOf("saveGameAndStats") < launch.indexOf("targetState: GamePlayState.READY"), "game must persist before lifecycle transitions");

assert.match(setup, /Selecciona exactamente 5/);
assert.match(setup, /Crear e iniciar partido/);
assert.match(setup, /LiveGameLaunchService/);
assert.match(setup, /starterIds: \[\.\.\.this\.selectedStarterIds\]/);

assert.match(gate, /data-live-start-gate/);
assert.match(gate, /btn-hud-finish-gated/);
assert.match(gate, /Preparar e iniciar partido/);
assert.match(gate, /targetState: "READY"/);
assert.match(gate, /targetState: "LIVE"/);

assert.match(scorer, /extends LiveScoreHUDViewV38/);
assert.match(scorer, /position:fixed/);
assert.match(scorer, /data-v39-palette="team"/);
assert.match(scorer, /data-v39-palette="opponent"/);
assert.match(scorer, /bottom:calc\(78px/);

assert.match(viewer, /boxscore/);
assert.match(viewer, /Marcador y acta en directo/);
assert.match(viewer, /data-v39-stream-tab="acta"/);
assert.match(viewer, /data-v39-stream-tab="pbp"/);
assert.match(viewer, /from\("play_by_play_events"\)/);
assert.match(viewer, /\.limit\(500\)/);
assert.doesNotMatch(viewer, /\.insert\(/);
assert.doesNotMatch(viewer, /\.update\(/);
assert.doesNotMatch(viewer, /\.delete\(/);

assert.match(modes, /cloneNode\(true\)/);
assert.match(modes, /Nuevo partido en vivo/);
assert.match(modes, /Marcador \/ Acta/);

// V39 guarantees remain required even if a later scorer presentation wraps them.
assert.match(registry, /attachLiveCaptureStartGate/);
assert.match(registry, /attachLiveWriterLease/);
assert.match(registry, /ScopedGameBoxScoreLiveV39View/);

const current = release.release.split(".").map(Number);
const baseline = "2026.09.08.22".split(".").map(Number);
const compare = (a, b) => {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};
assert.ok(compare(current, baseline) >= 0, "La release no puede retroceder respecto a V39.");

console.log("V39 live capture onboarding + streaming contract OK");
