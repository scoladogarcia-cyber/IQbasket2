import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LiveCaptureSyncService } from "../services/games/LiveCaptureSyncService.js";

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

{
  const calls = [];
  const store = new FakeOfflineStore([
    { operationId:"op-1", gameId, baseRevision:0, payload:{ teamScore:2, events:[{id:"e1"}] }, attempts:1, createdAt:"0001" },
    { operationId:"op-2", gameId, baseRevision:0, payload:{ teamScore:40, events:[{id:"e1"},{id:"e2"}] }, attempts:0, createdAt:"0002" },
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
  assert.equal(calls[0].teamScore, 54);
  assert.equal(calls[0].opponentScore, 71);
  assert.equal(store.clearOutboxCalls, 1);
  assert.equal(await store.pendingCount(gameId), 0);
}

{
  const calls = [];
  const store = new FakeOfflineStore([
    { operationId:"op-a", gameId, baseRevision:5, payload:{ teamScore:50 }, attempts:1, createdAt:"0001" },
    { operationId:"op-b", gameId, baseRevision:5, payload:{ teamScore:54 }, attempts:0, createdAt:"0002" }
  ]);

  const service = new LiveCaptureSyncService({
    async getCaptureSyncStatus() { return { capture_revision: 6 }; },
    async saveCapture(args) {
      calls.push(args);
      return { capture_revision: args.clientOperationId === "op-a" ? 6 : 7 };
    }
  }, null, store);

  const result = await service.flush(gameId);
  assert.equal(result.synced, true);
  assert.equal(result.compactedSnapshots, 0);
  assert.deepEqual(calls.map(call => [call.clientOperationId, call.baseRevision]), [
    ["op-a", 5],
    ["op-b", 6]
  ]);
  assert.ok(store.marked.some(row => row.operationId === "op-b" && row.baseRevision === 6));
}

const migration = await readFile(new URL("../supabase/migrations/20261011122500_v61_live_capture_sync_security_hotfix.sql", import.meta.url), "utf8");
assert.match(migration, /create or replace function public\.iq_v58_save_game_capture/i);
assert.match(migration, /language sql\s+security definer\s+set search_path=''/i);
assert.match(migration, /revoke all on function public\.iq_v58_save_game_capture[\s\S]*from public, anon/i);
assert.match(migration, /grant execute on function public\.iq_v58_save_game_capture[\s\S]*to authenticated/i);
assert.doesNotMatch(migration, /grant\s+usage\s+on\s+schema\s+iq_v58_private/i);

console.log("V61 live sync hotfix: secure wrapper + full-snapshot compaction OK");
