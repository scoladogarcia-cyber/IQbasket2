import assert from "node:assert/strict";
import fs from "node:fs";
import { GameLiveSessionService } from "../services/games/GameLiveSessionService.js";
import { GameCaptureDelegationService } from "../services/games/GameCaptureDelegationService.js";

const migration = fs.readFileSync("supabase/migrations/20260906215500_game_live_writer_lease_v1.sql", "utf8");
const preflight = fs.readFileSync("supabase/ready/20260906_preflight_game_live_writer_lease_v1_readonly.sql", "utf8");
const verify = fs.readFileSync("supabase/ready/20260906_verify_game_live_writer_lease_v1_readonly.sql", "utf8");
const rollback = fs.readFileSync("supabase/ready/20260906_rollback_game_live_writer_lease_v1.sql", "utf8");
const architecture = fs.readFileSync("docs/architecture/GAME_LIVE_WRITER_LEASE_V1.md", "utf8");
const liveService = fs.readFileSync("services/games/GameLiveSessionService.js", "utf8");
const captureService = fs.readFileSync("services/games/GameCaptureDelegationService.js", "utf8");
const controller = fs.readFileSync("features/game-live/LiveWriterLeaseController.js", "utf8");
const lazyRegistry = fs.readFileSync("services/LazyViewRegistry.js", "utf8");
const release = JSON.parse(fs.readFileSync("release.json", "utf8"));

// Architecture: lease, permission delegation and historical lock remain separate.
assert.match(architecture, /Tener permiso para capturar no implica poseer el turno de escritura en vivo/i);
assert.match(architecture, /90 segundos/i);
assert.match(architecture, /single-use/i);
assert.match(architecture, /edit_state/i);
assert.match(architecture, /play_state/i);

// Database hardening.
assert.match(migration, /create table if not exists public\.game_live_sessions/i);
assert.match(migration, /create table if not exists public\.game_live_session_events/i);
assert.match(migration, /create table if not exists public\.game_live_handoffs/i);
assert.match(migration, /alter table public\.game_live_sessions enable row level security/i);
assert.match(migration, /using\(false\) with check\(false\)/i);
assert.match(migration, /extensions\.digest\(coalesce\(p_token,''\),'sha256'\)/i);
assert.match(migration, /pg_advisory_xact_lock\(hashtext\(p_game_id::text\)\)/i);
assert.match(migration, /lease_expires_at>now\(\)/i);
assert.match(migration, /interval '90 seconds'/i);
assert.match(migration, /interval '2 minutes'/i);
assert.match(migration, /GAME_LIVE_LEASE_HELD/i);
assert.match(migration, /GAME_LIVE_HANDOFF_INVALID_OR_EXPIRED/i);
assert.match(migration, /GAME_LIVE_HANDOFF_SELF_NOT_ALLOWED/i);
assert.match(migration, /iq_v21_private\.has_capability\(p_game_id,'RECORD_LIVE_GAME'\)/i);
assert.match(migration, /iq_v21_private\.can_manage\(p_game_id\)/i);
assert.match(migration, /upper\(coalesce\(g\.edit_state,'OPEN'\)\)='OPEN'/i);
assert.match(migration, /v_state<>'LIVE' then return/i);
assert.match(migration, /create or replace function public\.iq_v28_save_game_capture/i);
assert.match(migration, /security invoker/i);
assert.match(migration, /revoke all on function public\.iq_v21_save_game_capture[\s\S]*from public,anon,authenticated/i);
assert.match(migration, /revoke all on function iq_v21_private\.save_capture[\s\S]*from authenticated/i);

// No raw lease/handoff token is persisted in table columns.
const schemaPrefix = migration.slice(0, migration.indexOf("create schema if not exists iq_v28_private"));
assert.doesNotMatch(schemaPrefix, /lease_token\s+text/i);
assert.doesNotMatch(schemaPrefix, /handoff_token\s+text/i);
assert.match(schemaPrefix, /lease_token_hash text not null/i);
assert.match(schemaPrefix, /token_hash text not null unique/i);

// Operations and rollback contract.
assert.match(preflight, /extensions\.digest\(text,text\)/i);
assert.match(verify, /v21_public_bypass_closed/i);
assert.match(verify, /sessions_rls_enabled/i);
assert.match(rollback, /ROLLBACK_REFUSED_AUDIT_EXISTS/i);
assert.match(rollback, /grant execute on function public\.iq_v21_save_game_capture/i);

