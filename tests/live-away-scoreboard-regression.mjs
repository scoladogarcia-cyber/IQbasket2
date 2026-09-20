/** Regression: a visiting team's baskets belong to the visiting scoreboard. */
import assert from "node:assert/strict";
import { orientGameScore } from "../domain/games/GameScoreOrientation.js";
import { readFileSync } from "node:fs";

assert.deepEqual(orientGameScore("Visitante", 15, 7), {
  isAway: true, homeScore: 7, awayScore: 15
});
assert.deepEqual(orientGameScore("Local", 15, 7), {
  isAway: false, homeScore: 15, awayScore: 7
});
assert.deepEqual(orientGameScore("visitant", 0, 2), {
  isAway: true, homeScore: 2, awayScore: 0
});
assert.deepEqual(orientGameScore("away", 3, 0), {
  isAway: true, homeScore: 0, awayScore: 3
});
const source = readFileSync(new URL("../views/LiveScoreHUDViewV42Safe.js", import.meta.url), "utf8");
assert.match(source, /orientGameScore\(this\.config\?\.venue, this\.teamScore, this\.opponentScore\)/);
assert.match(source, /homeValue\.textContent = String\(display\.homeScore\)/);
assert.match(source, /awayValue\.textContent = String\(display\.awayScore\)/);
assert.match(source, /super\._renderPostGameActa\(\)/);
assert.match(source, /super\._renderHUD\(\)/);
assert.doesNotMatch(source, /this\.teamScore\s*=\s*this\.opponentScore/);
assert.doesNotMatch(source, /UPDATE public\.games|DELETE FROM public\.game_events/i);
console.log("Live home-away score presentation and untouched canonical scores: OK");
