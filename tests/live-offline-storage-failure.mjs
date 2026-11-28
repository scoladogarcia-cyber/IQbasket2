import assert from "node:assert/strict";
import LiveCaptureSyncService from "../services/games/LiveCaptureSyncService.js";
import { LiveOfflineStore } from "../services/games/LiveOfflineStore.js";

const gameId = "c6e415ad-dc45-4583-8d2c-6154da85980f";
const payload = { events: [{ client_event_key: "first-shot" }] };
const fullStorage = {
  getItem: () => null,
  setItem() { throw new Error("QuotaExceededError"); }
};
const unavailableStore = new LiveOfflineStore({ indexedDB: null, localStorage: fullStorage });

await assert.rejects(unavailableStore.enqueue(gameId, payload), /no ha podido guardar/);

const sync = new LiveCaptureSyncService(
  { saveCapture: () => assert.fail("The outbox write failed") },
  fullStorage,
  unavailableStore
);
const result = await sync.sync(gameId, payload);
assert.equal(result.synced, false);
assert.equal(result.queued, false);
assert.match(result.error.message, /no ha podido guardar/);

const records = new Map();
const fallbackStore = new LiveOfflineStore({
  indexedDB: null,
  localStorage: {
    getItem: key => records.get(key),
    setItem: (key, value) => records.set(key, value)
  }
});
const saved = await fallbackStore.enqueue(gameId, payload);
assert.deepEqual((await fallbackStore.list(gameId)).map(row => row.operationId), [saved.operationId]);
