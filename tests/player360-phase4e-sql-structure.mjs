import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(
  new URL("../supabase/ready/20260903_apply_v4_phase4e_privacy_abac.sql", import.meta.url),
  "utf8"
);
const rollback = readFileSync(
  new URL("../supabase/ready/20260903_rollback_v4_phase4e_privacy_abac.sql", import.meta.url),
  "utf8"
);
const preflight = readFileSync(
  new URL("../supabase/ready/20260903_preflight_v4_phase4e_privacy_abac_readonly.sql", import.meta.url),
  "utf8"
);
const verify = readFileSync(
  new URL("../supabase/ready/20260903_verify_v4_phase4e_summary_readonly.sql", import.meta.url),
  "utf8"
);
const rehearsal = readFileSync(
  new URL("../supabase/drafts/20260903_rehearse_v4_phase4e_privacy_abac_rollback.sql", import.meta.url),
  "utf8"
);

const applyCommit = apply.lastIndexOf("\ncommit;\n");
const rehearsalSmoke = rehearsal.indexOf(
  "-- Rehearsal functional smoke. All rows and objects are rolled back below."
);
assert.ok(applyCommit > 0, "Apply 4E debe contener commit final.");
assert.ok(rehearsalSmoke > 0, "Rehearsal 4E debe contener el smoke funcional.");
assert.equal(
  rehearsal.slice(0, rehearsalSmoke).trimEnd(),
  apply.slice(0, applyCommit).trimEnd(),
  "El cuerpo ensayado debe ser idéntico al cuerpo que se aplicará."
);

for (const table of [
  "player360_subject_relationships",
  "player360_processing_authorizations",
  "player360_sensitive_access_requests",
  "player360_sensitive_access_grants",
  "player360_privacy_audit_log"
]) {
  assert.match(apply, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  assert.match(apply, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(rollback, new RegExp(`drop table if exists public\\.${table}`, "i"));
  assert.match(preflight, new RegExp(`public\\.${table}`, "i"));
}

for (const fn of [
  "iq_v4e_can_admin_privacy",
  "iq_v4e_can_request_sensitive_access",
  "iq_v4e_subject_relation",
  "iq_v4e_has_processing_authorization",
  "iq_v4e_has_sensitive_grant",
  "iq_v4e_user_has_player_context",
  "iq_v4e_can_access_sensitive_resource",
  "iq_v4e_record_subject_relationship",
  "iq_v4e_revoke_subject_relationship",
  "iq_v4e_record_processing_authorization",
  "iq_v4e_revoke_processing_authorization",
  "iq_v4e_request_sensitive_access",
  "iq_v4e_grant_sensitive_access",
  "iq_v4e_revoke_sensitive_access_grant",
  "iq_v4e_privacy_capabilities"
]) {
  assert.match(apply, new RegExp(`create function public\\.${fn}\\s*\\(`, "i"));
  assert.match(rollback, new RegExp(`drop function if exists public\\.${fn}\\(`, "i"));
}

assert.match(
  apply,
  /revoke all on table[\s\S]*player360_privacy_audit_log[\s\S]*from public, anon, authenticated/i,
  "Las tablas de gobierno 4E no deben tener acceso directo autenticado."
);
assert.doesNotMatch(
  apply,
  /grant\s+(select|insert|update|delete)[\s\S]*player360_(processing_authorizations|sensitive_access_grants|privacy_audit_log)/i,
  "4E.1 no debe conceder acceso directo a sus tablas."
);

for (const internal of [
  "iq_v4e_has_processing_authorization",
  "iq_v4e_has_sensitive_grant",
  "iq_v4e_user_has_player_context",
  "iq_v4e_log_privacy_event"
]) {
  assert.match(
    apply,
    new RegExp(`revoke all on function public\\.${internal}\\([\\s\\S]*?from public, anon, authenticated`, "i"),
    `${internal} debe permanecer interno.`
  );
}

const accessStart = apply.indexOf("create function public.iq_v4e_can_access_sensitive_resource");
const accessEnd = apply.indexOf("create function public.iq_v4e_log_privacy_event", accessStart);
const accessBody = apply.slice(accessStart, accessEnd);
assert.ok(accessStart >= 0 && accessEnd > accessStart);

assert.match(accessBody, /v_action in \('EXPORT','AI_PROCESS'\)/i);
assert.match(accessBody, /iq_v4e_has_sensitive_grant/i);
assert.match(accessBody, /v_relation = 'SELF'[\s\S]*PLAYER_SELF_SERVICE/i);
assert.match(accessBody, /v_relation = 'GUARDIAN'[\s\S]*FAMILY_SUPPORT/i);
assert.match(accessBody, /v_purpose not in \('SPORT_PERFORMANCE','OPERATIONS'\)/i);
assert.doesNotMatch(
  accessBody,
  /iq_v3_is_global_superadmin/i,
  "El helper de lectura sensible no puede incorporar un bypass SUPERADMIN."
);

assert.match(
  apply,
  /if p_user_id = auth\.uid\(\) then[\s\S]*PLAYER360_PRIVACY_SELF_GRANT_DENIED/i,
  "El auto-grant administrativo debe estar bloqueado."
);
assert.match(
  apply,
  /GUARDIAN_CONSENT[\s\S]*PLAYER360_PRIVACY_GUARDIAN_RELATION_REQUIRED/i,
  "El consentimiento de tutor debe exigir relación verificable."
);
assert.match(
  apply,
  /PLAYER360_PRIVACY_REQUEST_SCOPE_MISMATCH/i,
  "Una solicitud ajena no puede convertirse silenciosamente en grant."
);

assert.doesNotMatch(
  apply,
  /'RESEARCH'/i,
  "Research debe permanecer fuera del runtime 4E inicial."
);
assert.doesNotMatch(
  apply,
  /create table public\.(player360_)?(nutrition|recovery|neuro)/i,
  "4E no puede crear todavía tablas de datos wellness."
);

assert.match(verify, /processing_helper_private/i);
assert.match(verify, /anon_abac_blocked/i);
assert.match(verify, /phase4e_ok/i);
assert.match(preflight, /phase4e_preflight_ok/i);

console.log("PLAYER360_PHASE4E_SQL_STRUCTURE_OK");
