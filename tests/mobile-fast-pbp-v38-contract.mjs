import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LiveCaptureSyncService } from "../services/games/LiveCaptureSyncService.js";

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const gameId = "11111111-1111-4111-8111-111111111111";
const payload = {
  teamScore: 12,
  opponentScore: 9,
  starterIds: [],
  stats: null,
  periods: [],
  events: [{ id: "e1", action_type: "fg2_made", points: 2 }]
};

{
  const storage = new MemoryStorage();
  let received = null;
  const service = new LiveCaptureSyncService({
    async saveCapture(value) { received = value; return { ok: true }; }
  }, storage);
  const result = await service.sync(gameId, payload);
  assert.equal(result.synced, true);
  assert.equal(result.queued, false);
  assert.equal(received.gameId, gameId);
  assert.equal(received.teamScore, 12);
  assert.equal(service.loadDraft(gameId), null, "successful sync must clear local draft");
}

{
  const storage = new MemoryStorage();
  const service = new LiveCaptureSyncService({
    async saveCapture() { throw new Error("offline"); }
  }, storage);
  const result = await service.sync(gameId, payload);
  assert.equal(result.synced, false);
  assert.equal(result.queued, true);
  const draft = service.loadDraft(gameId);
  assert.equal(draft.gameId, gameId);
  assert.equal(draft.payload.events[0].action_type, "fg2_made");
}

const hud = await readFile(new URL("../views/LiveScoreHUDViewV38.js", import.meta.url), "utf8");
const liveCenter = await readFile(new URL("../views/games/ScopedGameBoxScoreLiveV38View.js", import.meta.url), "utf8");
const registry = await readFile(new URL("../services/LazyViewRegistry.js", import.meta.url), "utf8");
const release = JSON.parse(await readFile(new URL("../release.json", import.meta.url), "utf8"));

assert.match(hud, /extends LiveScoreHUDView/);
assert.match(hud, /player -> action or/);
assert.match(hud, /fastPendingActionKey/);
assert.match(hud, /_recordPlayerAction\(/);
assert.match(hud, /_scheduleLiveSync\(/);
assert.match(hud, /_startClock\(/);
assert.match(hud, /v38-player-grid/);
assert.match(hud, /v38-actions-grid/);
assert.match(hud, /Añadir localización de tiro \(opcional\)/);
assert.match(hud, /min-height:58px/);
assert.match(hud, /navigator\?\.vibrate/);

// Fast made/missed shots must exist independently from the optional court modal.
assert.match(hud, /fg2_made: Object\.freeze/);
assert.match(hud, /fg3_made: Object\.freeze/);
assert.match(hud, /_openAdvancedShot/);
assert.match(hud, /activeModal = "court_shot"/);

// The family/read-only surface must only use reads and stay on the existing RLS boundary.
assert.match(liveCenter, /extends ScopedGameBoxScoreView/);
assert.match(liveCenter, /from\("games"\)\.select/);
assert.match(liveCenter, /from\("play_by_play_events"\)\.select/);
assert.doesNotMatch(liveCenter, /\.insert\(/);
assert.doesNotMatch(liveCenter, /\.update\(/);
assert.doesNotMatch(liveCenter, /\.delete\(/);
assert.match(liveCenter, /2500/);

assert.match(registry, /LiveScoreHUDViewV38/);
assert.match(registry, /ScopedGameBoxScoreLiveV38View/);
assert.equal(release.release, "2026.09.08.21");
assert.equal(release.label, "mobile-fast-pbp-live-game-v38");

console.log("V38 mobile fast PBP contract OK");
