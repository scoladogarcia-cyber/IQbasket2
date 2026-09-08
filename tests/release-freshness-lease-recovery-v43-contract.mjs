import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GameLiveSessionV43Service } from "../services/games/GameLiveSessionV43Service.js";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

const [
  indexHtml,
  deployWorkflow,
  leaseController,
  leaseService,
  registry,
  migration,
  releaseText
] = await Promise.all([
  read("index.html"),
  read(".github/workflows/deploy-pages.yml"),
  read("features/game-live/LiveWriterLeaseV43Controller.js"),
  read("services/games/GameLiveSessionV43Service.js"),
  read("services/LazyViewRegistry.js"),
  read("supabase/migrations/20260908093000_game_live_same_user_recovery_v43.sql"),
  read("release.json")
]);

assert.match(indexHtml, /__IQBASKET_BUILD_RELEASE__/);
assert.match(indexHtml, /latest !== buildRelease/);
assert.match(indexHtml, /cache: 'no-store'/);
assert.match(indexHtml, /searchParams\.set\('iqrelease'/);
assert.match(indexHtml, /Actualizar IQBasket/);

assert.match(deployWorkflow, /Stamp exact build release into HTML/);
assert.match(deployWorkflow, /replaceAll\(placeholder/);
assert.match(deployWorkflow, /Build release placeholder was not stamped/);

assert.match(leaseService, /iq_v43_recover_own_game_live_session/);
assert.match(leaseService, /this\.storeToken\(id, result\.lease_token\)/);
assert.match(leaseController, /extends LiveWriterLeaseController/);
assert.match(leaseController, /Recuperar mi turno/);
assert.match(leaseController, /releaseForNavigation/);
assert.match(leaseController, /restoreAfterHudRender/);
assert.match(leaseController, /attachLiveWriterLeaseV43/);

assert.match(registry, /LiveScoreHUDViewV42Safe/);
assert.match(registry, /attachLiveWriterLeaseV43/);
assert.doesNotMatch(registry, /import\("\.\.\/features\/game-live\/LiveWriterLeaseController\.js"\)/);

assert.match(migration, /writer_user_id<>auth\.uid\(\)/);
assert.match(migration, /GAME_LIVE_LEASE_RECOVERY_NOT_MINE/);
assert.match(migration, /lease_token_hash=v_hash/);
assert.match(migration, /version=version\+1/);
assert.match(migration, /'acquire_mode','SELF_RECOVERY'/);
assert.match(migration, /security invoker/i);
assert.match(migration, /grant execute on function public\.iq_v43_recover_own_game_live_session\(uuid\)/);

const release = JSON.parse(releaseText);
assert.equal(release.release, "2026.09.08.26");
assert.equal(release.label, "release-freshness-lease-recovery-v43");

// Functional client contract: recovery must rotate/store the server token.
const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

const gameId = "11111111-1111-4111-8111-111111111111";
const rpcCalls = [];
const client = {
  async rpc(name, args) {
    rpcCalls.push({ name, args });
    return {
      data: {
        game_id: gameId,
        active: true,
        is_mine: true,
        recovered: true,
        lease_token: "rotated-v43-token"
      },
      error: null
    };
  }
};

const service = new GameLiveSessionV43Service(client);
const recovered = await service.recoverOwn({ gameId });
assert.equal(recovered.recovered, true);
assert.equal(rpcCalls[0].name, "iq_v43_recover_own_game_live_session");
assert.equal(service.getStoredToken(gameId), "rotated-v43-token");

console.log("V43 release freshness + same-user lease recovery contract OK");