// Client rollout safety: fallback only when V28 RPC itself is absent.
assert.match(captureService, /isMissingRpc\(v28Result\.error,v28Rpc\)/);
assert.match(captureService, /iq_v21_save_game_capture/);
assert.match(captureService, /p_lease_token: token/);
assert.match(liveService, /sessionStorage/);
assert.match(liveService, /iq_v28_acquire_game_live_session/);
assert.match(liveService, /iq_v28_heartbeat_game_live_session/);
assert.match(liveService, /iq_v28_create_game_live_handoff/);
assert.match(liveService, /iq_v28_accept_game_live_handoff/);

// UI is progressively attached without adding concurrency logic to the HUD.
assert.match(controller, /WRITER_CONTROL_SELECTOR/);
assert.match(controller, /_setWriterControlsEnabled\(false\)/);
assert.match(controller, /30_000/);
assert.match(controller, /Transferir captura/);
assert.match(controller, /Aceptar traspaso/);
assert.match(controller, /attachLiveWriterLease/);
assert.match(lazyRegistry, /LiveWriterLeaseController\.js/);
assert.match(lazyRegistry, /attachLiveWriterLease\(view/);

const gameId = "11111111-1111-4111-8111-111111111111";
const calls = [];
const rpcMock = {
  async rpc(name, args) {
    calls.push({ name, args });
    if (name === "iq_v28_game_live_session_status") {
      return { data: { active: false }, error: null };
    }
    if (name === "iq_v28_acquire_game_live_session") {
      return {
        data: {
          active: true,
          is_mine: true,
          lease_token: "lease-token-test",
          lease_expires_at: new Date(Date.now() + 90_000).toISOString()
        },
        error: null
      };
    }
    throw new Error(`unexpected rpc ${name}`);
  }
};
const service = new GameLiveSessionService(rpcMock);
const status = await service.getStatus(gameId);
assert.equal(status.supported, true);
assert.equal(status.active, false);
const acquired = await service.acquire({ gameId });
assert.equal(acquired.supported, true);
assert.equal(acquired.lease_token, "lease-token-test");
assert.deepEqual(calls.map(call => call.name), [
  "iq_v28_game_live_session_status",
  "iq_v28_acquire_game_live_session"
]);

const fallbackCalls = [];
const fallbackRpc = {
  async rpc(name, args) {
    fallbackCalls.push({ name, args });
    if (name === "iq_v28_save_game_capture") {
      return { data: null, error: { code: "PGRST202", message: "Could not find iq_v28_save_game_capture" } };
    }
    if (name === "iq_v21_save_game_capture") return { data: { game: { id: gameId } }, error: null };
    throw new Error(`unexpected rpc ${name}`);
  }
};
const captureFallback = new GameCaptureDelegationService(fallbackRpc);
await captureFallback.saveCapture({ gameId, teamScore: 40, opponentScore: 38 });
assert.deepEqual(fallbackCalls.map(call => call.name), [
  "iq_v28_save_game_capture",
  "iq_v21_save_game_capture"
]);

const deniedCalls = [];
const deniedRpc = {
  async rpc(name) {
    deniedCalls.push(name);
    if (name === "iq_v28_save_game_capture") {
      return { data: null, error: { code: "42501", message: "GAME_LIVE_LEASE_REQUIRED" } };
    }
    throw new Error("V21 fallback must never execute for a V28 authorization error");
  }
};
const captureDenied = new GameCaptureDelegationService(deniedRpc);
await assert.rejects(
  () => captureDenied.saveCapture({ gameId, teamScore: 40 }),
  /turno de escritura/i
);
assert.deepEqual(deniedCalls, ["iq_v28_save_game_capture"]);

const version = release.release.split(".").map(Number);
const baseline = "2026.09.06.14".split(".").map(Number);
const compare = (a, b) => {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};
assert.ok(compare(version, baseline) >= 0, "La release V28 no puede retroceder.");
if (release.release === "2026.09.06.14") {
  assert.equal(release.label, "game-live-writer-lease-v1-v28");
}

console.log("GAME_LIVE_WRITER_LEASE_V1_V28_OK");
