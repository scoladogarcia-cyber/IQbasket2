import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scorer = await readFile(new URL("../views/LiveScoreHUDViewV41.js", import.meta.url), "utf8");
const registry = await readFile(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");

// Historical V41 contract: preserve the tested viewport implementation even
// when a later scorer intentionally replaces it at the routing boundary.
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

// The live route must continue to compose lifecycle and single-writer guards;
// the concrete presentation version is intentionally owned by the latest release.
assert.match(registry, /LiveScoreHUDViewV\d+/);
assert.match(registry, /attachLiveWriterLease/);
assert.match(registry, /attachLiveCaptureStartGate/);

console.log("V41 mobile scorer viewport historical contract OK");
