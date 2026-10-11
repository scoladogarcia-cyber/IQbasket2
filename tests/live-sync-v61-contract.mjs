import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LiveCaptureSyncService } from "../services/games/LiveCaptureSyncService.js";
import { isRemoteCapturePrefix } from "../services/games/LiveCaptureRecoveryPolicy.js";

class FakeOfflineStore {
  constructor(rows = []) {
    this.rows = rows.map(row => ({ ...row }));
    this.draft = null;
    this.clearOutboxCalls = 0;
    this.marked = [];
  }
  async enqueue(gameId, payload, { baseRevision = null, operationId = "op-" + (this.rows.length + 1) } = {}) {
    const row = {
      operationId,
      gameId,
      baseRevision,
      payload,
      attempts: 0,
      createdAt: String(this.rows.length + 1).padStart(4, "0")
    };
    this.rows.push(row);
    this.draft = { gameId, payload };
    return row;
  }
  async list(gameId) { return this.rows.filter(row => row.gameId === gameId); }
  async loadDraft() { return this.draft; }
  async saveDraft(gameId, payload) { this.draft = { gameId, payload }; return true; }
  async clearDraft() { this.draft = null; return true; }
  async pendingCount(gameId) { return (await this.list(gameId)).length; }
  async markAttempt(item, error = null) {
    const updated = { ...item, attempts: Number(item.attempts || 0) + 1, error: error ? String(error.message || error) : null };
    this.rows = this.rows.map(row => row.operationId === item.operationId ? updated : row);
    this.marked.push(updated);
    return updated;
  }
  async remove(operationId) {
    this.rows = this.rows.filter(row => row.operationId !== operationId);
    return true;
  }
  async clearOutbox(gameId) {
    this.clearOutboxCalls += 1;
    this.rows = this.rows.filter(row => row.gameId !== gameId);
    return true;
  }
}

const gameId = "c6e415ad-dc45-4583-8d2c-6154da85980f";
const periods = [
  { period_number:1, team_score:14, opponent_score:12, is_overtime:false },
  { period_number:2, team_score:12, opponent_score:19, is_overtime:false },
  { period_number:3, team_score:14, opponent_score:11, is_overtime:false },
  { period_number:4, team_score:14, opponent_score:29, is_overtime:false }
];

assert.equal(
  isRemoteCapturePrefix(
    { events:[{client_event_key:"e1"},{client_event_key:"e2"}] },
    { events:[{id:"e1"},{id:"e2"},{id:"e3"}] }
  ),
  true
);
assert.equal(
  isRemoteCapturePrefix(
    { events:[{client_event_key:"e1"},{client_event_key:"other"}] },
    { events:[{id:"e1"},{id:"e2"},{id:"e3"}] }
  ),
  false
);

// Fresh offline queue: no remote advance, so all complete snapshots collapse.
{
  const calls = [];
  const store = new FakeOfflineStore([
    { operationId:"op-1", gameId, baseRevision:0, payload:{ teamScore:2, opponentScore:4, events:[{id:"e1"}] }, attempts:1, createdAt:"0001" },
    { operationId:"op-2", gameId, baseRevision:0, payload:{ teamScore:40, opponentScore:50, events:[{id:"e1"},{id:"e2"}] }, attempts:0, createdAt:"0002" },
    { operationId:"op-3", gameId, baseRevision:0, payload:{ teamScore:54, opponentScore:71, events:[{id:"e1"},{id:"e2"},{id:"e3"}] }, attempts:0, createdAt:"0003" }
  ]);
  store.draft = { gameId, payload: store.rows.at(-1).payload };

  const service = new LiveCaptureSyncService({
    async getCaptureSyncStatus() { return { capture_revision: 0 }; },
    async saveCapture(args) {
      calls.push(args);
      return { capture_revision: 1 };
    }
  }, null, store);

  const result = await service.flush(gameId);
  assert.equal(result.synced, true);
  assert.equal(result.compactedSnapshots, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].clientOperationId, "op-3");
  assert.equal(calls[0].baseRevision, 0);
  assert.equal(store.clearOutboxCalls, 1);
  assert.equal(await store.pendingCount(gameId), 0);
}

