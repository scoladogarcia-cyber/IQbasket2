import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync("supabase/ready/20260904_apply_saas_entitlements_v1.sql", "utf8");
const contract = fs.readFileSync("security/entitlements.js", "utf8");
const service = fs.readFileSync("services/security/EntitlementService.js", "utf8");
const smoke = fs.readFileSync("supabase/drafts/20260904_smoke_saas_entitlements_family_first_v1_rollback.sql", "utf8");

assert.match(sql, /create table public\.saas_billing_accounts/i);
assert.match(sql, /account_type in \('FAMILY','TEAM','CLUB','ACADEMY','INTERNAL'\)/i);
assert.match(sql, /saas_family_owner_check/i);
assert.match(sql, /saas_sync_billing_owner/i);
assert.match(sql, /SAAS_FAMILY_PLAYER_SUBJECT_REQUIRED/i);
assert.match(sql, /SAAS_SUBSCRIPTION_PLAN_ACCOUNT_TYPE_MISMATCH/i);
assert.match(sql, /create table public\.saas_billing_subjects/i);
assert.match(sql, /subject_type in \('PLAYER','TEAM','CLUB'\)/i);
assert.match(sql, /create table public\.saas_subscriptions/i);
assert.doesNotMatch(sql, /saas_tenant_licenses/i);

assert.match(sql, /'FAMILY_FREE','Family Free','FAMILY','ACTIVE'/i);
assert.match(sql, /'FAMILY_PRO','Family Pro','FAMILY','DRAFT'/i);
assert.match(sql, /'PLAYER360','ACCOUNT_MEMBERS'/i);
assert.match(sql, /'CLUB','PLAYER360','AUTHORIZED_STAFF'/i);
assert.match(sql, /'AI_MONTHLY_UNITS','ACCOUNT_MEMBERS',null,0/i);
assert.match(sql, /SAAS_V1_BILLING_ACCOUNT_CREATED_PREMATURELY/i);
assert.match(sql, /Paying never grants data access/i);
assert.match(sql, /player360_subject_relationships/i);
assert.match(sql, /iq_v4_can_view_player360_team_season/i);
assert.match(sql, /beneficiary_scope in \('ACCOUNT_MEMBERS','AUTHORIZED_STAFF','ALL_AUTHORIZED'\)/i);
assert.match(sql, /revoke all on table public\.%I from public,anon,authenticated/i);
assert.match(sql, /security invoker/i);

assert.match(contract, /FAMILY: "FAMILY"/);
assert.match(contract, /PLAYER: "PLAYER"/);
assert.match(contract, /DEVELOPMENT_PLAN: "DEVELOPMENT_PLAN"/);
assert.match(contract, /AI_WEEKLY_PLAN: "AI_WEEKLY_PLAN"/);
assert.doesNotMatch(contract, /STRIPE_/i);
assert.doesNotMatch(sql, /stripe/i);

assert.match(service, /p_subject_type/);
assert.match(service, /p_subject_id/);
assert.match(service, /p_team_season_id/);
assert.doesNotMatch(service, /clubId/);

assert.match(smoke, /SAAS_FAMILY_RUNTIME/);
assert.match(smoke, /SAAS_STAFF_RUNTIME/);
assert.match(smoke, /rollback;/i);

console.log("SAAS_ENTITLEMENTS_FAMILY_FIRST_V1_OK");
