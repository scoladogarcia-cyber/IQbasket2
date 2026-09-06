import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const files = Object.fromEntries(await Promise.all([
  ["sql","../supabase/ready/20260905_apply_player_data_submissions_v1.sql"],
  ["indexes","../supabase/ready/20260906_apply_player_data_submissions_fk_indexes_v1.sql"],
  ["v18","../supabase/migrations/20260906081406_family_guardian_submissions_v1.sql"],
  ["v22","../supabase/migrations/20260906160000_uat_submission_review_game_create_hotfix_v22.sql"],
  ["v22Rollback","../supabase/ready/20260906_rollback_uat_submission_review_game_create_hotfix_v22.sql"],
  ["v22Verify","../supabase/ready/20260906_verify_uat_submission_review_game_create_hotfix_v22_readonly.sql"],
  ["v22Smoke","../supabase/drafts/20260906_smoke_uat_submission_review_game_create_v22_installed_rollback.sql"],
  ["service","../services/player360/PlayerDataSubmissionService.js"],
  ["wellness","../views/player360/WellnessSupportPanel.js"],
  ["panel","../views/player360/PlayerSubmissionPanel.js"],
  ["center","../services/ApprovalCenterService.js"],
  ["centerView","../views/ApprovalCenterView.js"],
  ["player360","../views/Player360View.js"]
].map(async ([key,path]) => [key, await readFile(new URL(path,import.meta.url),"utf8")])));

assert.match(files.sql,/create table if not exists public\.player_data_submissions/i);
assert.match(files.sql,/DRAFT.*SUBMITTED.*RETURNED.*APPROVED.*REJECTED/s);
assert.match(files.sql,/v_row\.status not in \('DRAFT','RETURNED'\)/);
assert.match(files.sql,/enable row level security/i);
assert.match(files.sql,/revoke all on public\.player_data_submissions from anon, authenticated/i);
assert.match(files.sql,/iq_v14_player_submission_is_self/);
assert.match(files.sql,/upper\(m\.function_role\) in \('ADMIN','ENTRENADOR'\)/);
assert.match(files.sql,/iq_v4e_can_access_sensitive_resource/);
assert.match(files.sql,/iq_v4e2_save_manual_wellness_entry/);
assert.match(files.sql,/iq_v4_create_external_development/);
assert.match(files.sql,/PLAYER360_WELLNESS_SELF_SUBMISSION_REQUIRED/);
assert.match(files.sql,/source_type='PLAYER_SELF_REPORT'/);
assert.match(files.sql,/captured_by=v_row\.submitted_by/);
assert.match(files.sql,/validated_by/);
assert.match(files.sql,/materialized_resource_id/);

assert.match(files.indexes,/create index if not exists player_data_submissions_reviewed_by_fk_idx[\s\S]*reviewed_by/i);
assert.doesNotMatch(files.indexes,/\b(?:insert|update|delete|drop\s+table|alter\s+table)\b/i);

const has=(role,permission)=>(ROLE_PERMISSIONS[role]||[]).includes(permission);

assert.equal(has(UserRole.JUGADOR,Permission.CREATE_OWN_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.JUGADOR,Permission.SUBMIT_OWN_PLAYER_DATA),true);
assert.equal(has(UserRole.JUGADOR,Permission.APPROVE_PLAYER_SUBMISSION),false);
assert.equal(has(UserRole.ENTRENADOR,Permission.VIEW_PLAYER_SUBMISSIONS),true);
assert.equal(has(UserRole.ENTRENADOR,Permission.APPROVE_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.ADMIN,Permission.RETURN_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.ADMIN,Permission.REJECT_PLAYER_SUBMISSION),true);

