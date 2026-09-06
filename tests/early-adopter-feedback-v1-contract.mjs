import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20260906124500_early_adopter_feedback_v1.sql', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const layout = fs.readFileSync('views/LayoutView.js', 'utf8');
const service = fs.readFileSync('services/FeedbackService.js', 'utf8');
const view = fs.readFileSync('views/FeedbackView.js', 'utf8');
const release = JSON.parse(fs.readFileSync('release.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/early-adopter-feedback-v1-controlled-apply.yml', 'utf8');

assert.match(sql, /create table if not exists public\.product_feedback/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /revoke all on table public\.product_feedback from public, anon, authenticated/i);
assert.match(sql, /product_feedback_deny_authenticated/i);
assert.match(sql, /auth\.uid\(\)/i);
assert.match(sql, /iq_v19_submit_product_feedback/i);
assert.match(sql, /grant execute .* to authenticated/i);
assert.doesNotMatch(service, /\.from\(/);
assert.match(service, /iq_v19_submit_product_feedback/);
assert.match(app, /case "feedback"/);
assert.match(layout, /route: "feedback"/);
assert.match(layout, /EARLY ACCESS/);
assert.match(view, /No incluyas información médica/);
assert.match(view, /maxlength="4000"/);
assert.match(workflow, /TABLE_INSTALLED=[\s\S]*?to_regclass/);
assert.match(workflow, /if \[ "\$TABLE_INSTALLED" = "1" \]; then/);
assert.doesNotMatch(workflow, /case when to_regclass\('public\.product_feedback'\).*select count/s);

function releaseAtLeast(value, baseline) {
  const left = String(value || '').split('.').map(Number);
  const right = String(baseline || '').split('.').map(Number);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = Number.isFinite(left[index]) ? left[index] : 0;
    const b = Number.isFinite(right[index]) ? right[index] : 0;
    if (a !== b) return a > b;
  }
  return true;
}

assert.ok(releaseAtLeast(release.release, '2026.09.06.5'), 'La release no puede retroceder respecto a V19.');
if (release.release === '2026.09.06.5') assert.equal(release.label, 'early-adopters-feedback-v1');

console.log('EARLY_ADOPTER_FEEDBACK_V1_CONTRACT_OK');
