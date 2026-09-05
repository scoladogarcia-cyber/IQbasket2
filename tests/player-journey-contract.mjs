import fs from "node:fs";
import assert from "node:assert/strict";
import { PLAYER_JOURNEY_SAFETY, PLAYER_MICRO_CHALLENGE_CATALOG } from "../config/player-journey.config.js";

const sql = fs.readFileSync("supabase/ready/20260905_apply_player_journey_v1.sql", "utf8");
const service = fs.readFileSync("services/player360/PlayerJourneyService.js", "utf8");
const ui = fs.readFileSync("features/player-journey/PlayerJourneyEnhancer.js", "utf8");
const css = fs.readFileSync("styles/player-journey-v1.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.equal(PLAYER_JOURNEY_SAFETY.playerOnly, true);
assert.equal(PLAYER_JOURNEY_SAFETY.oneNewChallengePerWeek, true);
assert.equal(PLAYER_JOURNEY_SAFETY.leaderboardEnabled, false);
assert.equal(PLAYER_JOURNEY_SAFETY.socialComparisonEnabled, false);
assert.equal(PLAYER_JOURNEY_SAFETY.loginStreakEnabled, false);
assert.equal(PLAYER_JOURNEY_SAFETY.variableRewardsEnabled, false);
assert.equal(PLAYER_JOURNEY_SAFETY.wellnessTriggersAllowed, false);
assert.equal(PLAYER_JOURNEY_SAFETY.healthTriggersAllowed, false);
assert(PLAYER_MICRO_CHALLENGE_CATALOG.length >= 6);

// Backend is RPC-only, self-scoped and rate-limited to one challenge per week.
assert.match(sql, /create table public\.player_micro_challenge_catalog/i);
assert.match(sql, /create table public\.player_micro_challenges/i);
assert.match(sql, /enable row level security/gi);
assert.match(sql, /revoke all on table public\.player_micro_challenges from public,anon,authenticated/i);
assert.match(sql, /player_journey_is_self/);
assert.match(sql, /upper\(coalesce\(up\.global_role,up\.role,''\)\)='JUGADOR'/);
assert.match(sql, /up\.linked_player_id=p_player_id/);
assert.match(sql, /player_micro_challenge_one_week_uq/);
assert.match(sql, /PLAYER_JOURNEY_WEEK_ALREADY_USED/);
assert.match(sql, /iq_v12_player_journey_snapshot/);
assert.match(sql, /iq_v12_player_journey_start/);
assert.match(sql, /iq_v12_player_journey_complete/);
assert.match(sql, /mastery_claimed',false/);

// V1 must never build challenges from hidden objectives or wellness/health data.
for (const forbidden of [
  "player360_wellness_entries",
  "player360_wellness_observations",
  "player_evaluations",
  "player_evaluation_scores",
  "player_objective_profiles",
  "player_objective_targets"
]) {
  assert(!sql.includes(forbidden), `Player Journey V1 must not query ${forbidden}`);
}

// Thin client: direct commercial/data-table access is forbidden.
assert.match(service, /iq_v12_player_journey_snapshot/);
assert.match(service, /iq_v12_player_journey_start/);
assert.match(service, /iq_v12_player_journey_complete/);
assert.doesNotMatch(service, /\.from\(/);

// UI surface only renders for authenticated JUGADOR self-profile.
assert.match(ui, /getAuthenticatedRole\?\.\(\) !== UserRole\.JUGADOR/);
assert.match(ui, /String\(user\.playerId/);
assert.match(ui, /Progreso personal/);
assert.match(ui, /Sin puntos ni clasificación/);
assert.match(ui, /no significa que una habilidad esté dominada/);
assert.doesNotMatch(ui, /leaderboard|ranking|racha diaria|streak/i);
assert.match(css, /min-height:48px/);
assert.match(html, /styles\/player-journey-v1\.css/);
assert.match(html, /features\/player-journey\/PlayerJourneyEnhancer\.js/);

console.log("PLAYER_JOURNEY_CONTRACT_OK");
