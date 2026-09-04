import assert from "node:assert/strict";
import { parseBooleanLike, resolveShotMade } from "../domain/analytics/ShotOutcomeResolver.js";

assert.equal(parseBooleanLike(true), true);
assert.equal(parseBooleanLike(false), false);
assert.equal(parseBooleanLike("true"), true);
assert.equal(parseBooleanLike("false"), false);
assert.equal(parseBooleanLike(1), true);
assert.equal(parseBooleanLike(0), false);
assert.equal(parseBooleanLike("unknown"), null);

// Demo Universe V1 currently stores made shots with action_type=fg*_attempted
// plus an authoritative `made=true`. This must render as a make.
assert.equal(resolveShotMade({ action_type: "fg2_attempted", made: true, points: 2 }), true);
assert.equal(resolveShotMade({ action_type: "fg3_attempted", made: true, points: 3 }), true);

// Play-by-play projections may omit `made`; positive points still prove a make.
assert.equal(resolveShotMade({ event_type: "fg3_attempted", points: 3 }), true);

// Misses remain misses.
assert.equal(resolveShotMade({ action_type: "fg2_attempted", made: false, points: 0 }), false);
assert.equal(resolveShotMade({ event_type: "shot_missed", points: 0 }), false);
assert.equal(resolveShotMade({ action_type: "tiro_fallado" }), false);

// Explicit outcome wins over inconsistent legacy text/points.
assert.equal(resolveShotMade({ action_type: "fg3_made", made: "false", points: 3 }), false);
assert.equal(resolveShotMade({ action_type: "fg2_attempted", coordinates: { made: true } }), true);
assert.equal(resolveShotMade({ action_type: "tiro_anotado" }), true);

console.log("Shot outcome resolver: OK");
