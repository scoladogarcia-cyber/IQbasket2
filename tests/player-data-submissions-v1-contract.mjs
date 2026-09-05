import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const files = Object.fromEntries(await Promise.all([
  ["sql","../supabase/ready/20260905_apply_player_data_submissions_v1.sql"],
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

const has=(role,permission)=>(ROLE_PERMISSIONS[role]||[]).includes(permission);

assert.equal(has(UserRole.JUGADOR,Permission.CREATE_OWN_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.JUGADOR,Permission.SUBMIT_OWN_PLAYER_DATA),true);
assert.equal(has(UserRole.JUGADOR,Permission.APPROVE_PLAYER_SUBMISSION),false);
assert.equal(has(UserRole.ENTRENADOR,Permission.VIEW_PLAYER_SUBMISSIONS),true);
assert.equal(has(UserRole.ENTRENADOR,Permission.APPROVE_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.ADMIN,Permission.RETURN_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.ADMIN,Permission.REJECT_PLAYER_SUBMISSION),true);

assert.match(files.service,/iq_v14_save_player_submission_draft/);
assert.match(files.service,/iq_v14_submit_player_submission/);
assert.match(files.service,/iq_v14_review_player_submission/);
assert.match(files.wellness,/Enviar para validar/);
assert.match(files.wellness,/submissionService\.saveAndSubmit/);
assert.match(files.panel,/Guardar borrador/);
assert.match(files.panel,/Enviar al staff/);
assert.match(files.panel,/Pendiente de validaci/);
assert.match(files.center,/PLAYER_DATA_SUBMISSION/);
assert.match(files.centerView,/btn-approval-return/);
assert.match(files.player360,/Mis aportaciones/);

console.log("PLAYER_DATA_SUBMISSIONS_V1_CONTRACT_OK");

