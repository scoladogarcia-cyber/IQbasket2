import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const apply = readFileSync(new URL("../supabase/ready/20260906_apply_player_development_loop_v2.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../supabase/ready/20260906_rollback_player_development_loop_v2.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../services/player360/DevelopmentCycleService.js", import.meta.url), "utf8");
const panel = readFileSync(new URL("../views/player360/DevelopmentCyclePanel.js", import.meta.url), "utf8");
const player360 = readFileSync(new URL("../views/Player360View.js", import.meta.url), "utf8");
const familyService = readFileSync(new URL("../services/family/FamilyWorkspaceService.js", import.meta.url), "utf8");
const familyView = readFileSync(new URL("../views/family/FamilyWorkspaceView.js", import.meta.url), "utf8");

for (const table of ["player_development_cycles", "player_development_actions", "player_development_action_evidence"]) {
  assert.match(apply, new RegExp(`create table public\\.${table}`, "i"));
  assert.match(apply, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(apply, new RegExp(`revoke all on table public\\.${table} from public,anon,authenticated`, "i"));
  assert.match(rollback, new RegExp(`drop table if exists public\\.${table}`, "i"));
}
assert.match(apply, /unique index player_development_cycle_player_week_uq[\s\S]*\(player_id,week_start\)/i);
assert.match(apply, /objective_profile_key uuid not null/i);
assert.match(apply, /objective_revision integer not null/i);
assert.match(apply, /evidence_snapshot jsonb not null/i);
assert.match(apply, /data_status,'ACTIVE'\)\)='ACTIVE'/i);
assert.match(apply, /iq_v4_can_manage_objective_profile\(p_team_season_id\)/i);
assert.match(apply, /training_session_id uuid null references public\.training_sessions/i);
assert.match(apply, /external_development_session_id uuid null references public\.external_development_sessions/i);
assert.match(apply, /game_id uuid null references public\.games/i);
assert.match(apply, /tp\.player_id=v_action\.player_id/i);
assert.match(apply, /pgs\.game_id=g\.id and pgs\.player_id=v_action\.player_id/i);
assert.match(apply, /DEVELOPMENT_CYCLE_ACTIONS_NOT_FINISHED/i);
assert.match(apply, /iq_saas_entitlement_check\([\s\S]*'DEVELOPMENT_PLAN'/i);

const familyStart = apply.indexOf("create or replace function public.iq_v16_family_development_cycle");
const familyEnd = apply.indexOf("do $development_verify$", familyStart);
const familyProjection = apply.slice(familyStart, familyEnd);
assert.doesNotMatch(familyProjection, /review_note|state_note|rpe|internal_load|wellness|nutrition/i);

assert.doesNotMatch(service, /\.from\(/);
for (const rpc of [
  "iq_v16_development_cycle_capabilities",
  "iq_v16_development_cycle_snapshot",
  "iq_v16_start_development_cycle",
  "iq_v16_set_development_action_state",
  "iq_v16_link_development_evidence",
  "iq_v16_review_development_cycle"
]) assert.match(service, new RegExp(rpc));
assert.match(panel, /Permission\.CREATE_DEVELOPMENT_CYCLE/);
assert.match(panel, /Permission\.EDIT_DEVELOPMENT_ACTION/);
assert.match(panel, /Permission\.LINK_DEVELOPMENT_EVIDENCE/);
assert.match(panel, /Permission\.REVIEW_DEVELOPMENT_CYCLE/);
assert.match(player360, /DevelopmentCyclePanel/);
assert.match(familyService, /iq_v16_family_development_cycle/);
assert.match(familyService, /DEVELOPMENT_CYCLE_NOT_READY/);
assert.match(familyView, /data-family-development-cycle/);

const mutations = [Permission.CREATE_DEVELOPMENT_CYCLE, Permission.EDIT_DEVELOPMENT_ACTION, Permission.LINK_DEVELOPMENT_EVIDENCE, Permission.REVIEW_DEVELOPMENT_CYCLE];
for (const role of [UserRole.ADMIN, UserRole.ENTRENADOR]) {
  assert.ok(ROLE_PERMISSIONS[role].includes(Permission.VIEW_DEVELOPMENT_CYCLE));
  for (const permission of mutations) assert.ok(ROLE_PERMISSIONS[role].includes(permission));
}
for (const role of [UserRole.ANALISTA, UserRole.PREPARADOR_FISICO, UserRole.VISOR, UserRole.INVITADO, UserRole.JUGADOR, UserRole.FAMILIA_TUTOR]) {
  assert.ok(ROLE_PERMISSIONS[role].includes(Permission.VIEW_DEVELOPMENT_CYCLE), `${role} must keep scoped read access`);
  for (const permission of mutations) assert.equal(ROLE_PERMISSIONS[role].includes(permission), false, `${role} must remain read-only for ${permission}`);
}

console.log("PLAYER_DEVELOPMENT_LOOP_V2_CONTRACT_OK");
