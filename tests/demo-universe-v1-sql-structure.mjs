import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(p,'utf8');
const core = read('supabase/ready/20260904_apply_demo_universe_v1_core.sql');
const p360 = read('supabase/ready/20260904_apply_demo_universe_v1_player360.sql');
const preflight = read('supabase/ready/20260904_preflight_demo_universe_v1_readonly.sql');
const verify = read('supabase/ready/20260904_verify_demo_universe_v1_readonly.sql');
const rollback = read('supabase/ready/20260904_rollback_demo_universe_v1.sql');
const post = read('supabase/ready/20260904_verify_demo_universe_v1_postrollback_readonly.sql');

for (const src of [core,p360,preflight,verify,rollback,post]) {
  assert.match(src,/d0000000-0000-4000-8000-000000000005/i,'team-season demo id must be explicit');
}

assert.match(core,/IQB-DEMO-2026-27-V1/);
assert.match(core,/\'OPEN\',\s*null,\s*null,\s*null/i);
assert.match(core,/DEMO_V1_SUPERADMIN_PROFILE_MISSING/);
assert.match(core,/set edit_state='LOCKED'/i);
assert.match(core,/request\.jwt\.claims/i);
assert.match(core,/insert into public\.play_by_play_events/i);
assert.match(core,/insert into public\.player_game_stats/i);
assert.match(core,/insert into public\.game_period_scores/i);
assert.match(p360,/generate_series\(0,23\)/i);
assert.match(p360,/generate_series\(1,28\)/i);
assert.match(p360,/NO_LLM_CALLED/);
assert.match(p360,/SYNTHETIC_DEMO/);
assert.match(p360,/array\['READ','AI_PROCESS'\]/i);
assert.match(p360,/test@test\.com/i);
assert.match(p360,/scolado@nechigroup\.com/i);
assert.doesNotMatch(p360,/\btruncate\b/i);
assert.doesNotMatch(p360,/\bdrop\s+(table|schema)\b/i);
assert.doesNotMatch(p360,/\balter\s+table\b/i);

assert.match(preflight,/PREFLIGHT preflight_ok/);
assert.match(verify,/VERIFY verify_ok/);
assert.match(verify,/DEMO_V1_VERIFY_BOXSCORE_SCORE_MISMATCH/);
assert.match(verify,/DEMO_V1_VERIFY_LOCK_STATE_FAILED/);
assert.match(rollback,/set edit_state='OPEN'/i);
assert.match(rollback,/DEMO_V1_ROLLBACK_SUPERADMIN_PROFILE_MISSING/);
assert.match(verify,/3360/);
assert.match(rollback,/DELETE FROM public\.player_ai_insights/i);
assert.match(rollback,/DELETE FROM public\.clubs/i);
assert.doesNotMatch(rollback,/delete\s+from\s+public\.user_profiles/i);
assert.match(post,/POSTROLLBACK postrollback_ok/);

console.log('Demo Universe V1 SQL structure: OK');
