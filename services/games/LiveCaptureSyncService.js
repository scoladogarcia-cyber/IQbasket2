/**
 * @fileoverview Resilient live-capture synchronization boundary.
 * @description V58 preserves the V38 draft contract and adds a durable IndexedDB
 * outbox, idempotent operation identifiers and optimistic revision checks.
 */

import { LiveOfflineStore } from "./LiveOfflineStore.js";
import { isRemoteCapturePrefix } from "./LiveCaptureRecoveryPolicy.js";

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

function exactRemoteMatchesLocal(remoteSnapshot = {}, localPayload = {}) {
  const remoteEvents = Array.isArray(remoteSnapshot?.events) ? remoteSnapshot.events : [];
  const localEvents = Array.isArray(localPayload?.events) ? localPayload.events : [];
  if (!remoteEvents.length || remoteEvents.length !== localEvents.length) return false;
  if (!isRemoteCapturePrefix(remoteSnapshot, localPayload)) return false;

  const game = remoteSnapshot?.game || {};
  if (Number(game.team_score) !== Number(localPayload?.teamScore)) return false;
  if (Number(game.opponent_score) !== Number(localPayload?.opponentScore)) return false;

  const remotePeriods = Array.isArray(remoteSnapshot?.periods) ? remoteSnapshot.periods : [];
  const localPeriods = Array.isArray(localPayload?.periods) ? localPayload.periods : [];
  if (remotePeriods.length !== localPeriods.length) return false;

  return localPeriods.every((localPeriod, index) => {
    const remotePeriod = remotePeriods[index] || {};
    return Number(remotePeriod.period_number) === Number(localPeriod.period_number)
      && Number(remotePeriod.team_score) === Number(localPeriod.team_score)
      && Number(remotePeriod.opponent_score) === Number(localPeriod.opponent_score)
      && Boolean(remotePeriod.is_overtime) === Boolean(localPeriod.is_overtime);
  });
}

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
    const draft = await this.offlineStore.loadDraft(id);
    if (!queue.length) {
      return { synced: !draft, queued: Boolean(draft), pending: draft ? 1 : 0, error: null };
    }

    const localPayload = draft?.payload || queue.at(-1)?.payload || null;
    const remoteRevision = await this.getRevision(id).catch(() => null);
    const firstBase = Number(queue[0]?.baseRevision);
    const hasFirstBase = queue[0]?.baseRevision !== null
      && queue[0]?.baseRevision !== undefined
      && Number.isFinite(firstBase);
    const hasRemoteRevision = remoteRevision !== null
      && remoteRevision !== undefined
      && Number.isFinite(Number(remoteRevision));

    let safeRebase = false;
    let remoteSnapshot = null;

    if (
      localPayload
      && hasFirstBase
      && hasRemoteRevision
      && Number(remoteRevision) !== firstBase
      && this.captureService?.getSnapshot
    ) {
      remoteSnapshot = await this.captureService.getSnapshot(id).catch(() => null);

      // A previous retry may already have persisted the exact final snapshot.
      // In that case the local queue is stale bookkeeping, not unsaved data.
      if (remoteSnapshot && exactRemoteMatchesLocal(remoteSnapshot, localPayload)) {
        await this.offlineStore.clearOutbox(id);
        await this.offlineStore.clearDraft(id);
        try { this.storage?.removeItem(this._key(id)); } catch {}
        return {
          synced: true,
          queued: false,
          pending: 0,
          revision: Number(remoteRevision),
          result: remoteSnapshot,
          reconciled: true,
          compactedSnapshots: queue.length,
          error: null
        };
      }

      if (remoteSnapshot && this.captureService?.getRecoveryRebaseStatus) {
        const rebase = await this.captureService
          .getRecoveryRebaseStatus(id, firstBase)
          .catch(() => null);
        safeRebase = Boolean(rebase?.can_rebase)
          && isRemoteCapturePrefix(remoteSnapshot, localPayload);
      }
    }

    /*
     * Every V58 item is a complete game snapshot. We may therefore collapse the
     * outbox to its newest snapshot when either the server is still at the queue
     * base revision or the server proves that every intervening revision belongs
     * to the same actor and its event log is an exact prefix of the local draft.
     */
    const canCollapse = hasFirstBase
      && hasRemoteRevision
      && (
        Number(remoteRevision) === firstBase
        || safeRebase
      );

    if (hasFirstBase && hasRemoteRevision && Number(remoteRevision) !== firstBase && !safeRebase) {
      return {
        synced: false,
        queued: true,
        pending: queue.length,
        conflict: true,
        revision: Number(remoteRevision),
        error: new Error("GAME_CAPTURE_CONFLICT: el servidor contiene cambios que no pueden atribuirse de forma segura a esta cola local.")
      };
    }

    const workQueue = canCollapse ? [queue.at(-1)] : queue;
    let revision = canCollapse
      ? Number(remoteRevision)
      : (hasFirstBase ? firstBase : (hasRemoteRevision ? Number(remoteRevision) : null));
    let lastResult = null;

    for (const originalItem of workQueue) {
      // Persist the effective revision before the request. If the response is
      // lost, retrying the same operation id remains idempotent.
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

        if (canCollapse) {
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
      compactedSnapshots: canCollapse && queue.length > 1 ? queue.length : 0,
      rebased: safeRebase,
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

    if (!pending.length || !draft?.payload) {
      return { draft, pending, remoteRevision, safeRebase: false, reconciled: false };
    }

    const firstBase = Number(pending[0]?.baseRevision);
    const hasFirstBase = pending[0]?.baseRevision !== null
      && pending[0]?.baseRevision !== undefined
      && Number.isFinite(firstBase);
    const hasRemoteRevision = remoteRevision !== null
      && remoteRevision !== undefined
      && Number.isFinite(Number(remoteRevision));

    if (
      !hasFirstBase
      || !hasRemoteRevision
      || Number(remoteRevision) === firstBase
      || !this.captureService?.getSnapshot
    ) {
      return { draft, pending, remoteRevision, safeRebase: false, reconciled: false };
    }

    const remoteSnapshot = await this.captureService.getSnapshot(id).catch(() => null);
    if (remoteSnapshot && exactRemoteMatchesLocal(remoteSnapshot, draft.payload)) {
      await this.offlineStore.clearOutbox(id);
      await this.offlineStore.clearDraft(id);
      try { this.storage?.removeItem(this._key(id)); } catch {}
      return {
        draft: null,
        pending: [],
        remoteRevision,
        safeRebase: false,
        reconciled: true,
        remoteSnapshot
      };
    }

    let safeRebase = false;
    if (remoteSnapshot && this.captureService?.getRecoveryRebaseStatus) {
      const rebase = await this.captureService
        .getRecoveryRebaseStatus(id, firstBase)
        .catch(() => null);
      safeRebase = Boolean(rebase?.can_rebase)
        && isRemoteCapturePrefix(remoteSnapshot, draft.payload);
    }

    return { draft, pending, remoteRevision, safeRebase, reconciled: false };
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
