import fs from "node:fs";
import assert from "node:assert/strict";

const enhancer = fs.readFileSync("features/wellness/WellnessCardsEnhancer.js", "utf8");
const css = fs.readFileSync("styles/wellness-cards-v1.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const panel = fs.readFileSync("views/player360/WellnessSupportPanel.js", "utf8");
const config = fs.readFileSync("config/player360-wellness.config.js", "utf8");

// Progressive enhancement: existing panel contract stays the data source.
assert.match(enhancer, /\.p360w-editor/);
assert.match(enhancer, /\.p360w-metric/);
assert.match(enhancer, /\.p360w-input/);
assert.match(enhancer, /data-wellness-card-value/);
assert.match(enhancer, /Check-in express/);
assert.match(enhancer, /≈ 30 s/);
assert.match(enhancer, /SLEEP_DURATION_HOURS/);
assert.match(enhancer, /MutationObserver/);
assert.match(enhancer, /navigator\.vibrate/);

// The enhancer must never become an authorization or persistence layer.
for (const forbidden of [
  "DataStore",
  "WellnessService",
  "supabase",
  "Permission",
  ".from(",
  ".rpc("
]) {
  assert(!enhancer.includes(forbidden), `Wellness cards UI must not depend on ${forbidden}`);
}

// Original form inputs remain present and authoritative for form collection.
assert.match(panel, /class=\"p360w-input\"/);
assert.match(panel, /_collectValues\(form\)/);
assert.match(panel, /saveManualEntry/);
assert.match(panel, /backend ABAC/i);
assert.match(css, /wellness-card-source/);
assert.match(css, /min-height:5[02]px/);
assert.match(css, /prefers-reduced-motion/);

// Wiring is additive and isolated.
assert.match(html, /styles\/wellness-cards-v1\.css/);
assert.match(html, /features\/wellness\/WellnessCardsEnhancer\.js/);

// Sensitive/clinical defaults remain explicitly prohibited and AI stays disabled.
assert.match(config, /PLAYER360_WELLNESS_PROHIBITED_DEFAULT_CODES/);
assert.match(config, /"DIAGNOSIS"/);
assert.match(config, /"CLINICAL_SYMPTOMS"/);
assert.match(config, /aiProcessingEnabled:\s*false/);

console.log("WELLNESS_CARDS_CONTRACT_OK");
