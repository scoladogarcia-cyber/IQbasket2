import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20260906133707_game_capture_delegation_v1.sql","utf8");
const service=fs.readFileSync("services/games/GameCaptureDelegationService.js","utf8");
const workflow=fs.readFileSync(".github/workflows/game-capture-delegation-v1-controlled-apply.yml","utf8");
const preflight=fs.readFileSync("supabase/ready/20260906_preflight_game_capture_delegation_v1_readonly.sql","utf8");
const verify=fs.readFileSync("supabase/ready/20260906_verify_game_capture_delegation_v1_readonly.sql","utf8");
const rollback=fs.readFileSync("supabase/ready/20260906_rollback_game_capture_delegation_v1.sql","utf8");
const smoke=fs.readFileSync("supabase/drafts/20260906_smoke_game_capture_delegation_v1_installed_rollback.sql","utf8");
const release=JSON.parse(fs.readFileSync("release.json","utf8"));

assert.match(migration,/create table public\.game_capture_delegations/i);
assert.match(migration,/create table public\.game_capture_delegation_events/i);
assert.match(migration,/create table public\.game_capture_write_audit/i);
assert.match(migration,/enable row level security/i);
assert.match(migration,/revoke all on table public\.game_capture_delegations from public,anon,authenticated/i);
assert.match(migration,/create schema if not exists iq_v21_private/i);
assert.match(migration,/security definer[\s\S]*set search_path=''/i);
assert.match(migration,/public\.iq_v21_game_capture_snapshot\(p_game_id uuid\)[\s\S]*security invoker/i);
assert.match(migration,/public\.iq_v21_save_game_capture\([\s\S]*security invoker/i);
assert.match(migration,/iq_v21_private\.has_capability\(p_game_id,'PREPARE_GAME'\)/i);
assert.match(migration,/iq_v21_private\.has_capability\(p_game_id,'START_GAME'\)/i);
assert.match(migration,/iq_v21_private\.has_capability\(p_game_id,'FINISH_GAME'\)/i);
assert.doesNotMatch(migration,/has_capability\(p_game_id,'CANCEL_GAME'\)/i);
assert.doesNotMatch(migration,/capability in \([^)]*CANCEL_GAME/i);
assert.doesNotMatch(migration,/capability in \([^)]*LOCK_GAME/i);
assert.match(migration,/GAME_CAPTURE_SEASON_FROZEN/i);
assert.match(migration,/GAME_CAPTURE_GAME_LOCKED/i);
assert.match(migration,/game_capture_write_audit/i);
assert.match(migration,/v_period_number:=v_game\.periods_count\+v_period_number/i);

assert.doesNotMatch(service,/\.from\(/);
assert.match(service,/iq_v21_my_game_capture_delegations/);
assert.match(service,/iq_v21_game_capture_snapshot/);
assert.match(service,/iq_v21_save_game_capture/);
assert.match(service,/Permission\.RECORD_LIVE_GAME/);
assert.match(service,/Permission\.EDIT_BOXSCORE/);
assert.doesNotMatch(service,/Permission\.CANCEL_GAME/);
assert.doesNotMatch(service,/Permission\.LOCK_GAME/);

assert.match(preflight,/GAME_CAPTURE_DELEGATION_V1_PREFLIGHT/);
assert.match(verify,/GAME_CAPTURE_DELEGATION_V1_VERIFY/);
assert.match(verify,/not \(select prosecdef from pg_proc/i);
assert.match(rollback,/ROLLBACK_DELEGATION_DATA_PRESENT/);
assert.match(rollback,/drop schema if exists iq_v21_private cascade/i);
assert.match(smoke,/GAME_CAPTURE_DELEGATION_V1_INSTALLED_SMOKE_ROLLBACK/);
assert.match(smoke,/not iq_private\.game_play_state_actor_allowed\(v_game,'CANCELLED'\)/i);
assert.match(workflow,/20260906133707_game_capture_delegation_v1\.sql/);
assert.match(workflow,/Verify sporting row baseline unchanged/);
assert.match(workflow,/Emergency rollback if a fresh V21 apply fails validation/);

function releaseAtLeast(value,baseline){
  const left=String(value||"").split(".").map(Number);
  const right=String(baseline||"").split(".").map(Number);
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length;index+=1){
    const a=Number.isFinite(left[index])?left[index]:0;
    const b=Number.isFinite(right[index])?right[index]:0;
    if(a!==b)return a>b;
  }
  return true;
}

assert.ok(releaseAtLeast(release.release,"2026.09.06.7"),"La release no puede retroceder respecto a V21.");
if (release.release==="2026.09.06.7") assert.equal(release.label,"game-capture-delegation-v1");

console.log("GAME_CAPTURE_DELEGATION_V1_CONTRACT_OK");
