import assert from "node:assert/strict";
import fs from "node:fs";
import { presentFamilyPlayer360 } from "../domain/family/FamilyPlayer360Presenter.js";
import {
  newestRecentGames,
  chronologicalRecentGames
} from "../views/family/FamilyWorkspaceV32View.js";

const read = path => fs.readFileSync(path, "utf8");

const migration = read("supabase/migrations/20260907133500_family_runtime_data_v32.sql");
const familyService = read("services/family/FamilyWorkspaceService.js");
const familyView = read("views/family/FamilyWorkspaceV32View.js");
const lazyRegistry = read("services/LazyViewRegistry.js");
const gameCapture = read("views/games/GameCaptureModesView.js");
const nutritionRouter = read("views/PlayerNutritionRouterView.js");
const release = JSON.parse(read("release.json"));

// Modern season resolution must use the current catalog, not the retired legacy table.
assert.match(migration, /join public\.season_catalog sc on sc\.id=ts\.season_id/i);
assert.doesNotMatch(migration, /join public\.seasons s on s\.id=ts\.season_id/i);
assert.match(migration, /iq_v32_family_list_players/i);
assert.match(migration, /iq_v32_family_player_passport/i);
assert.match(migration, /iq_v32_family_player360_snapshot/i);

// Guardian wellness access is deliberately narrow: linked subject + active relation,
// Nutrition/Recovery only, READ only, and Family Support purpose only.
assert.match(migration, /iq_v32_guardian_linked_wellness_read_allowed/i);
assert.match(migration, /in \('nutrition','recovery'\)/i);
assert.match(migration, /upper\(trim\(coalesce\(p_action,''\)\)\)='READ'/i);
assert.match(migration, /upper\(trim\(coalesce\(p_purpose,''\)\)\)='FAMILY_SUPPORT'/i);
assert.match(migration, /r\.relationship_type='GUARDIAN'/i);
assert.match(migration, /r\.status='ACTIVE'/i);
assert.match(migration, /r\.player_id=p_player_id/i);
assert.doesNotMatch(migration, /iq_v32_guardian_linked_wellness_read_allowed[\s\S]*p_action[^$]*='CREATE'/i);
assert.doesNotMatch(migration, /iq_v32_guardian_linked_wellness_read_allowed[\s\S]*p_action[^$]*='UPDATE'/i);

// Browser rollout is progressive: V32 when installed, V8 fallback while Pages/DB roll out.
assert.match(familyService, /iq_v32_family_list_players/);
assert.match(familyService, /iq_v8_family_list_players/);
assert.match(familyService, /iq_v32_family_player_passport/);
assert.match(familyService, /iq_v32_family_player360_snapshot/);
assert.match(familyService, /progressiveRpc/);

// Basic sporting evidence remains available independently from advanced paid Player360.
assert.match(lazyRegistry, /FamilyWorkspaceV32View/);
assert.match(familyView, /EVOLUCIÓN DEPORTIVA/);
assert.match(familyView, /_barChart\(games,"points","Puntos"\)/);
assert.match(familyView, /_barChart\(games,"minutes","Minutos",true\)/);

const passport = {
  recent_games: Array.from({ length: 12 }, (_, index) => ({
    game_id: `g-${index + 1}`,
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    opponent: `Rival ${index + 1}`,
    points: index + 1,
    minutes: 10 + index
  }))
};
const newest = newestRecentGames(passport);
const chronological = chronologicalRecentGames(passport);
assert.equal(newest.length, 12);
assert.equal(newest[0].points, 12);
assert.equal(newest.at(-1).points, 1);
assert.equal(chronological[0].points, 1);
assert.equal(chronological.at(-1).points, 12);

const story = presentFamilyPlayer360({ recent_games: newest });
assert.equal(story.enoughEvidence, true);
const pointTrend = story.trends.find(item => item.key === "points");
assert.equal(pointTrend?.direction, "UP");

// A BoxScore-only legacy card must still reveal its delegated Live/Quick actions.
assert.match(gameCapture, /gameIdFromBoxScore/);
assert.match(gameCapture, /route\.match\([^\n]*boxscore/i);
assert.match(gameCapture, /#\/live\/\$\{encodeURIComponent\(String\(game\.id\)\)\}/);
assert.match(gameCapture, /#\/easy-entry\/\$\{encodeURIComponent\(String\(game\.id\)\)\}/);
assert.match(gameCapture, /Permission\.RECORD_LIVE_GAME/);
assert.match(gameCapture, /Permission\.RECORD_QUICK_GAME/);

// Nutrition must open Wellness directly instead of landing on the first Player360 tab.
assert.match(nutritionRouter, /view\.activeTab = "wellness"/);
assert.match(nutritionRouter, /return view\.render\(containerId, subjectPlayerId, teamId\)/);
assert.doesNotMatch(nutritionRouter, /window\.location\.hash\s*=\s*target/);

assert.equal(release.label, "family-runtime-data-v32");
console.log("FAMILY_RUNTIME_DATA_V32_OK");
