import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LiveWriterLeaseV43Controller } from "../features/game-live/LiveWriterLeaseV43Controller.js";
import { LiveCaptureSyncService } from "../services/games/LiveCaptureSyncService.js";

const gameId = "11111111-1111-4111-8111-111111111111";

// Two simultaneous HUD renders must share a single lease-acquisition flow.
{
  const controller = new LiveWriterLeaseV43Controller({});
  let statusCalls = 0;
  let acquireCalls = 0;
  let activated = 0;
  controller._isHudVisible = () => true;
  controller._setWriterControlsEnabled = () => {};
  controller._renderLoading = () => {};
  controller._activateOwnedLease = () => { activated += 1; };
  controller.service = {
    async getStatus() { statusCalls++; return {supported:true,active:false}; },
    getStoredToken() { return null; },
    async acquire() { acquireCalls++; return {supported:true,active:true,is_mine:true}; }
  };
  const container = {};
  const a = controller.syncAfterRender(container, gameId);
  const b = controller.syncAfterRender(container, gameId);
  await Promise.all([a,b]);
  assert.equal(statusCalls, 2, "One check flow: initial status and refresh");
  assert.equal(acquireCalls, 1, "Acquisition must never race between HUD renders");
  assert.equal(activated, 1);
}

// Recovery rotates tokens; double-clicking must never rotate twice.
{
  const controller = new LiveWriterLeaseV43Controller({});
  controller.gameId = gameId;
  controller._setWriterControlsEnabled = () => {};
  controller._renderLoading = () => {};
  controller._activateOwnedLease = () => {};
  let recoverCalls = 0;
  controller.service = {
    async recoverOwn() { recoverCalls++; return {recovered:true}; }
  };
  await Promise.all([controller._recoverOwn(),controller._recoverOwn()]);
  assert.equal(recoverCalls,1);
}

class Offline {
  constructor() { this.queue=[]; this.draft=null; this.seq=0; this.clearAllCalls=0; }
  async enqueue(id,payload,{baseRevision=null}={}) {
    const row={gameId:id,operationId:`op-${++this.seq}`,baseRevision,payload,createdAt:String(this.seq)};
    this.queue.push(row);
    this.draft={gameId:id,payload,operationId:row.operationId};
    return row;
  }
  async saveDraft(id,payload) { this.draft={gameId:id,payload}; }
  async loadDraft() { return this.draft; }
  async list(id) { return this.queue.filter(v=>v.gameId===id).map(v=>({...v})); }
  async pendingCount(id) { return (await this.list(id)).length; }
  async markAttempt(item) { return item; }
  async remove(op) { this.queue=this.queue.filter(v=>v.operationId!==op); return true; }
  async clearDraft() { this.draft=null; return true; }
  async clearOutbox() { this.clearAllCalls++; this.queue=[]; }
}

// If the operator taps again while the last full snapshot is in flight,
// the newly queued event must survive and be sent with the correct revision.
{
  const store=new Offline();
  const oldPayload={teamScore:2,opponentScore:0,events:[{id:"e1"}]};
  const newPayload={teamScore:4,opponentScore:0,events:[{id:"e1"},{id:"e2"}]};
  await store.enqueue(gameId,oldPayload,{baseRevision:0});
  let finishFirst;
  let enterFirst;
  const firstReached=new Promise(resolve=>enterFirst=resolve);
  const firstGate=new Promise(resolve=>finishFirst=resolve);
  let revision=0;
  const calls=[];
  const service=new LiveCaptureSyncService({
    async getCaptureSyncStatus() {return {capture_revision:revision};},
    async saveCapture(args) {
      calls.push(args);
      if(calls.length===1){enterFirst();await firstGate;}
      revision+=1;
      return {capture_revision:revision};
    },
    async getSnapshot() {
      return {game:{team_score:2,opponent_score:0},events:[{client_event_key:"e1"}],periods:[]};
    },
    async getRecoveryRebaseStatus() {return {can_rebase:true};}
  },null,store);
  const first=service.flush(gameId);
  await firstReached;
  await service.stage(gameId,newPayload,{baseRevision:0});
  const parallel=service.flush(gameId);
  finishFirst();
  const [result,duplicate]=await Promise.all([first,parallel]);
  assert.equal(calls.length,1,"No parallel writes of the same game");
  assert.equal(result.pending,1,"A late action remains queued");
  assert.equal(duplicate.pending,1);
  assert.equal(store.draft.payload.teamScore,4);
  assert.equal(store.clearAllCalls,0,"Do not discard the concurrent snapshot");
  const second=await service.flush(gameId);
  assert.equal(second.synced,true);
  assert.equal(second.pending,0);
  assert.equal(calls.length,2);
  assert.equal(calls[1].teamScore,4);
}

// The scorer waits for an owned server-authoritative lease; never disable RBAC.
const hud=readFileSync(new URL("../views/LiveScoreHUDViewV58.js",import.meta.url),"utf8");
assert.match(hud,/writer\.ownsLease/);
assert.match(hud,/waitingForLease:true/);
assert.match(hud,/offlineStore\.pendingCount/);
const lease=readFileSync(new URL("../features/game-live/LiveWriterLeaseV43Controller.js",import.meta.url),"utf8");
assert.match(lease,/controller\.onLeaseReady/);

console.log("V69 live lease/sync race: one acquisition, one recovery, no lost in-flight actions OK");
