import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/ready/20260904_fix_demo_invited_runtime_scope_v1.sql','utf8');

assert.match(sql,/begin;/i);
assert.match(sql,/commit;/i);
assert.match(sql,/test@test\.com/i);
assert.match(sql,/d0000000-0000-4000-8000-000000000005/i);
assert.match(sql,/upper\(function_role\).*?not in \('ANALISTA','INVITADO'\)/is);
assert.match(sql,/set function_role='INVITADO'/i);
assert.match(sql,/DEMO_INVITED_SCOPE_HOTFIX_OK/);
assert.doesNotMatch(sql,/delete\s+from/i);
assert.doesNotMatch(sql,/truncate|drop\s+(table|schema)/i);
assert.doesNotMatch(sql,/update\s+public\.user_profiles/i);

console.log('DEMO_INVITED_SCOPE_HOTFIX_SQL_OK');
