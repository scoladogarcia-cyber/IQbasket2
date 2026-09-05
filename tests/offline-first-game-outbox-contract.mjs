import fs from "node:fs";
import assert from "node:assert/strict";
import { isTransientSyncError, GAME_SYNC_STATUS } from "../services/offline/GameSyncOutboxService.js";

const outbox = fs.readFileSync("services/offline/GameSyncOutboxService.js", "utf8");
const bootstrap = fs.readFileSync("features/offline/OfflineFirstBootstrap.js", "utf8");
const statusUi = fs.readFileSync("features/offline/OfflineSyncStatusEnhancer.js", "utf8");
const dataStore = fs.readFileSync("services/DataStore.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.equal(GAME_SYNC_STATUS.PENDING, "PENDING");
assert.equal(GAME_SYNC_STATUS.SYNCED, "SYNCED");
assert.equal(isTransientSyncError({ code:"42501", message:"permission denied" }), false);
assert.equal(isTransientSyncError({ message:"row level security policy denied" }), false);
assert.equal(isTransientSyncError({ message:"Partido locked" }), false);
assert.equal(isTransientSyncError({ message:"Failed to fetch" }), true);
assert.equal(isTransientSyncError({ message:"NetworkError when attempting to fetch resource" }), true);

// Durable local queue + bounded retry semantics.
assert.match(outbox, /indexedDB\.open/);
assert.match(outbox, /game_sync_outbox/);
assert.match(outbox, /MAX_ATTEMPTS_BEFORE_FAILED\s*=\s*5/);
assert.match(outbox, /game:\$\{String\(gameId/);
assert.match(outbox, /status:\s*GAME_SYNC_STATUS\.FAILED/);
assert.match(outbox, /iqbasket:game-sync-status/);

// Existing DataStore remains authoritative: permission/eligibility then local
// persistence happen before the remote Supabase block.
const permissionPos = dataStore.indexOf("_assertPermission", dataStore.indexOf("async saveGameAndStats"));
const localPos = dataStore.indexOf("this._persistToStorage()", dataStore.indexOf("async saveGameAndStats"));
const remotePos = dataStore.indexOf("// 2. Persistencia remota en Supabase", dataStore.indexOf("async saveGameAndStats"));
assert(permissionPos >= 0 && localPos > permissionPos && remotePos > localPos);

// Decorator calls the original method; it does not duplicate Supabase table logic.
assert.match(bootstrap, /const persistAggregate = dataStore\.saveGameAndStats\.bind\(dataStore\)/);
assert.match(bootstrap, /if \(!isTransientSyncError\(error\)\) throw error/);
assert.match(bootstrap, /await outbox\.enqueue/);
assert.doesNotMatch(bootstrap, /supabase\.from|\.from\(["']games/);

// Sync state is user-visible in match capture but does not mutate data.
assert.match(statusUi, /Sin conexión · guardado local/);
assert.match(statusUi, /Pendiente de sincronizar/);
assert.match(statusUi, /Sincronizado/);
assert.doesNotMatch(statusUi, /DataStore|supabase|saveGameAndStats/);

assert.match(html, /features\/offline\/OfflineFirstBootstrap\.js/);
assert.match(html, /features\/offline\/OfflineSyncStatusEnhancer\.js/);
assert.match(html, /styles\/offline-sync-v1\.css/);

console.log("OFFLINE_FIRST_GAME_OUTBOX_CONTRACT_OK");
