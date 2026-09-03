import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(
  new URL("../supabase/ready/20260903_apply_v5_game_locking.sql", import.meta.url),
  "utf8"
);
const rollback = readFileSync(
  new URL("../supabase/ready/20260903_rollback_v5_game_locking.sql", import.meta.url),
  "utf8"
);

assert.match(apply, /add column if not exists edit_state text not null default 'OPEN'/i);
assert.match(apply, /create table if not exists public\.game_lock_requests/i);
assert.match(apply, /create table if not exists public\.game_lock_history/i);
assert.match(apply, /create unique index if not exists ux_game_lock_requests_one_pending/i);
assert.match(apply, /create or replace function public\.iq_v5_can_manage_game_lock\(target_game_id uuid\)/i);
assert.match(apply, /array\['ADMIN'\]::text\[\]/i);
assert.match(apply, /array\['ENTRENADOR','ANALISTA'\]::text\[\]/i);
assert.match(
  apply,
  /create or replace function public\.iq_v3_can_edit_game[\s\S]*upper\(coalesce\(g\.edit_state, 'OPEN'\)\) = 'OPEN'/i
);
assert.match(
  apply,
  /create or replace function public\.iq_v3_can_delete_game[\s\S]*upper\(coalesce\(g\.edit_state, 'OPEN'\)\) = 'OPEN'/i
);
assert.match(apply, /raise exception 'GAME_LOCKED'/i);
assert.match(apply, /GAME_LOCK_STATE_CHANGE_MUST_BE_ISOLATED/i);
assert.match(apply, /trg_iq_v5_guard_game_lock_transition/i);
assert.match(apply, /iq_v5_request_game_lock/i);
assert.match(apply, /iq_v5_set_game_edit_state/i);
assert.match(apply, /iq_v5_resolve_game_lock_request/i);
assert.match(apply, /enable row level security/i);
assert.match(apply, /requested_by = auth\.uid\(\)/i);

assert.doesNotMatch(rollback, /drop table/i, "Rollback no debe borrar auditoría ni solicitudes.");
assert.doesNotMatch(rollback, /drop column/i, "Rollback no debe destruir columnas añadidas.");
assert.doesNotMatch(
  rollback,
  /iq_v3_can_edit_game[\s\S]*edit_state/i,
  "Rollback debe restaurar la semántica de edición previa."
);

console.log("GAME_LOCKING_SQL_OK");
