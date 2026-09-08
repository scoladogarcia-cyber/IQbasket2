/**
 * @fileoverview Resilient live-capture synchronization boundary.
 * @description Persists a local draft before/when a live capture write cannot reach
 * the backend and clears it only after the authoritative game-capture RPC accepts
 * the snapshot. The backend remains the source of truth and still enforces RBAC,
 * game lifecycle and the V28 single-writer lease.
 */

const STORAGE_PREFIX = "iqbasket:live-capture-draft:";

function safeStorage(storage = null) {
  try {
    const target = storage || globalThis?.localStorage || null;
    if (!target?.getItem || !target?.setItem || !target?.removeItem) return null;
    return target;
  } catch {
    return null;
  }
}

function normalizeGameId(gameId) {
  return String(gameId || "").trim();
}

export class LiveCaptureSyncService {
  constructor(captureService, storage = null) {
    this.captureService = captureService || null;
    this.storage = safeStorage(storage);
  }

  _key(gameId) {
    const id = normalizeGameId(gameId);
    return id ? `${STORAGE_PREFIX}${id}` : null;
  }

  saveDraft(gameId, payload) {
    const key = this._key(gameId);
    if (!key || !this.storage) return false;
    try {
      this.storage.setItem(key, JSON.stringify({
        gameId: normalizeGameId(gameId),
        savedAt: new Date().toISOString(),
        payload
      }));
      return true;
    } catch {
      return false;
    }
  }

  loadDraft(gameId) {
    const key = this._key(gameId);
    if (!key || !this.storage) return null;
    try {
      const raw = this.storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  clearDraft(gameId) {
    const key = this._key(gameId);
    if (!key || !this.storage) return false;
    try {
      this.storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Syncs one complete live snapshot through the existing secure capture RPC.
   * A draft is written first so connectivity loss never discards the scorer's
   * latest local state. Failed writes are deliberately returned, not swallowed.
   */
  async sync(gameId, payload) {
    const id = normalizeGameId(gameId);
    if (!id || !this.captureService?.saveCapture) {
      return { synced: false, queued: false, error: new Error("Live sync backend no disponible.") };
    }

    const queued = this.saveDraft(id, payload);
    try {
      const result = await this.captureService.saveCapture({ gameId: id, ...payload });
      this.clearDraft(id);
      return { synced: true, queued: false, result, error: null };
    } catch (error) {
      return { synced: false, queued, error };
    }
  }
}

export default LiveCaptureSyncService;
