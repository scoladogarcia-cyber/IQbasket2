import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scorer = await readFile(new URL("../views/LiveScoreHUDViewV41.js", import.meta.url), "utf8");
const registry = await readFile(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");
const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url), "utf8"));

assert.match(scorer, /extends LiveScoreHUDViewV40/);
assert.match(scorer, /dataset\.v41Scorer/);
assert.match(scorer, /MutationObserver/);
assert.match(scorer, /data-live-writer-lease-panel/);
assert.match(scorer, /root\.dataset\.liveWriterState/);
assert.match(scorer, /grid-template-areas:/);
assert.match(scorer, /grid-area:lease!important/);
assert.match(scorer, /overflow-y:auto!important/);
assert.match(scorer, /-webkit-overflow-scrolling:touch!important/);
assert.match(scorer, /orientation:landscape/);
assert.match(scorer, /grid-template-columns:minmax\(300px,42%\) minmax\(0,1fr\)!important/);
assert.match(scorer, /max-width:1024px/);
assert.match(scorer, /data-live-writer-handoff-create/);
assert.match(scorer, /data-live-writer-handoff-input/);
assert.match(scorer, /data-live-writer-resume/);
assert.doesNotMatch(scorer, /screen\.orientation\.lock/);

assert.match(registry, /LiveScoreHUDViewV41/);
assert.match(registry, /import\("\.\.\/views\/LiveScoreHUDViewV41\.js"\)/);
assert.match(registry, /new LiveScoreHUDViewV41\(authController, gameId\)/);
assert.match(registry, /attachLiveWriterLease/);
assert.match(registry, /attachLiveCaptureStartGate/);

assert.equal(release.release, "2026.09.08.24");
assert.equal(release.label, "mobile-scorer-viewport-orientation-v41");

console.log("V41 mobile scorer viewport contract OK");
