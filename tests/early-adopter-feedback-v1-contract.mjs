import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20260906124500_early_adopter_feedback_v1.sql', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const layout = fs.readFileSync('views/LayoutView.js', 'utf8');
const service = fs.readFileSync('services/FeedbackService.js', 'utf8');
const view = fs.readFileSync('views/FeedbackView.js', 'utf8');
const release = JSON.parse(fs.readFileSync('release.json', 'utf8'));

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
assert.equal(release.release, '2026.09.06.5');
assert.equal(release.label, 'early-adopters-feedback-v1');

console.log('EARLY_ADOPTER_FEEDBACK_V1_CONTRACT_OK');
