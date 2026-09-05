import fs from "node:fs";
import assert from "node:assert/strict";
import { FAMILY_PILOT_CONFIG } from "../config/family-pilot.config.js";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const grantsSql = fs.readFileSync("supabase/ready/20260905_apply_saas_scoped_entitlement_grants_v1.sql", "utf8");
const pilotSql = fs.readFileSync("supabase/ready/20260905_apply_family_pilot_cohort_v1.sql", "utf8");
const indexSql = fs.readFileSync("supabase/ready/20260905_apply_family_pilot_fk_indexes_v1.sql", "utf8");
const rollbackSql = fs.readFileSync("supabase/ready/20260905_rollback_family_pilot_cohort_v1.sql", "utf8");
const service = fs.readFileSync("services/family/FamilyPilotService.js", "utf8");
const view = fs.readFileSync("views/admin/BusinessMetricsView.js", "utf8");
const lazy = fs.readFileSync("services/LazyViewRegistry.js", "utf8");

const functionBody = (sql, signature) => {
  const start = sql.indexOf(signature);
  assert(start >= 0, `Function missing: ${signature}`);
  const bodyStart = sql.indexOf("as $function$", start);
  const end = sql.indexOf("$function$;", bodyStart + 1);
  assert(bodyStart >= 0 && end > bodyStart, `Function body malformed: ${signature}`);
  return sql.slice(bodyStart, end);
};

// Product experiment is deliberately long enough for repeated basketball cycles,
// but bounded so it cannot become an accidental permanent premium tier.
assert.equal(FAMILY_PILOT_CONFIG.pilotCode, "FAMILY_VALUE_V1");
assert.equal(FAMILY_PILOT_CONFIG.defaultTrialDays, 28);
assert.deepEqual(FAMILY_PILOT_CONFIG.allowedTrialDays, [7, 14, 28, 42, 56]);
assert.equal(FAMILY_PILOT_CONFIG.includesAi, false);
assert.equal(FAMILY_PILOT_CONFIG.includesSensitiveModules, false);
assert(!FAMILY_PILOT_CONFIG.entitlementCodes.includes("AI_INSIGHTS"));
assert(!FAMILY_PILOT_CONFIG.entitlementCodes.includes("AI_WEEKLY_PLAN"));
assert(!FAMILY_PILOT_CONFIG.entitlementCodes.includes("WELLNESS"));
assert(!FAMILY_PILOT_CONFIG.entitlementCodes.includes("NUTRITION_RECOVERY"));

// Reusable SaaS foundation: no browser table access, exact resource scope and
// existing subscription + sports access remain mandatory.
assert.match(grantsSql, /create table public\.saas_entitlement_grants/i);
assert.match(grantsSql, /subject_type in \('PLAYER','TEAM','CLUB'\)/i);
assert.match(grantsSql, /alter table public\.saas_entitlement_grants enable row level security/i);
assert.match(grantsSql, /revoke all on table public\.saas_entitlement_grants from public,anon,authenticated/i);
assert.match(grantsSql, /iq_private\.saas_user_can_access_subject/i);
assert.match(grantsSql, /iq_private\.saas_subscription_effective/i);
assert.match(grantsSql, /iq_private\.saas_subject_covers/i);
assert.match(grantsSql, /ACCOUNT_OVERRIDE/);
assert.match(grantsSql, /SCOPED_GRANT/);

// PostgreSQL reserves GRANT as a keyword. Keep the lateral table alias explicit
// and safe so static contracts catch this production-blocking parser regression.
assert.doesNotMatch(grantsSql, /from\s+public\.saas_entitlement_grants\s+grant\b/i);
assert.match(grantsSql, /from\s+public\.saas_entitlement_grants\s+sg\b/i);
assert.match(grantsSql, /sg\.player_id=p_subject_id/);
assert.match(grantsSql, /sg\.team_id=p_subject_id/);
assert.match(grantsSql, /sg\.club_id=p_subject_id/);

assert.match(grantsSql, /SAAS_SCOPED_GRANTS_DIRECT_CLIENT_ACCESS_OPEN/);
assert.match(grantsSql, /SAAS_SCOPED_GRANTS_RESOLVER_EXPOSED/);

