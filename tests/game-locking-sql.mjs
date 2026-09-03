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

assert.match(apply, /create or replace function public\.iq_v5_current_role\(\)/i);
assert.match(
  apply,
  /if coalesce\(v_role, 'INVITADO'\) = 'SUPERADMIN'[\s\S]*return 'INVITADO'/i,
  "La base debe reservar SUPERADMIN a la identidad maestra, incluso ante perfiles malformados."
);
assert.match(apply, /create or replace function public\.iq_v5_can_access_team\(target_team_id uuid\)/i);
assert.match(apply, /create or replace function public\.iq_v5_role_for_game\(target_game_id uuid\)/i);
assert.match(apply, /team_season_memberships[\s\S]*team_seasons/i);
assert.match(
  apply,
  /function_role[\s\S]*in \('ADMIN','ENTRENADOR','ANALISTA'\)/i,
  "SUPERADMIN no debe poder delegarse mediante una membresía de equipo-temporada."
);
assert.match(
  apply,
  /iq_v5_can_manage_game_lock[\s\S]*iq_v5_role_for_game[\s\S]*'SUPERADMIN','ADMIN'[\s\S]*iq_v5_can_access_team/i,
  "Cerrar/reabrir debe limitarse a Superadmin/Admin con acceso al equipo."
);
assert.match(
  apply,
  /iq_v5_can_request_game_lock[\s\S]*iq_v5_role_for_game[\s\S]*'ENTRENADOR','ANALISTA'[\s\S]*iq_v5_can_access_team/i,
  "Entrenador/Analista deben poder solicitar cierre sin poder ejecutarlo."
);

assert.match(apply, /raise exception 'GAME_LOCKED'/i);
assert.match(apply, /GAME_LOCK_STATE_CHANGE_MUST_BE_ISOLATED/i);
assert.match(apply, /trg_iq_v5_guard_game_lock_transition/i);
assert.match(apply, /trg_iq_v5_guard_locked_game_delete/i);
assert.match(apply, /iq_v5_guard_locked_game_child_write/i);
assert.match(apply, /'player_game_stats'[\s\S]*'team_game_stats'[\s\S]*'game_events'[\s\S]*'game_period_scores'[\s\S]*'lineup_game_stats'[\s\S]*'play_by_play_events'/i);

assert.match(apply, /as restrictive[\s\S]*for update[\s\S]*upper\(coalesce\(edit_state, 'OPEN'\)\) = 'OPEN'/i);
assert.match(apply, /open insert guard/i);
assert.match(apply, /open update guard/i);
assert.match(apply, /open delete guard/i);

assert.match(apply, /iq_v5_request_game_lock/i);
assert.match(apply, /iq_v5_set_game_edit_state/i);
assert.match(apply, /iq_v5_resolve_game_lock_request/i);
assert.match(apply, /enable row level security/i);
assert.match(apply, /requested_by = auth\.uid\(\)/i);

assert.doesNotMatch(rollback, /drop table/i, "Rollback no debe borrar auditoría ni solicitudes.");
assert.doesNotMatch(rollback, /drop column/i, "Rollback no debe destruir columnas añadidas.");
assert.match(rollback, /drop trigger if exists trg_iq_v5_guard_game_lock_transition/i);
assert.match(rollback, /trg_iq_v5_lock_/i);
assert.match(rollback, /v5 games open update guard/i);

console.log("GAME_LOCKING_SQL_OK");
