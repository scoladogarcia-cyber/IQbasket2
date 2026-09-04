import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../supabase/ready/20260904_apply_v7_account_status_foundation.sql", import.meta.url),
  "utf8"
);

for (const fragment of [
  "create table if not exists public.user_account_controls",
  "create table if not exists public.user_account_status_history",
  "account_status in ('ACTIVE','SUSPENDED','DISABLED','PENDING_ACTIVATION')",
  "create or replace function public.iq_account_is_active()",
  "create or replace function public.iq_account_is_active_for_user(p_user_id uuid)",
  "create or replace function public.iq_current_account_state()",
  "create or replace function public.iq_admin_set_account_status(",
  "ACCOUNT_STATUS_MASTER_PROTECTED",
  "create policy iq_account_active_guard",
  "as restrictive for all to authenticated",
  "create policy iq_v7_active_legacy_compat",
  "create policy iq_v7_account_boundary",
  "alter table public.translations enable row level security",
  "create or replace function public.iq_require_active_account_for_write()",
  "create trigger iq_account_active_write_guard",
  "create trigger iq_seed_account_control_after_profile_insert",
  "public.iq_account_is_active_for_user(p_user_id)",
  "AI_USAGE_ACCOUNT_NOT_ACTIVE",
  "ACCOUNT_CONTROL_BACKFILL_MISMATCH",
  "create or replace function public.handle_new_user_profiles()",
  "create policy iq_v7_user_profiles_select_active",
  "create policy iq_v7_user_profiles_update_safe",
  "create trigger iq_v7_guard_user_profile_update",
  "PROFILE_SECURITY_FIELDS_READ_ONLY",
  "create or replace function public.iq_v7_assign_user_role",
  "ROLE_ASSIGNMENT_SUPERADMIN_DENIED",
  "create or replace function public.iq_v7_set_user_team_assignments",
  "TEAM_ASSIGNMENT_SCOPE_DENIED"
]) {
  assert.ok(sql.includes(fragment), `Falta contrato SQL de seguridad: ${fragment}`);
}

assert.doesNotMatch(
  sql,
  /alter\s+table\s+public\.user_profiles\s+add\s+column\s+account_status/i,
  "El estado de cuenta no debe mezclarse con user_profiles.status."
);


assert.doesNotMatch(
  sql,
  /raw_user_meta_data->>['"]role['"]/i,
  "El trigger de alta no puede confiar en el rol enviado por metadata del cliente."
);

assert.match(
  sql,
  /relname not in \('translations','user_profiles'\)/,
  "user_profiles debe quedar fuera de la policy legacy amplia y usar policies específicas."
);
assert.match(
  sql,
  /insert into public\.user_account_controls\(user_id, account_status, status_reason\)[\s\S]*?select up\.id, 'ACTIVE'/,
  "La migración debe conservar acceso de usuarios existentes mediante backfill ACTIVE."
);

assert.match(
  sql,
  /where n\.nspname = 'public'[\s\S]*?c\.relrowsecurity = true[\s\S]*?create policy iq_account_active_guard/,
  "El gate de cuenta debe reforzar todas las tablas públicas que ya tienen RLS."
);

assert.match(
  sql,
  /c\.relrowsecurity = false[\s\S]*?iq_v7_active_legacy_compat[\s\S]*?iq_v7_account_boundary/,
  "Las tablas legacy deben activar RLS con compatibilidad para cuentas activas y boundary restrictivo."
);

assert.match(
  sql,
  /drop policy if exists \"Escritura de traducciones\"[\s\S]*?iq_v7_active_translation_write/,
  "Las traducciones deben conservar lectura pública y exigir cuenta activa para escritura."
);

for (const helper of [
  "iq_v3_is_global_superadmin",
  "iq_v3_can_read_team_season",
  "iq_v3_can_manage_team_season",
  "iq_v3_can_manage_roster",
  "iq_v4_has_player360_action_role",
  "iq_v4_can_view_player360_team_season",
  "iq_v4e_can_access_sensitive_resource",
  "iq_v5_current_role",
  "iq_v5_can_access_team",
  "iq_v5_role_for_game",
  "iq_v6_role_for_team_season"
]) {
  const start = sql.indexOf(`function public.${helper}`);
  assert.ok(start >= 0, `Debe redefinirse ${helper}`);
  const chunk = sql.slice(start, start + 7000);
  assert.ok(
    chunk.includes("iq_account_is_active"),
    `${helper} debe depender del estado activo de cuenta.`
  );
}

console.log(JSON.stringify({
  separateSecurityTable: true,
  restrictiveRlsGuard: true,
  legacyReadWriteBoundary: true,
  legacyWriteGuard: true,
  centralHelpersHardened: true,
  aiMeteringHardened: true,
  result: "PASS"
}));
console.log("ACCOUNT_STATUS_SQL_OK");
