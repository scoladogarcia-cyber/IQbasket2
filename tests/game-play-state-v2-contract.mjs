import fs from "node:fs";
import assert from "node:assert/strict";
import {
  GamePlayState,
  canTransitionGamePlayState,
  gameLifecycleComposite
} from "../domain/games/GamePlayStatePolicy.js";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const sql = fs.readFileSync("supabase/ready/20260905_apply_game_play_state_v2.sql", "utf8");
const rollback = fs.readFileSync("supabase/ready/20260905_rollback_game_play_state_v2.sql", "utf8");
const service = fs.readFileSync("services/games/GamePlayStateService.js", "utf8");
const ui = fs.readFileSync("features/game-state/GamePlayStateEnhancer.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.equal(canTransitionGamePlayState(GamePlayState.SCHEDULED, GamePlayState.READY), true);
assert.equal(canTransitionGamePlayState(GamePlayState.READY, GamePlayState.LIVE), true);
assert.equal(canTransitionGamePlayState(GamePlayState.LIVE, GamePlayState.FINISHED), true);
assert.equal(canTransitionGamePlayState(GamePlayState.FINISHED, GamePlayState.LIVE), false);
assert.equal(gameLifecycleComposite({ playState:"FINISHED", editState:"OPEN" }).canCorrect, true);
assert.equal(gameLifecycleComposite({ playState:"FINISHED", editState:"LOCKED" }).historical, true);
assert.equal(gameLifecycleComposite({ playState:"LIVE", editState:"OPEN" }).canCapture, true);

for (const permission of [Permission.PREPARE_GAME,Permission.START_GAME,Permission.FINISH_GAME,Permission.CANCEL_GAME]) assert(permission);
for (const role of [UserRole.ADMIN,UserRole.ENTRENADOR]) {
  for (const permission of [Permission.PREPARE_GAME,Permission.START_GAME,Permission.FINISH_GAME,Permission.CANCEL_GAME]) {
    assert(ROLE_PERMISSIONS[role].includes(permission), `${role} missing ${permission}`);
  }
}
for (const permission of [Permission.PREPARE_GAME,Permission.START_GAME,Permission.FINISH_GAME]) {
  assert(ROLE_PERMISSIONS[UserRole.ANALISTA].includes(permission));
}
assert(!ROLE_PERMISSIONS[UserRole.ANALISTA].includes(Permission.CANCEL_GAME));
assert(!ROLE_PERMISSIONS[UserRole.JUGADOR].includes(Permission.START_GAME));

assert.match(sql, /add column if not exists play_state text/i);
assert.match(sql, /create table public\.game_play_state_transitions/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /revoke all on table public\.game_play_state_transitions from public,anon,authenticated/i);
assert.match(sql, /security definer set search_path=''/i);
assert.match(sql, /iq_v13_set_game_play_state/);
assert.match(sql, /iq_v13_game_play_state_snapshot/);
assert.match(sql, /GAME_PLAY_STATE_ACTION_DENIED/);
assert.match(sql, /PREPARE_GAME/);
assert.match(sql, /START_GAME/);
assert.match(sql, /FINISH_GAME/);
assert.match(sql, /CANCEL_GAME/);

assert.match(sql, /game_legacy_status_for_play_state/);
assert.match(sql, /when 'SCHEDULED' then 'Programado'/);
assert.match(sql, /when 'LIVE' then 'En curso'/);
assert.match(sql, /when 'FINISHED' then 'Finalizado'/);
assert.match(sql, /GAME_PLAY_STATE_LEGACY_PROJECTION_MISMATCH/);

assert.match(sql, /disable trigger %I/);
assert.match(sql, /trg_iq_v5_guard_game_lock_transition/);
assert.match(sql, /trg_iq_v6_guard_frozen_team_season_game/);
assert.match(sql, /enable trigger %I/);
assert.match(sql, /GAME_PLAY_STATE_PREEXISTING_GUARD_LEFT_DISABLED/);

assert.match(sql, /new\.play_state in \('READY','LIVE'\)/);
assert.match(sql, /GAME_MUST_BE_FINISHED_BEFORE_LOCK/);

const snapshotStart = sql.indexOf("create or replace function public.iq_v13_game_play_state_snapshot");
const snapshotEnd = sql.indexOf("-- 6. Lock compatibility", snapshotStart);
const snapshotSql = sql.slice(snapshotStart, snapshotEnd);
assert(snapshotStart >= 0 && snapshotEnd > snapshotStart);
assert.doesNotMatch(snapshotSql, /'changed_by'/);

assert.match(service, /\.rpc\("iq_v13_set_game_play_state"/);
assert.match(service, /\.rpc\("iq_v13_game_play_state_snapshot"/);
assert.doesNotMatch(service, /\.from\(/);
assert.match(ui, /Permission\.PREPARE_GAME/);
assert.match(ui, /Permission\.START_GAME/);
assert.match(ui, /Permission\.FINISH_GAME/);
assert.match(ui, /Permission\.CANCEL_GAME/);
assert.match(ui, /dataset\.renderSignature/);
assert.match(ui, /requestAnimationFrame/);

assert.match(rollback, /GAME_PLAY_STATE_V2_ROLLBACK_REFUSED_AUDIT_EXISTS/);
assert.match(rollback, /drop trigger if exists trg_iq_v13_guard_lock_live_game/);

assert.match(html, /styles\/game-play-state-v2\.css/);
assert.match(html, /features\/game-state\/GamePlayStateEnhancer\.js/);

console.log("GAME_PLAY_STATE_V2_CONTRACT_OK");