// Remote advance without lineage proof is a conflict; it must not replay blindly.
{
  const calls = [];
  const store = new FakeOfflineStore([
    { operationId:"op-a", gameId, baseRevision:5, payload:{ teamScore:50 }, attempts:1, createdAt:"0001" },
    { operationId:"op-b", gameId, baseRevision:5, payload:{ teamScore:54 }, attempts:0, createdAt:"0002" }
  ]);
  store.draft = { gameId, payload: store.rows.at(-1).payload };

  const service = new LiveCaptureSyncService({
    async getCaptureSyncStatus() { return { capture_revision: 6 }; },
    async saveCapture(args) { calls.push(args); return { capture_revision: 7 }; }
  }, null, store);

  const result = await service.flush(gameId);
  assert.equal(result.synced, false);
  assert.equal(result.conflict, true);
  assert.equal(calls.length, 0);
}

// Partial server progress by the same actor + exact event prefix can rebase and
// send only the newest complete snapshot.
{
  const calls = [];
  const finalPayload = {
    teamScore:54,
    opponentScore:71,
    periods,
    events:[{id:"e1"},{id:"e2"},{id:"e3"}]
  };
  const store = new FakeOfflineStore([
    { operationId:"op-1", gameId, baseRevision:0, payload:{ teamScore:2, opponentScore:4, periods, events:[{id:"e1"}] }, attempts:1, createdAt:"0001" },
    { operationId:"op-2", gameId, baseRevision:0, payload:{ teamScore:4, opponentScore:4, periods, events:[{id:"e1"},{id:"e2"}] }, attempts:1, createdAt:"0002" },
    { operationId:"op-3", gameId, baseRevision:0, payload:finalPayload, attempts:0, createdAt:"0003" }
  ]);
  store.draft = { gameId, payload: finalPayload };

  const service = new LiveCaptureSyncService({
    async getCaptureSyncStatus() { return { capture_revision: 2 }; },
    async getSnapshot() {
      return {
        game:{team_score:4,opponent_score:4},
        periods:[{ period_number:1,team_score:4,opponent_score:4,is_overtime:false }],
        events:[{client_event_key:"e1"},{client_event_key:"e2"}]
      };
    },
    async getRecoveryRebaseStatus() { return { can_rebase:true }; },
    async saveCapture(args) {
      calls.push(args);
      return { capture_revision:3 };
    }
  }, null, store);

  const result = await service.flush(gameId);
  assert.equal(result.synced, true);
  assert.equal(result.rebased, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].clientOperationId, "op-3");
  assert.equal(calls[0].baseRevision, 2);
  assert.equal(store.clearOutboxCalls, 1);
}

// If the server already contains the exact final snapshot, recover() clears
// stale local bookkeeping without writing the game a second time.
{
  const finalPayload = {
    teamScore:54,
    opponentScore:71,
    periods,
    events:[{id:"e1"},{id:"e2"}]
  };
  const store = new FakeOfflineStore([
    { operationId:"op-1", gameId, baseRevision:0, payload:{ ...finalPayload, events:[{id:"e1"}] }, attempts:1, createdAt:"0001" },
    { operationId:"op-2", gameId, baseRevision:0, payload:finalPayload, attempts:1, createdAt:"0002" }
  ]);
  store.draft = { gameId, payload:finalPayload };

  const service = new LiveCaptureSyncService({
    async getCaptureSyncStatus() { return { capture_revision:27 }; },
    async getSnapshot() {
      return {
        game:{team_score:54,opponent_score:71},
        periods,
        events:[{client_event_key:"e1"},{client_event_key:"e2"}]
      };
    }
  }, null, store);

  const result = await service.recover(gameId);
  assert.equal(result.reconciled, true);
  assert.equal(result.pending.length, 0);
  assert.equal(store.clearOutboxCalls, 1);
  assert.equal(await store.pendingCount(gameId), 0);
}

const securityMigration = await readFile(
  new URL("../supabase/migrations/20261011122500_v61_live_capture_sync_security_hotfix.sql", import.meta.url),
  "utf8"
);
assert.match(securityMigration, /create or replace function public\.iq_v58_save_game_capture/i);
assert.match(securityMigration, /language sql\s+security definer\s+set search_path=''/i);
assert.doesNotMatch(securityMigration, /grant\s+usage\s+on\s+schema\s+iq_v58_private/i);

const rebaseMigration = await readFile(
  new URL("../supabase/migrations/20261011124000_v61_partial_live_recovery.sql", import.meta.url),
  "utf8"
);
assert.match(rebaseMigration, /iq_v61_game_capture_rebase_status/i);
assert.match(rebaseMigration, /v_owned=v_total/i);
assert.match(rebaseMigration, /OTHER_ACTOR_ADVANCED/i);

console.log("V61 live sync recovery: secure wrapper, compaction, reconciliation and safe rebase OK");
