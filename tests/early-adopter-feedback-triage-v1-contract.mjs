import assert from "node:assert/strict";
import fs from "node:fs";
import { Permission, ROLE_PERMISSIONS } from "../security/permissions.js";
import { UserRole } from "../security/roles.js";

const migration=fs.readFileSync("supabase/migrations/20260906131500_early_adopter_feedback_triage_v1.sql","utf8");
const service=fs.readFileSync("services/admin/ProductFeedbackService.js","utf8");
const view=fs.readFileSync("views/admin/BusinessMetricsView.js","utf8");
const workflow=fs.readFileSync(".github/workflows/early-adopter-feedback-triage-v1-controlled-apply.yml","utf8");
const release=JSON.parse(fs.readFileSync("release.json","utf8"));
const has=(role,permission)=>(ROLE_PERMISSIONS[role]||[]).includes(permission);

assert.match(migration,/add column if not exists reviewed_by uuid references auth\.users/i);
assert.match(migration,/iq_v20_list_product_feedback/i);
assert.match(migration,/iq_v20_review_product_feedback/i);
assert.match(migration,/not public\.iq_v3_is_global_superadmin\(\)/i);
assert.match(migration,/security definer[\s\S]*set search_path=''/i);
assert.match(migration,/revoke all on table public\.product_feedback from public,anon,authenticated/i);
assert.match(migration,/PRODUCT_FEEDBACK_DISMISS_NOTE_REQUIRED/i);
assert.match(migration,/reviewed_by=auth\.uid\(\)/i);
assert.doesNotMatch(service,/\.from\(/);
assert.match(service,/iq_v20_list_product_feedback/);
assert.match(service,/iq_v20_review_product_feedback/);
assert.equal(has(UserRole.SUPERADMIN,Permission.VIEW_PRODUCT_FEEDBACK),true);
assert.equal(has(UserRole.SUPERADMIN,Permission.REVIEW_PRODUCT_FEEDBACK),true);
assert.equal(has(UserRole.ADMIN,Permission.VIEW_PRODUCT_FEEDBACK),false);
assert.equal(has(UserRole.ENTRENADOR,Permission.VIEW_PRODUCT_FEEDBACK),false);
assert.equal(has(UserRole.INVITADO,Permission.VIEW_PRODUCT_FEEDBACK),false);
assert.match(view,/Permission\.VIEW_PRODUCT_FEEDBACK/);
assert.match(view,/Permission\.REVIEW_PRODUCT_FEEDBACK/);
assert.match(view,/data-product-feedback-triage/);
assert.match(view,/data-feedback-review/);
assert.match(workflow,/20260906131500_early_adopter_feedback_triage_v1\.sql/);

function releaseAtLeast(value,baseline){
  const left=String(value||"").split(".").map(Number);
  const right=String(baseline||"").split(".").map(Number);
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length;index+=1){
    const a=Number.isFinite(left[index])?left[index]:0;
    const b=Number.isFinite(right[index])?right[index]:0;
    if(a!==b)return a>b;
  }
  return true;
}

assert.ok(releaseAtLeast(release.release,"2026.09.06.6"),"La release no puede retroceder respecto a V20.");
if (release.release==="2026.09.06.6") assert.equal(release.label,"early-adopters-feedback-triage-v1");
console.log("EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_CONTRACT_OK");
