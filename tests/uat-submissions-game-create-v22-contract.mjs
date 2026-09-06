import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [migration, preflight, verify, smoke, approvalService, player360, releaseRaw] = await Promise.all([
  read("../supabase/migrations/20260906160000_uat_submission_review_game_create_hotfix_v22.sql"),
  read("../supabase/ready/20260906_preflight_uat_submission_review_game_create_hotfix_v22_readonly.sql"),
  read("../supabase/ready/20260906_verify_uat_submission_review_game_create_hotfix_v22_readonly.sql"),
  read("../supabase/drafts/20260906_smoke_uat_submission_review_game_create_v22_installed_rollback.sql"),
  read("../services/ApprovalCenterService.js"),
  read("../views/Player360View.js"),
  read("../release.json")
]);

const reviewScopeMatch = migration.match(/create or replace function iq_private\.iq_v14_can_review_player_submission[\s\S]*?\$function\$;/i);
assert.ok(reviewScopeMatch, "Falta redefinir el scope de revisión de aportaciones");
const reviewScope = reviewScopeMatch[0];
assert.match(reviewScope, /ADMIN','ENTRENADOR/);
assert.match(reviewScope, /v_module in \('nutrition','recovery'\)/);
assert.doesNotMatch(reviewScope, /iq_v4e_can_access_sensitive_resource/);

const materializationMatch = migration.match(/create or replace function iq_private\.iq_v22_submission_materialization_allowed[\s\S]*?\$function\$;/i);
assert.ok(materializationMatch, "Falta el bridge privado de materialización V22");
assert.match(materializationMatch[0], /current_setting\('iqbasket\.player_submission_review_id',true\)/);
assert.match(materializationMatch[0], /s\.status='SUBMITTED'/);
assert.match(materializationMatch[0], /s\.submitted_by<>auth\.uid\(\)/);
assert.match(materializationMatch[0], /p_action[\s\S]*CREATE/i);
assert.match(materializationMatch[0], /p_purpose[\s\S]*SPORT_PERFORMANCE/i);
assert.match(migration, /revoke all on function iq_private\.iq_v22_submission_materialization_allowed[\s\S]*authenticated/i);

const wrapperMatch = migration.match(/create or replace function public\.iq_v4e_can_access_sensitive_resource[\s\S]*?\$function\$;/i);
assert.ok(wrapperMatch, "Falta preservar el wrapper ABAC");
assert.match(wrapperMatch[0], /iq_v7_unchecked_v4e_can_access_sensitive_resource/);
assert.match(wrapperMatch[0], /iq_v22_submission_materialization_allowed/);

const reviewRpcMatch = migration.match(/create or replace function public\.iq_v18_review_player_submission[\s\S]*?\$function\$;/i);
assert.ok(reviewRpcMatch, "Falta parchear el RPC de revisión V18");
assert.match(reviewRpcMatch[0], /set_config\('iqbasket\.player_submission_review_id',v_row\.id::text,true\)/);
assert.match(reviewRpcMatch[0], /set_config\('iqbasket\.player_submission_review_id','',true\)/);
assert.match(reviewRpcMatch[0], /\('APPROVED','RETURNED','REJECTED'\)/);
assert.match(reviewRpcMatch[0], /v_decision='APPROVED'/i);
assert.match(reviewRpcMatch[0], /v_decision in \('RETURNED','REJECTED'\)/i);

const triggerMatch = migration.match(/create or replace function iq_private\.sync_game_play_state_legacy_status_v2\(\)[\s\S]*?\$function\$;/i);
assert.ok(triggerMatch, "Falta parchear el trigger de games");
assert.match(triggerMatch[0], /security definer/i);
assert.match(triggerMatch[0], /set search_path=''/i);
assert.match(triggerMatch[0], /game_legacy_status_for_play_state/);
assert.match(migration, /revoke all on function iq_private\.sync_game_play_state_legacy_status_v2\(\)[\s\S]*authenticated/i);

assert.match(preflight, /UAT_HOTFIX_V22_PREFLIGHT/);
assert.match(preflight, /begin read only/i);
assert.match(verify, /UAT_HOTFIX_V22_VERIFY/);
assert.match(verify, /SECURITY DEFINER/);
assert.match(smoke, /set local role authenticated/i);
assert.match(smoke, /iq_v18_list_player_submission_reviews/);
assert.match(smoke, /iq_v18_review_player_submission[\s\S]*REJECTED/i);
assert.match(smoke, /iq_v18_review_player_submission[\s\S]*APPROVED/i);
assert.match(smoke, /GENERIC_WELLNESS_ACCESS_WIDENED/);
assert.match(smoke, /insert into public\.games/i);
assert.match(smoke, /rollback;/i);

assert.match(approvalService, /function isPlayerSubmissionRequest/);
assert.match(approvalService, /raw\?\.submission_type/);
assert.match(player360, /_returnedSubmissionCount\(\)/);
assert.match(player360, /p360c-open-returned-submissions/);
assert.match(player360, /por corregir/);
assert.match(player360, /Revisar y corregir/);

const release = JSON.parse(releaseRaw);
assert.ok(release.release.localeCompare("2026.09.06.8") >= 0, "La release V22 debe ser 2026.09.06.8 o posterior");
if (release.release === "2026.09.06.8") {
  assert.equal(release.label, "uat-submissions-game-create-hotfix-v22");
}

console.log("UAT_SUBMISSIONS_GAME_CREATE_V22_CONTRACT_OK");
