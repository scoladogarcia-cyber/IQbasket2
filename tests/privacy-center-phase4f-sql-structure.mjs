import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(
  new URL("../supabase/ready/20260904_apply_v4_phase4f_privacy_center.sql", import.meta.url),
  "utf8"
);
const rollback = readFileSync(
  new URL("../supabase/ready/20260904_rollback_v4_phase4f_privacy_center.sql", import.meta.url),
  "utf8"
);
const preflight = readFileSync(
  new URL("../supabase/ready/20260904_preflight_v4_phase4f_privacy_center_readonly.sql", import.meta.url),
  "utf8"
);
const verify = readFileSync(
  new URL("../supabase/ready/20260904_verify_v4_phase4f_privacy_center_readonly.sql", import.meta.url),
  "utf8"
);
const requestReview = readFileSync(
  new URL("../supabase/ready/20260904_apply_v4_phase4f_privacy_center_request_review.sql", import.meta.url),
  "utf8"
);
const requestReviewRollback = readFileSync(
  new URL("../supabase/ready/20260904_rollback_v4_phase4f_privacy_center_request_review.sql", import.meta.url),
  "utf8"
);

const functions = [
  "iq_v4f_privacy_center_snapshot",
  "iq_v4f_list_privacy_authorizations",
  "iq_v4f_list_sensitive_access",
  "iq_v4f_list_privacy_audit"
];

for (const fn of functions) {
  assert.match(apply, new RegExp(`create function public\\.${fn}\\s*\\(`, "i"));
  assert.match(rollback, new RegExp(`drop function if exists public\\.${fn}\\(`, "i"));
}

assert.doesNotMatch(apply, /create\s+table/i, "4F no debe crear nuevas tablas.");
assert.doesNotMatch(
  apply,
  /grant\s+select\s+on\s+(table\s+)?public\.player360_/i,
  "Privacy Center no puede abrir SELECT directo sobre tablas privadas."
);

for (const marker of [
  "AUTH_REQUIRED",
  "PRIVACY_CENTER_ADMIN_DENIED",
  "PRIVACY_CENTER_PLAYER_SCOPE_INVALID"
]) {
  assert.match(apply, new RegExp(marker));
}

assert.ok(
  (apply.match(/iq_v4e_can_admin_privacy\(p_team_season_id\)/g) || []).length >= 4,
  "Cada RPC público debe revalidar la capacidad administrativa en backend."
);
assert.ok(
  (apply.match(/security definer/gi) || []).length >= 4,
  "Los RPC deben encapsular lectura mediante SECURITY DEFINER."
);
assert.ok(
  (apply.match(/set search_path = ''/gi) || []).length >= 4,
  "Los RPC SECURITY DEFINER deben fijar search_path vacío."
);
assert.ok(
  (apply.match(/grant execute on function public\.iq_v4f_/gi) || []).length === 4,
  "Sólo deben publicarse los cuatro RPC de lectura."
);
assert.ok(
  (apply.match(/to authenticated/gi) || []).length === 4,
  "Los RPC de lectura sólo se conceden a authenticated."
);
assert.match(preflight, /PRIVACY_CENTER_V1_PREFLIGHT/);
assert.match(preflight, /preflight_ok/);
assert.match(verify, /PRIVACY_CENTER_V1_VERIFY/);
assert.match(verify, /anon_snapshot_blocked/);
assert.match(verify, /verify_ok/);
assert.match(verify, /reject_request_ok/);
assert.match(verify, /authenticated_reject_execute/);
assert.match(verify, /anon_reject_blocked/);

assert.match(requestReview, /create function public\.iq_v4f_reject_sensitive_access_request\s*\(/i);
assert.match(requestReviewRollback, /drop function if exists public\.iq_v4f_reject_sensitive_access_request\s*\(/i);
assert.match(requestReview, /AUTH_REQUIRED/);
assert.match(requestReview, /iq_v4e_can_admin_privacy\(v_row\.team_season_id\)/);
assert.match(requestReview, /security definer/i);
assert.match(requestReview, /set search_path = ''/i);
assert.doesNotMatch(requestReview, /grant\s+(select|insert|update|delete)\s+on\s+(table\s+)?public\.player360_/i);
assert.match(requestReview, /revoke all on function public\.iq_v4f_reject_sensitive_access_request\(uuid,text\)[\s\S]*from public, anon, authenticated/i);
assert.match(requestReview, /grant execute on function public\.iq_v4f_reject_sensitive_access_request\(uuid,text\)[\s\S]*to authenticated/i);

console.log("PRIVACY_CENTER_PHASE4F_SQL_STRUCTURE_OK");
