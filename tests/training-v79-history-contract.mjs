import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

/**
 * V79 regression guards for the authorized training-history UX.
 * These contract checks complement real-browser and authenticated RPC tests.
 */
const source=readFileSync(new URL("../views/TrainingView.js",import.meta.url),"utf8");
for (const key of ["from","to","kind","player","status"]) {
  assert.match(source,new RegExp('data-filter="'+key+'"'),"Missing filter "+key);
}
assert.match(source,/const pageSize=20/);
assert.match(source,/p360-v79-select-page/);
assert.match(source,/p360-v79-validate/);
assert.match(source,/this\._canEditTrainingSession\(s\)/);
assert.match(source,/p_session_id:session\.id,p_team_season_id:session\.team_season_id,p_validate:true/);
assert.match(source,/if\(error\)throw error/);
assert.match(source,/failures\.push/);
assert.match(source,/no es un lote|not an atomic batch/i);
assert.doesNotMatch(source,/\.from\(["']training_sessions["']\)\.update\(/);
console.log("PASS V79: filters, paging and per-session authorized batch validation.");
