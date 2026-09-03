import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const apply = readFileSync(
  new URL("../supabase/ready/20260903_hotfix_v4e_superadmin_wellness_access.sql", import.meta.url),
  "utf8"
);
const rollback = readFileSync(
  new URL("../supabase/ready/20260903_rollback_hotfix_v4e_superadmin_wellness_access.sql", import.meta.url),
  "utf8"
);
const preflight = readFileSync(
  new URL("../supabase/ready/20260903_preflight_hotfix_v4e_superadmin_wellness_access.sql", import.meta.url),
  "utf8"
);
const verify = readFileSync(
  new URL("../supabase/ready/20260903_verify_hotfix_v4e_superadmin_wellness_access.sql", import.meta.url),
  "utf8"
);

const rosterGuard = apply.indexOf("from public.roster_memberships rm");
const override = apply.indexOf("SUPERADMIN_OPERATIONAL_WELLNESS_OVERRIDE_V1");
const processingGuard = apply.indexOf("iq_v4e_has_processing_authorization", override);

assert.ok(rosterGuard >= 0, "El scope roster debe seguir siendo obligatorio.");
assert.ok(override > rosterGuard, "El override SUPERADMIN no puede saltarse el scope roster.");
assert.ok(processingGuard > override, "El override operativo debe preceder solo al ABAC de tratamiento.");

const overrideStart = apply.indexOf("if public.iq_v3_is_global_superadmin()", override);
const overrideEnd = apply.indexOf("end if;", overrideStart);
const overrideBody = apply.slice(overrideStart, overrideEnd);

assert.match(overrideBody, /v_module in \('nutrition','recovery'\)/i);
assert.match(overrideBody, /v_action in \('READ','CREATE','UPDATE'\)/i);
assert.match(overrideBody, /v_purpose in \('SPORT_PERFORMANCE','OPERATIONS'\)/i);
assert.doesNotMatch(overrideBody, /EXPORT|AI_PROCESS|DELETE|neuro_cognitive/i);

assert.match(
  apply,
  /v_action in \('EXPORT','AI_PROCESS'\)[\s\S]*iq_v4e_has_sensitive_grant/i,
  "Exportación e IA deben seguir exigiendo grant explícito."
);
assert.match(
  apply,
  /v_module not in \('nutrition','recovery','neuro_cognitive'\)/i,
  "Neuro-Cognitive debe seguir existiendo únicamente en la ruta ABAC estricta."
);

assert.doesNotMatch(
  rollback,
  /SUPERADMIN_OPERATIONAL_WELLNESS_OVERRIDE_V1/i,
  "El rollback debe restaurar la política estricta previa."
);
assert.match(rollback, /iq_v4e_has_processing_authorization/i);
assert.match(preflight, /SUPERADMIN_WELLNESS_HOTFIX_PREFLIGHT/i);
assert.match(verify, /SUPERADMIN_WELLNESS_HOTFIX_VERIFY/i);
assert.match(verify, /EXPORT.*AI_PROCESS/is);

console.log("SUPERADMIN_WELLNESS_HOTFIX_SQL_OK");
