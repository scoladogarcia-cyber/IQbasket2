/**
 * @fileoverview Resilient live-capture synchronization boundary.
 * @description V58 preserves the V38 draft contract and adds a durable IndexedDB
 * outbox, idempotent operation identifiers and optimistic revision checks.
 */

import { LiveOfflineStore } from "./LiveOfflineStore.js";

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
function normalizeGameId(gameId) { return String(gameId || "").trim(); }

export class LiveCaptureSyncService {
  constructor(captureService, storage = null, offlineStore = null) {
    this.captureService = captureService || null;
    this.storage = safeStorage(storage);
    this.offlineStore = offlineStore || new LiveOfflineStore({ localStorage: this.storage });
  }

  _key(gameId) {
    const id = normalizeGameId(gameId);
    return id ? `${STORAGE_PREFIX}${id}` : null;
  }

  /** Backward-compatible immediate draft used by V38 tests and old browsers. */
  saveDraft(gameId, payload) {
    const key = this._key(gameId);
    if (!key || !this.storage) {
      this.offlineStore.saveDraft(gameId, payload).catch(() => {});
      return false;
    }
    try {
      this.storage.setItem(key, JSON.stringify({
        gameId: normalizeGameId(gameId),
        savedAt: new Date().toISOString(),
        payload
      }));
      this.offlineStore.saveDraft(gameId, payload).catch(() => {});
      return true;
    } catch {
      this.offlineStore.saveDraft(gameId, payload).catch(() => {});
      return false;
    }
  }

  loadDraft(gameId) {
    const key = this._key(gameId);
    if (!key || !this.storage) return null;
    try {
      const raw = this.storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  clearDraft(gameId) {
    const key = this._key(gameId);
    try { if (key) this.storage?.removeItem(key); } catch {}
    this.offlineStore.clearDraft(gameId).catch(() => {});
    return Boolean(key);
  }

  async getRevision(gameId) {
    if (!this.captureService?.getCaptureSyncStatus) return null;
    const status = await this.captureService.getCaptureSyncStatus(gameId);
    const value = Number(status?.capture_revision);
    return Number.isFinite(value) ? value : null;
  }

  async stage(gameId, payload, { baseRevision = null } = {}) {
    const id = normalizeGameId(gameId);
    if (!id) throw new Error("Partido no disponible para sincronización.");
    this.saveDraft(id, payload);
    return this.offlineStore.enqueue(id, payload, { baseRevision });
  }

  /**
   * Flushes the ordered outbox. Each entry contains a complete game snapshot,
   * so replay is deterministic. Server-side client_operation_id makes retries
   * idempotent; base_revision prevents a stale device from overwriting a newer
   * writer without an explicit conflict.
   */
  async flush(gameId) {
    const id = normalizeGameId(gameId);
    if (!id || !this.captureService?.saveCapture) {
      return { synced: false, queued: false, pending: 0, error: new Error("Live sync backend no disponible.") };
    }

    const queue = await this.offlineStore.list(id);
    if (!queue.length) {
      const draft = await this.offlineStore.loadDraft(id);
      return { synced: !draft, queued: Boolean(draft), pending: draft ? 1 : 0, error: null };
    }

    const remoteRevision = await this.getRevision(id).catch(() => null);
    const firstBase = Number(queue[0]?.baseRevision);
    const hasFirstBase = queue[0]?.baseRevision !== null
      && queue[0]?.baseRevision !== undefined
      && Number.isFinite(firstBase);
    const hasRemoteRevision = remoteRevision !== null
      && remoteRevision !== undefined
      && Number.isFinite(Number(remoteRevision));

    /*
     * Every V58 outbox item is a complete snapshot, not a delta. If the server
     * revision is still exactly the revision from which this local queue began,
     * no queued V58 operation has been applied remotely. In that case all
     * intermediate snapshots are superseded by the latest one and can be
     * collapsed to a single atomic write. This is what makes recovery of a full
     * offline game fast while preserving optimistic concurrency.
     */
    const canCompact = queue.length > 1
      && hasFirstBase
      && hasRemoteRevision
      && Number(remoteRevision) === firstBase;
    const workQueue = canCompact ? [queue.at(-1)] : queue;

    let revision = canCompact
      ? Number(remoteRevision)
      : (hasFirstBase ? firstBase : (hasRemoteRevision ? Number(remoteRevision) : null));
    let lastResult = null;

    for (const originalItem of workQueue) {
      // Persist the effective revision before the request. If the response is
      // lost, retrying the same operation id remains idempotent and correctly
      // based on the revision reached by earlier acknowledged snapshots.
      const item = { ...originalItem, baseRevision: revision };
      await this.offlineStore.markAttempt(item);
      try {
        lastResult = await this.captureService.saveCapture({
          gameId: id,
          ...item.payload,
          clientOperationId: item.operationId,
          baseRevision: revision
        });
        const returned = Number(lastResult?.capture_revision);
        revision = Number.isFinite(returned)
          ? returned
          : (Number.isFinite(Number(revision)) ? Number(revision) + 1 : null);

        if (canCompact) {
          await this.offlineStore.clearOutbox(id);
        } else {
          await this.offlineStore.remove(item.operationId);
        }
      } catch (error) {
        await this.offlineStore.markAttempt(item, error);
        const pending = await this.offlineStore.pendingCount(id);
        return {
          synced: false,
          queued: true,
          pending,
          conflict: /GAME_CAPTURE_CONFLICT|conflict/i.test(String(error?.message || error)),
          revision,
          error
        };
      }
    }

    await this.offlineStore.clearDraft(id);
    try { this.storage?.removeItem(this._key(id)); } catch {}
    return {
      synced: true,
      queued: false,
      pending: 0,
      revision,
      result: lastResult,
      compactedSnapshots: canCompact ? queue.length : 0,
      error: null
    };
  }

  async recover(gameId) {
    const id = normalizeGameId(gameId);
    if (!id) return { draft: null, pending: [], remoteRevision: null };
    const [draft, pending, remoteRevision] = await Promise.all([
      this.offlineStore.loadDraft(id),
      this.offlineStore.list(id),
      this.getRevision(id).catch(() => null)
    ]);
    return { draft, pending, remoteRevision };
  }

  /**
   * Existing V38 API: stage one snapshot and try to flush immediately.
   */
  async sync(gameId, payload, { baseRevision = null } = {}) {
    const id = normalizeGameId(gameId);
    if (!id || !this.captureService?.saveCapture) {
      return { synced: false, queued: false, pending: 0, error: new Error("Live sync backend no disponible.") };
    }
    await this.stage(id, payload, { baseRevision });
    return this.flush(id);
  }
}

export default LiveCaptureSyncService;