// Foreign-key coverage is explicit so the new SaaS primitives do not add fresh
// unindexed-FK findings to the production performance baseline.
for (const indexName of [
  "saas_entitlement_grants_entitlement_code_fk_idx",
  "saas_entitlement_grants_player_id_fk_idx",
  "saas_entitlement_grants_team_id_fk_idx",
  "saas_entitlement_grants_club_id_fk_idx",
  "saas_entitlement_grants_created_by_fk_idx",
  "saas_entitlement_grants_revoked_by_fk_idx",
  "saas_family_pilot_billing_account_fk_idx",
  "saas_family_pilot_created_by_fk_idx",
  "saas_family_pilot_revoked_by_fk_idx"
]) {
  assert(indexSql.includes(indexName), `Missing FK coverage index: ${indexName}`);
}
assert.match(indexSql, /FAMILY_PILOT_FK_INDEX_PREREQUISITES_MISSING/);
assert.doesNotMatch(indexSql, /drop\s+(table|index)/i);
assert.doesNotMatch(indexSql, /insert\s+into/i);
assert.doesNotMatch(indexSql, /delete\s+from/i);

// Pilot lifecycle: explicit server-side VIEW/ENROLL/REVOKE, verified guardian
// relationship, Family Free only and PLAYER-scoped grants.
assert.match(pilotSql, /saas_can_manage_family_pilot\(p_action text\)/i);
assert.match(pilotSql, /'VIEW','ENROLL','REVOKE'/);
assert.match(pilotSql, /public\.iq_v3_is_global_superadmin\(\)/i);
assert.match(pilotSql, /relationship_type='GUARDIAN'/i);
assert.match(pilotSql, /FAMILY_PILOT_GUARDIAN_RELATION_REQUIRED/);
assert.match(pilotSql, /FAMILY_PILOT_REQUIRES_FREE_PLAN/);
assert.match(pilotSql, /FAMILY_PILOT_FREE_SUBJECT_CARDINALITY_INVALID/);
assert.match(pilotSql, /billing_account_id,entitlement_code,subject_type,player_id,beneficiary_scope/i);
assert.match(pilotSql, /select v_account_id,code,'PLAYER',p_player_id,'ACCOUNT_MEMBERS'/i);
assert.match(pilotSql, /source_type,source_id/);
assert.match(pilotSql, /'FAMILY_PILOT',v_enrollment_id/);
assert.match(pilotSql, /status='REVOKED',revoked_by=auth\.uid\(\),revoked_at=v_now/);
assert.match(pilotSql, /FAMILY_PAID_PLAN_ACTIVATED_BY_PILOT/);

const enrollBody = functionBody(
  pilotSql,
  "create or replace function public.iq_v11_family_pilot_enroll"
);
for (const forbidden of ["AI_INSIGHTS", "AI_WEEKLY_PLAN", "WELLNESS", "NUTRITION_RECOVERY"]) {
  assert(!enrollBody.includes(forbidden), `Pilot enroll must not grant ${forbidden}`);
}
assert(!enrollBody.includes("insert into public.saas_entitlement_overrides"), "Pilot must not write account-wide overrides");
assert(enrollBody.includes("saas_entitlement_grants"), "Pilot must use scoped grants");
assert(enrollBody.includes("p_trial_days not in (7,14,28,42,56)"));

// Rollback removes only pilot-owned data and leaves reusable grant architecture.
assert.match(rollbackSql, /delete from public\.saas_entitlement_grants[\s\S]*source_type='FAMILY_PILOT'/i);
assert.doesNotMatch(rollbackSql, /drop table if exists public\.saas_entitlement_grants/i);
assert.doesNotMatch(rollbackSql, /update public\.saas_plans/i);

// Client remains a thin RPC adapter.
assert.match(service, /iq_v11_family_pilot_snapshot/);
assert.match(service, /iq_v11_family_pilot_enroll/);
assert.match(service, /iq_v11_family_pilot_revoke/);
assert.doesNotMatch(service, /\.from\(["']saas_/i);

// Three independent UI permissions; Object.values(Permission) gives them only
// to SUPERADMIN because no other role matrix explicitly includes them.
for (const permission of [
  Permission.VIEW_FAMILY_PILOT,
  Permission.ENROLL_FAMILY_PILOT,
  Permission.REVOKE_FAMILY_PILOT
]) {
  assert(permission, "Family pilot permission missing");
  assert(ROLE_PERMISSIONS[UserRole.SUPERADMIN].includes(permission));
  for (const role of Object.values(UserRole).filter(role => role !== UserRole.SUPERADMIN)) {
    assert(!ROLE_PERMISSIONS[role]?.includes(permission), `${role} must not receive ${permission}`);
  }
}
assert.match(view, /Permission\.VIEW_FAMILY_PILOT/);
assert.match(view, /Permission\.ENROLL_FAMILY_PILOT/);
assert.match(view, /Permission\.REVOKE_FAMILY_PILOT/);
assert.match(view, /Sin IA, Wellness ni Nutrición/);
assert.match(lazy, /new BusinessMetricsView\(supabase, authController\)/);

console.log("FAMILY_PILOT_COHORT_CONTRACT_OK");
