import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GameDeletionServiceV40 } from "../services/games/GameDeletionServiceV40.js";

const migration = await readFile(new URL("../supabase/migrations/20260908074500_live_scorer_delete_v40.sql", import.meta.url), "utf8");
const service = await readFile(new URL("../services/games/GameDeletionServiceV40.js", import.meta.url), "utf8");
const modes = await readFile(new URL("../views/games/GameCaptureModesView.js", import.meta.url), "utf8");
const scorer = await readFile(new URL("../views/LiveScoreHUDViewV40.js", import.meta.url), "utf8");
const registry = await readFile(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");
const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url), "utf8"));

// Database: destructive delete is centralized, permission checked and audited.
assert.match(migration, /create schema if not exists iq_v40_private/i);
assert.match(migration, /create table if not exists public\.game_deletion_audit/i);
assert.match(migration, /security definer/i);
assert.match(migration, /iq_private\.can_delete_game\(p_game_id\)/i);
assert.match(migration, /GAME_DELETE_REFERENCED/i);
assert.match(migration, /delete from public\.game_play_state_transitions where game_id = p_game_id/i);
assert.match(migration, /delete from public\.games where id = p_game_id/i);
assert.ok(
  migration.indexOf("delete from public.game_play_state_transitions") < migration.indexOf("delete from public.games where id = p_game_id"),
  "lifecycle RESTRICT rows must be handled before deleting the game"
);
assert.match(migration, /public\.iq_v40_delete_game/i);
assert.match(migration, /security invoker/i);
assert.match(migration, /revoke all on table public\.game_deletion_audit from public, anon, authenticated/i);

// Client: server confirmation is mandatory.
assert.match(service, /iq_v40_delete_game/);
assert.match(service, /if \(error\) throw friendlyDeleteError\(error\)/);
assert.match(service, /if \(!data\?\.deleted/);

const calls = [];
const deletion = new GameDeletionServiceV40({
  async rpc(name, args) {
    calls.push({ name, args });
    return { data: { deleted: true, game_id: args.p_game_id }, error: null };
  }
});
const gameId = "11111111-1111-4111-8111-111111111111";
const result = await deletion.deleteGame({ gameId, reason: "qa" });
assert.equal(result.deleted, true);
assert.deepEqual(calls, [{
  name: "iq_v40_delete_game",
  args: { p_game_id: gameId, p_reason: "qa" }
}]);

const referenced = new GameDeletionServiceV40({
  async rpc() {
    return { data: null, error: { message: "GAME_DELETE_REFERENCED" } };
  }
});
await assert.rejects(
  () => referenced.deleteGame({ gameId }),
  /informes o evidencias de desarrollo/i
);

// Game list: legacy optimistic listener is removed; refresh occurs after RPC.
assert.match(modes, /GameDeletionServiceV40/);
assert.match(modes, /btn-delete-game-direct\[data-id\]/);
assert.match(modes, /cloneNode\(true\)/);
assert.match(modes, /await this\.gameDeletionService\.deleteGame/);
assert.match(modes, /await DataStore\.init\(teamId, true\)/);
assert.ok(
  modes.indexOf("await this.gameDeletionService.deleteGame") < modes.indexOf("await DataStore.init(teamId, true)"),
  "the UI must refresh only after the server confirms deletion"
);

// Scorer: V40 is a visible, immersive presentation over proven V39 behavior.
assert.match(scorer, /extends LiveScoreHUDViewV39/);
assert.match(scorer, /dataset\.v40Scorer/);
assert.match(scorer, /position:fixed!important/);
assert.match(scorer, /height:100dvh!important/);
assert.match(scorer, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
assert.match(scorer, /v40-secondary-panel/);
assert.match(scorer, /ACTION_ORDER/);
assert.match(scorer, /window\.location\.hash = "#\/partidos"/);
assert.doesNotMatch(scorer, /saveGameAndStats/);

assert.match(registry, /LiveScoreHUDViewV40/);
assert.match(registry, /attachLiveCaptureStartGate/);
assert.match(registry, /attachLiveWriterLease/);
assert.equal(release.release, "2026.09.08.23");
assert.equal(release.label, "immersive-live-scorer-safe-delete-v40");

console.log("V40 immersive live scorer + safe delete contract OK");
