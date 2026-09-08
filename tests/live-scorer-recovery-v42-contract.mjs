import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scorer = await readFile(new URL("../views/LiveScoreHUDViewV42.js", import.meta.url), "utf8");
const scoreSafe = await readFile(new URL("../views/LiveScoreHUDViewV42Safe.js", import.meta.url), "utf8");
const registry = await readFile(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");

assert.match(scorer, /extends LiveScoreHUDViewV38/);
assert.doesNotMatch(scorer, /extends LiveScoreHUDViewV4[01]/);
assert.match(scorer, /TEAM_SHOTS/);
assert.match(scorer, /activeModal = "court_shot"/);
assert.match(scorer, /activeModal = "opponent_court_shot"/);
assert.match(scorer, /coord_x/);
assert.match(scorer, /coord_y/);
assert.match(scorer, /_normalizeRunningScores/);
assert.match(scorer, /_scheduleLiveSync\(\)/);
assert.match(scorer, /btn-del-pbp-event/);
assert.match(scorer, />Anular</);
assert.match(scorer, /position:static!important/);
assert.match(scorer, /overflow:visible!important/);
assert.match(scorer, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
assert.match(scorer, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
assert.match(scorer, /orientation:landscape/);
assert.doesNotMatch(scorer, /data-v39-palette/);
assert.doesNotMatch(scorer, /v40-more-open/);
assert.doesNotMatch(scorer, /height:100dvh/);

assert.match(scoreSafe, /extends LiveScoreHUDViewV42/);
assert.match(scoreSafe, /scoreBaselineTeam/);
assert.match(scoreSafe, /scoreBaselineOpponent/);
assert.match(scoreSafe, /storedTeam - pbpTeam/);
assert.match(scoreSafe, /storedOpponent - pbpOpponent/);
assert.match(scoreSafe, /let team = Number\(this\.scoreBaselineTeam/);
assert.match(scoreSafe, /let opponent = Number\(this\.scoreBaselineOpponent/);

// V42 remains the recovered scorer boundary. Later adapters may wrap/extend it,
// so this historical contract must not pin the active registry to one filename.
assert.match(registry, /LiveScoreHUDViewV\d+(?:Safe)?/);
assert.match(registry, /import\("\.\.\/views\/LiveScoreHUDViewV\d+(?:Safe)?\.js"\)/);
assert.match(registry, /new LiveScoreHUDViewV\d+(?:Safe)?\(authController, gameId\)/);
assert.match(registry, /attachLiveWriterLease/);
assert.match(registry, /attachLiveCaptureStartGate/);

console.log("V42 recovered live scorer contract OK");
