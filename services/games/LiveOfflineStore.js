/**
 * @fileoverview Durable offline store for live capture.
 * @description Uses IndexedDB when available and localStorage as a compatibility
 * fallback. Stores a recoverable latest draft plus an ordered outbox of full
 * game snapshots. No authorization decision is made client-side.
 */

const DB_NAME = "iqbasket-live-v58";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const DRAFT_STORE = "drafts";
const LS_PREFIX = "iqbasket:v58:";

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function safeLocalStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage?.getItem) return null;
    return storage;
  } catch {
    return null;
  }
}

export class LiveOfflineStore {
  constructor({ indexedDB = globalThis.indexedDB, localStorage = safeLocalStorage() } = {}) {
    this.indexedDB = indexedDB || null;
    this.localStorage = localStorage || null;
    this.dbPromise = null;
  }

  _lsKey(kind, gameId) {
    return `${LS_PREFIX}${kind}:${String(gameId || "")}`;
  }

  async _db() {
    if (!this.indexedDB) return null;
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = this.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE, { keyPath: "gameId" });
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "operationId" });
          store.createIndex("game_created", ["gameId", "createdAt"], { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB no disponible."));
    }).catch(() => null);
    return this.dbPromise;
  }

  async _put(storeName, value) {
    const db = await this._db();
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(clone(value));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }

  async _delete(storeName, key) {
    const db = await this._db();
    if (!db) return false;
    return new Promise(resolve => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }

  async _get(storeName, key) {
    const db = await this._db();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async saveDraft(gameId, payload, metadata = {}) {
    const id = String(gameId || "");
    if (!id) return false;
    const row = { gameId: id, payload: clone(payload), metadata: clone(metadata), savedAt: new Date().toISOString() };
    try { this.localStorage?.setItem(this._lsKey("draft", id), JSON.stringify(row)); } catch {}
    return this._put(DRAFT_STORE, row);
  }

  async loadDraft(gameId) {
    const id = String(gameId || "");
    if (!id) return null;
    const indexed = await this._get(DRAFT_STORE, id);
    if (indexed) return indexed;
    try {
      const raw = this.localStorage?.getItem(this._lsKey("draft", id));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async clearDraft(gameId) {
    const id = String(gameId || "");
    try { this.localStorage?.removeItem(this._lsKey("draft", id)); } catch {}
    return this._delete(DRAFT_STORE, id);
  }

  async enqueue(gameId, payload, { baseRevision = null, operationId = uuid() } = {}) {
    const id = String(gameId || "");
    if (!id) throw new Error("gameId requerido para outbox.");
    const row = {
      operationId,
      gameId: id,
      baseRevision: Number.isFinite(Number(baseRevision)) ? Number(baseRevision) : null,
      payload: clone(payload),
      status: "PENDING",
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this._put(OUTBOX_STORE, row);
    await this.saveDraft(id, payload, { baseRevision: row.baseRevision, operationId });
    return row;
  }

  async list(gameId) {
    const id = String(gameId || "");
    const db = await this._db();
    if (!db || !id) return [];
    return new Promise(resolve => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const store = tx.objectStore(OUTBOX_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || [])
        .filter(row => String(row.gameId) === id)
        .sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt))));
      req.onerror = () => resolve([]);
    });
  }

  async markAttempt(operation, error = null) {
    const row = { ...operation, attempts: Number(operation.attempts || 0) + 1, updatedAt: new Date().toISOString(),
      status: error ? "FAILED" : "SYNCING", error: error ? String(error?.message || error) : null };
    await this._put(OUTBOX_STORE, row);
    return row;
  }

  async remove(operationId) {
    return this._delete(OUTBOX_STORE, operationId);
  }

  async pendingCount(gameId) {
    return (await this.list(gameId)).length;
  }

  async latest(gameId) {
    const rows = await this.list(gameId);
    return rows.at(-1) || null;
  }
}

export default LiveOfflineStore;
