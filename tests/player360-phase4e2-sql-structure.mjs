import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(
  new URL("../supabase/ready/20260903_apply_v4_phase4e2_wellness.sql", import.meta.url),
  "utf8"
);
const rollback = readFileSync(
  new URL("../supabase/ready/20260903_rollback_v4_phase4e2_wellness.sql", import.meta.url),
  "utf8"
);
const preflight = readFileSync(
  new URL("../supabase/ready/20260903_preflight_v4_phase4e2_wellness_readonly.sql", import.meta.url),
  "utf8"
);
const verify = readFileSync(
  new URL("../supabase/ready/20260903_verify_v4_phase4e2_summary_readonly.sql", import.meta.url),
  "utf8"
);
const rehearsal = readFileSync(
  new URL("../supabase/drafts/20260903_rehearse_v4_phase4e2_wellness_rollback.sql", import.meta.url),
  "utf8"
);

const applyCommit = apply.lastIndexOf("\ncommit;\n");
const rehearsalSmoke = rehearsal.indexOf(
  "\n-- -----------------------------------------------------------------------------\n" +
  "-- Rehearsal functional smoke. All 4E.2 objects and rows roll back below."
);
assert.ok(applyCommit > 0, "Apply 4E.2 debe contener commit final.");
assert.ok(rehearsalSmoke > 0, "Rehearsal 4E.2 debe contener smoke funcional.");
assert.equal(
  rehearsal.slice(0,rehearsalSmoke).trimEnd(),
  apply.slice(0,applyCommit).trimEnd(),
  "El cuerpo ensayado 4E.2 debe ser idéntico al cuerpo que se aplicará."
);
assert.equal((rehearsal.match(/^\s*begin;\s*$/gmi) || []).length,1);
assert.equal((rehearsal.match(/^\s*commit;\s*$/gmi) || []).length,0);
assert.equal((rehearsal.match(/^\s*rollback;\s*$/gmi) || []).length,1);

for (const table of [
  "player360_wellness_metric_catalog",
  "player360_wellness_entries",
  "player360_wellness_observations"
]) {
  assert.match(apply, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  assert.match(apply, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(rollback, new RegExp(`drop table if exists public\\.${table}`, "i"));
}

for (const fn of [
  "iq_v4e2_wellness_capabilities",
  "iq_v4e2_list_wellness_metric_catalog",
  "iq_v4e2_list_wellness_entries",
  "iq_v4e2_save_manual_wellness_entry",
  "iq_v4e2_archive_wellness_entry"
]) {
  assert.match(apply, new RegExp(`create function public\\.${fn}\\s*\\(`, "i"));
  assert.match(rollback, new RegExp(`drop function if exists public\\.${fn}\\(`, "i"));
}

assert.match(
  apply,
  /source_type in \('PLAYER_SELF_REPORT','GUARDIAN_REPORT','STAFF_MANUAL'\)/i,
  "4E.2 solo debe aceptar orígenes manuales."
);
assert.doesNotMatch(
  apply,
  /source_type in \([^)]*(EXTERNAL|WEARABLE|IMPORT)/i,
  "La importación externa debe permanecer desactivada."
);
assert.match(apply, /'external_import_enabled', false/i);
assert.match(apply, /'ai_processing_enabled', false/i);

assert.match(
  apply,
  /iq_v3_player_eligible_on_date\([\s\S]*p_player_id,p_team_season_id,p_entry_date/i,
  "Los check-ins deben respetar el stint temporal."
);

for (const action of ["READ", "CREATE", "UPDATE"]) {
  assert.match(
    apply,
    new RegExp(`iq_v4e_can_access_sensitive_resource\\([\\s\\S]*?'${action}'`, "i"),
    `Falta control ABAC ${action}.`
  );
}

assert.doesNotMatch(
  apply,
  /iq_v4e_can_access_sensitive_resource\([\s\S]{0,250}'DELETE'/i,
  "Archivar debe ser una actualización lógica, no borrado sensible."
);
assert.match(
  apply,
  /set status='ARCHIVED'[\s\S]*archive_reason_code='USER_ARCHIVE'/i
);

assert.match(
  apply,
  /\(x - 'metric_code' - 'value'\) <> '\{\}'::jsonb/i,
  "El payload manual solo debe admitir metric_code y value."
);

const entryTable = apply.slice(
  apply.indexOf("create table public.player360_wellness_entries"),
  apply.indexOf("create index idx_player360_wellness_entry_scope")
);
const observationTable = apply.slice(
  apply.indexOf("create table public.player360_wellness_observations"),
  apply.indexOf("create unique index ux_player360_wellness_observation_metric")
);

for (const block of [entryTable, observationTable]) {
  assert.doesNotMatch(block, /\b(notes?|comments?|free_text|diagnosis|medication|weight|calories?)\b/i);
}

assert.match(
  observationTable,
  /num_nonnulls\(numeric_value,boolean_value,choice_value\)=1/i,
  "Cada observación debe contener un único valor tipado."
);

const expectedCodes = [
  "SLEEP_DURATION_HOURS",
  "SLEEP_QUALITY",
  "FATIGUE",
  "MUSCLE_SORENESS",
  "READINESS",
  "HYDRATION_ADHERENCE",
  "MEAL_REGULARITY",
  "PRE_TRAINING_FUELING",
  "POST_TRAINING_RECOVERY"
];
for (const code of expectedCodes) {
  assert.match(apply, new RegExp(`'${code}'`));
}

for (const prohibited of [
  "WEIGHT_KG",
  "BMI",
  "BODY_FAT_PCT",
  "CALORIE_INTAKE",
  "ENERGY_DEFICIT",
  "MENSTRUATION",
  "MEDICATION",
  "DIAGNOSIS",
  "CLINICAL_SYMPTOMS"
]) {
  const seedSection = apply.slice(
    apply.indexOf("-- 3. Seed product defaults"),
    apply.indexOf("-- 4. Read-only capabilities")
  );
  assert.doesNotMatch(seedSection, new RegExp(`'${prohibited}'`, "i"));
}

assert.match(
  apply,
  /revoke all on table[\s\S]*player360_wellness_observations[\s\S]*from public,anon,authenticated/i
);
assert.doesNotMatch(
  apply,
  /grant\s+(select|insert|update|delete)[\s\S]*player360_wellness_(entries|observations)/i
);
assert.match(verify, /prohibited_metrics_absent/i);
assert.match(verify, /no_sensitive_free_text_columns/i);
assert.match(verify, /anon_save_blocked/i);
assert.match(preflight, /phase4e2_preflight_ok/i);

const updateStart = apply.indexOf("if p_entry_id is null then");
const archiveStart = apply.indexOf("-- 7. Archive instead of physical delete");
const updateBlock = apply.slice(updateStart, archiveStart);
assert.doesNotMatch(
  updateBlock,
  /update public\.player360_wellness_entries[\s\S]*source_type=v_source_type/i,
  "Editar no debe alterar el origen del registro."
);

console.log("PLAYER360_PHASE4E2_SQL_STRUCTURE_OK");
