import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const files = Object.fromEntries(await Promise.all([
  ["sql","../supabase/migrations/20260906081406_family_guardian_submissions_v1.sql"],
  ["service","../services/player360/PlayerDataSubmissionService.js"],
  ["wellness","../views/player360/WellnessSupportPanel.js"],
  ["panel","../views/player360/PlayerSubmissionPanel.js"],
  ["player360","../views/Player360View.js"],
  ["family","../views/family/FamilyWorkspaceView.js"],
  ["center","../services/ApprovalCenterService.js"]
].map(async ([key,path]) => [key, await readFile(new URL(path,import.meta.url),"utf8")])));

const has=(role,permission)=>(ROLE_PERMISSIONS[role]||[]).includes(permission);

assert.match(files.sql,/add column if not exists actor_relation text not null default 'SELF'/i);
assert.match(files.sql,/actor_relation in \('SELF','GUARDIAN'\)/i);
assert.match(files.sql,/relationship_type='GUARDIAN'/i);
assert.match(files.sql,/rm\.status[\s\S]*ACTIVE[\s\S]*ACTIVO/i);
assert.doesNotMatch(files.sql,/p_actor_relation\s+text/i);
assert.match(files.sql,/v_relation:=iq_private\.iq_v18_player_submission_relation/i);
assert.match(files.sql,/when v_relation='GUARDIAN' then 'FAMILY_SUPPORT'/i);
assert.match(files.sql,/PLAYER_SUBMISSION_SELF_REVIEW_DENIED/i);
assert.match(files.sql,/when v_row\.actor_relation='GUARDIAN' then 'GUARDIAN_REPORT'/i);
assert.match(files.sql,/when v_row\.actor_relation='GUARDIAN' then 'FAMILY_SUPPORT'/i);
assert.match(files.sql,/PLAYER360_WELLNESS_GUARDIAN_SUBMISSION_REQUIRED/i);
assert.match(files.sql,/create or replace function public\.iq_v14_save_player_submission_draft[\s\S]*iq_v18_save_player_submission_draft/i);
assert.match(files.sql,/create or replace function public\.iq_v14_submit_player_submission[\s\S]*iq_v18_submit_player_submission/i);
assert.match(files.sql,/create or replace function public\.iq_v14_review_player_submission[\s\S]*iq_v18_review_player_submission/i);
assert.match(files.sql,/revoke all on function iq_private\.iq_v18_player_submission_relation[\s\S]*authenticated/i);
assert.match(files.sql,/grant execute on function public\.iq_v18_save_player_submission_draft[\s\S]*authenticated/i);
assert.match(files.sql,/has_table_privilege\('authenticated','public\.player_data_submissions','INSERT'\)/i);

assert.equal(has(UserRole.FAMILIA_TUTOR,Permission.CREATE_LINKED_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.FAMILIA_TUTOR,Permission.SUBMIT_LINKED_PLAYER_DATA),true);
assert.equal(has(UserRole.FAMILIA_TUTOR,Permission.CREATE_OWN_PLAYER_SUBMISSION),false);
assert.equal(has(UserRole.FAMILIA_TUTOR,Permission.APPROVE_PLAYER_SUBMISSION),false);
assert.equal(has(UserRole.JUGADOR,Permission.CREATE_OWN_PLAYER_SUBMISSION),true);
assert.equal(has(UserRole.JUGADOR,Permission.CREATE_LINKED_PLAYER_SUBMISSION),false);

assert.match(files.service,/iq_v18_save_player_submission_draft/);
assert.match(files.service,/iq_v18_submit_player_submission/);
assert.match(files.service,/iq_v18_list_my_player_submissions/);
assert.match(files.service,/p_player_id: playerId/);
assert.match(files.service,/iq_v18_list_player_submission_reviews/);
assert.match(files.service,/iq_v18_review_player_submission/);

assert.match(files.wellness,/requiresSubmissionReview/);
assert.match(files.wellness,/submissionService\.saveAndSubmit/);
assert.match(files.wellness,/histórico del jugador/);
assert.match(files.panel,/data-psub-actor-relation/);
assert.match(files.panel,/GUARDIAN_REPORTED/);
assert.match(files.panel,/Aportaciones de familia/);
assert.match(files.panel,/playerId:context\.playerId/);
assert.match(files.player360,/CREATE_LINKED_PLAYER_SUBMISSION/);
assert.match(files.player360,/actorRelation: this\._isFamilyGuardian\(\) \? "GUARDIAN" : "SELF"/);
assert.match(files.player360,/Aportaciones de familia/);
assert.match(files.family,/Aportar contexto/);
assert.match(files.family,/CREATE_LINKED_PLAYER_SUBMISSION/);
assert.match(files.family,/actorRelation: "GUARDIAN"/);
assert.match(files.family,/#\/player360\/\$\{escapeHtml\(this\.playerId\)\}/);
assert.match(files.center,/row\.actor_relation === "GUARDIAN" \? "Familia \/ Tutor" : "Jugador"/);

console.log("FAMILY_GUARDIAN_SUBMISSIONS_V1_CONTRACT_OK");