assert.match(files.service,/iq_v18_save_player_submission_draft/);
assert.match(files.service,/iq_v18_submit_player_submission/);
assert.match(files.service,/iq_v18_review_player_submission/);
assert.match(files.service,/iq_v18_list_player_submission_reviews/);
assert.match(files.v18,/create or replace function public\.iq_v14_save_player_submission_draft[\s\S]*iq_v18_save_player_submission_draft/i);
assert.match(files.v18,/create or replace function public\.iq_v14_submit_player_submission[\s\S]*iq_v18_submit_player_submission/i);
assert.match(files.v18,/create or replace function public\.iq_v14_review_player_submission[\s\S]*iq_v18_review_player_submission/i);
assert.match(files.wellness,/Enviar para validar/);
assert.match(files.wellness,/submissionService\.saveAndSubmit/);
assert.match(files.wellness,/listForReview/);
assert.match(files.wellness,/Permission\.VIEW_PLAYER_SUBMISSIONS/);
assert.match(files.wellness,/Permission\.APPROVE_PLAYER_SUBMISSION/);
assert.match(files.wellness,/Permission\.RETURN_PLAYER_SUBMISSION/);
assert.match(files.wellness,/Permission\.REJECT_PLAYER_SUBMISSION/);
assert.match(files.wellness,/submissionService\.review/);
assert.match(files.wellness,/p360w-review-action/);
assert.match(files.wellness,/Aportaciones pendientes de validar/);
assert.match(files.wellness,/Histórico privado protegido/);
assert.match(files.wellness,/sin abrir el histórico privado/);
assert.match(files.panel,/Guardar borrador/);
assert.match(files.panel,/Enviar al staff/);
assert.match(files.panel,/Pendiente de validaci/);
assert.match(files.panel,/Corregir y reenviar/);
assert.match(files.panel,/submissionId:\s*editing\.id/);
assert.match(files.panel,/data-psub-edit/);
assert.match(files.center,/PLAYER_DATA_SUBMISSION/);
assert.match(files.center,/isPlayerSubmissionRequest/);
assert.match(files.center,/decision:\s*"RETURNED"/);
assert.match(files.center,/decision:\s*"REJECTED"/);
assert.match(files.center,/Indica el motivo del rechazo/);
assert.match(files.centerView,/btn-approval-return/);
assert.match(files.centerView,/#\/player360\//);
assert.match(files.player360,/Mis aportaciones/);
assert.match(files.player360,/_renderSubmissionAttention/);
assert.match(files.player360,/p360c-open-returned-submissions/);
assert.match(files.player360,/por corregir/);

// V22 keeps canonical wellness history ABAC-closed while allowing a scoped
// coach/admin to review the exact temporary submission disclosed by the player.
assert.match(files.v22,/create or replace function iq_private\.iq_v14_can_review_player_submission/);
assert.match(files.v22,/upper\(m\.function_role\) in \('ADMIN','ENTRENADOR'\)/);
assert.match(files.v22,/return v_module in \('nutrition','recovery'\)/);
const v22ReviewHelper = files.v22.match(/create or replace function iq_private\.iq_v14_can_review_player_submission[\s\S]*?\$function\$;/i)?.[0] || "";
assert.doesNotMatch(v22ReviewHelper,/iq_v4e_can_access_sensitive_resource/);
assert.match(files.v22,/iq_private\.iq_v22_submission_materialization_allowed/);
assert.match(files.v22,/iqbasket\.player_submission_review_id/);
assert.match(files.v22,/public\.iq_v7_unchecked_v4e_can_access_sensitive_resource/);
assert.match(files.v22,/alter function iq_private\.sync_game_play_state_legacy_status_v2\(\) security definer|create or replace function iq_private\.sync_game_play_state_legacy_status_v2\(\)[\s\S]*security definer/i);
assert.match(files.v22,/revoke all on function iq_private\.sync_game_play_state_legacy_status_v2\(\)[\s\S]*authenticated/i);
assert.match(files.v22Rollback,/security invoker/i);
assert.match(files.v22Rollback,/drop function if exists iq_private\.iq_v22_submission_materialization_allowed/);
assert.match(files.v22Verify,/installed_ok/);
assert.match(files.v22Verify,/has_function_privilege/);
assert.match(files.v22Smoke,/V22_SMOKE_COACH_CANNOT_SEE_SUBMISSION/);
assert.match(files.v22Smoke,/V22_SMOKE_GENERIC_WELLNESS_ACCESS_WIDENED/);
assert.match(files.v22Smoke,/V22_SMOKE_GAME_CREATE_FAILED/);
assert.match(files.v22Smoke,/rollback;\s*$/i);

console.log("PLAYER_DATA_SUBMISSIONS_V1_CONTRACT_OK");
