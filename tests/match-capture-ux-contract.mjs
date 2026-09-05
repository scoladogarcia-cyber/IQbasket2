import fs from "node:fs";
import assert from "node:assert/strict";

const index = fs.readFileSync("index.html", "utf8");
const enhancer = fs.readFileSync("features/match-capture/MatchCaptureUxEnhancer.js", "utf8");
const css = fs.readFileSync("styles/match-capture-v2.css", "utf8");
const existingView = fs.readFileSync("views/EasyStatsEntryView.js", "utf8");

// Assets must be wired without replacing the existing runtime entry point.
assert.match(index, /<script type="module" src="\.\/index\.js"><\/script>/);
assert.match(index, /styles\/match-capture-v2\.css/);
assert.match(index, /features\/match-capture\/MatchCaptureUxEnhancer\.js/);

// Progressive enhancer is deliberately UI-only. It must never become a second
// persistence/security layer or calculate statistics independently.
for (const forbidden of [
  "DataStore",
  "StatsEngine",
  "BoxScoreCalculator",
  "supabase",
  ".from(",
  ".rpc(",
  "Permission."
]) {
  assert(!enhancer.includes(forbidden), `Enhancer must not own data/security concern: ${forbidden}`);
}

assert.match(enhancer, /\.easy-entry-wrapper/);
assert.match(enhancer, /data-match-capture-status/);
assert.match(enhancer, /data-match-capture-floating-undo/);
assert.match(enhancer, /aria-pressed/);
assert.match(enhancer, /aria-disabled/);
assert.match(enhancer, /sessionStorage\.setItem\(MODE_PREFERENCE_KEY/);
assert.match(enhancer, /navigator\.vibrate/);
assert.match(enhancer, /source\.click\(\)/);
assert.match(enhancer, /button\.disabled = !name/);

// The enhancement relies only on stable DOM hooks already provided by the
// existing capture view; it does not require rewriting game behavior.
for (const hook of [
  "easy-entry-wrapper",
  "player-card-btn",
  "action-btn",
  "mode-selector-btn",
  "btn-undo",
  "action-count"
]) {
  assert(existingView.includes(hook), `Existing capture hook missing: ${hook}`);
}

// Mobile ergonomics and accessibility are explicit acceptance criteria.
assert.match(css, /\.match-capture-v2 \.player-card-btn[\s\S]*min-height: 56px !important/);
assert.match(css, /\.match-capture-v2 \.action-btn[\s\S]*min-height: 52px !important/);
assert.match(css, /\.match-capture-floating-undo[\s\S]*position: fixed/);
assert.match(css, /@media \(max-width: 768px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /focus-visible/);

console.log("MATCH_CAPTURE_UX_CONTRACT_OK");
