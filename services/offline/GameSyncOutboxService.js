/**
 * @fileoverview Durable offline outbox for the game aggregate.
 * @description Stores the latest local game/stat/period/event aggregate per game
 * until the existing authoritative DataStore remote persistence succeeds.
 * It never bypasses permission/lifecycle checks and never queues authorization
 * or validation failures as if they were connectivity problems.
 */

const DB_NAME = "iqbasket_offline_v1";
const DB_VERSION = 1;
const STORE_NAME = "game_sync_outbox";
const FALLBACK_KEY = "iqbasket.gameSyncOutbox.v1";
const MAX_ATTEMPTS_BEFORE_FAILED = 5;

export const GAME_SYNC_STATUS = Object.freeze({
  SYNCED: "SYNCED",
  PENDING: "PENDING",
  SYNCING: "SYNCING",
  FAILED: "FAILED",
  OFFLINE: "OFFLINE"
});

function nowIso() {
  return new Date().toISOString();
}

function plain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("OFFLINE_DB_OPEN_FAILED"));
  });
}

async function idbPut(record) {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
  });
}

async function idbDelete(key) {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
  });
}

async function idbAll() {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

function fallbackRead() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fallbackWrite(rows) {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(rows));
}

async function persist(record) {
  try {
    if (await idbPut(record)) return;
  } catch (error) {
    console.warn("[OfflineOutbox] IndexedDB write fallback:", error?.message || error);
  }
  const rows = fallbackRead().filter(item => item.key !== record.key);
  rows.push(record);
  fallbackWrite(rows.slice(-50));
}

async function remove(key) {
  try {
    if (await idbDelete(key)) return;
  } catch (error) {
    console.warn("[OfflineOutbox] IndexedDB delete fallback:", error?.message || error);
  }
  fallbackWrite(fallbackRead().filter(item => item.key !== key));
}

async function readAll() {
  try {
    const rows = await idbAll();
    if (rows) return rows;
  } catch (error) {
    console.warn("[OfflineOutbox] IndexedDB read fallback:", error?.message || error);
  }
  return fallbackRead();
}

export function isTransientSyncError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toUpperCase();

  // Never convert authorization/data-integrity failures into an offline success.
  if (
    code === "42501"
    || /permission|denied|rls|row.level.security|jwt|unauthori[sz]ed|forbidden|constraint|duplicate|invalid|locked|frozen/.test(message)
  ) return false;

  return /failed to fetch|network|networkerror|fetch failed|timeout|timed out|connection|offline|load failed/.test(message);
}

function dispatchStatus(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("iqbasket:game-sync-status", { detail }));
}

export class GameSyncOutboxService {
  constructor({ persistAggregate } = {}) {
    this.persistAggregate = typeof persistAggregate === "function" ? persistAggregate : null;
    this.processing = false;
    this.lastProcessAt = 0;
  }

  _key(gameId) {
    return `game:${String(gameId || "").trim()}`;
  }

  async enqueue({ game, playerStats = [], periodScores = [], gameEvents = [], error = null }) {
    if (!game?.id) throw new Error("OFFLINE_OUTBOX_GAME_ID_REQUIRED");
    const record = {
      key: this._key(game.id),
      gameId: String(game.id),
      status: GAME_SYNC_STATUS.PENDING,
      attempts: 0,
      payload: {
        game: plain(game),
        playerStats: plain(playerStats || []),
        periodScores: plain(periodScores || []),
        gameEvents: plain(gameEvents || [])
      },
      lastError: String(error?.message || error || ""),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    await persist(record);
    dispatchStatus({ gameId: record.gameId, status: navigator?.onLine === false ? GAME_SYNC_STATUS.OFFLINE : GAME_SYNC_STATUS.PENDING, pending: true });
    return record;
  }

  async list() {
    return (await readAll()).sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
  }

  async pendingCount() {
    return (await this.list()).filter(row => [GAME_SYNC_STATUS.PENDING, GAME_SYNC_STATUS.SYNCING, GAME_SYNC_STATUS.FAILED].includes(row.status)).length;
  }

  async process({ force = false } = {}) {
    if (this.processing || !this.persistAggregate) return { processed: 0, remaining: await this.pendingCount() };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { processed: 0, remaining: await this.pendingCount() };
    const now = Date.now();
    if (!force && now - this.lastProcessAt < 3000) return { processed: 0, remaining: await this.pendingCount() };

    this.processing = true;
    this.lastProcessAt = now;
    let processed = 0;
    try {
      const queue = await this.list();
      for (const item of queue) {
        if (item.status === GAME_SYNC_STATUS.FAILED && !force) continue;
        const working = { ...item, status: GAME_SYNC_STATUS.SYNCING, updatedAt: nowIso() };
        await persist(working);
        dispatchStatus({ gameId: item.gameId, status: GAME_SYNC_STATUS.SYNCING, pending: true });

        try {
          const p = item.payload || {};
          await this.persistAggregate(p.game, p.playerStats || [], p.periodScores || [], p.gameEvents || []);
          await remove(item.key);
          processed += 1;
          dispatchStatus({ gameId: item.gameId, status: GAME_SYNC_STATUS.SYNCED, pending: false });
        } catch (error) {
          const attempts = Number(item.attempts || 0) + 1;
          const transient = isTransientSyncError(error);
          const failed = !transient || attempts >= MAX_ATTEMPTS_BEFORE_FAILED;
          await persist({
            ...item,
            status: failed ? GAME_SYNC_STATUS.FAILED : GAME_SYNC_STATUS.PENDING,
            attempts,
            lastError: String(error?.message || error || "SYNC_FAILED"),
            updatedAt: nowIso()
          });
          dispatchStatus({
            gameId: item.gameId,
            status: failed ? GAME_SYNC_STATUS.FAILED : GAME_SYNC_STATUS.PENDING,
            pending: true,
            retryable: transient
          });
          if (!transient) break;
        }
      }
    } finally {
      this.processing = false;
    }
    return { processed, remaining: await this.pendingCount() };
  }
}

export default GameSyncOutboxService;
