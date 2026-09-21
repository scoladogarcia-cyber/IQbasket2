import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260921091000_training_minutes_integrity_v54.sql', import.meta.url), 'utf8');
const baseline = readFileSync(new URL('../supabase/migrations/20260921090000_training_complete_edit_v54.sql', import.meta.url), 'utf8');
const absentGuard = readFileSync(new URL('../supabase/migrations/20260921090500_training_block_integrity_v54.sql', import.meta.url), 'utf8');

// Existing rows are not backfilled or rewritten. All three checks defer until
// the transaction finishes, so an atomic session edit cannot fail halfway.
assert.doesNotMatch(migration, /\b(?:update|delete|truncate)\s+public\.training_(?:sessions|participants|blocks)\b/i);
assert.equal((migration.match(/create constraint trigger /g) || []).length, 3);
assert.equal((migration.match(/deferrable initially deferred for each row/g) || []).length, 3);
assert.match(migration, /v_block_minutes > v_minutes/);
assert.match(migration, /v_block_minutes > v_session_minutes/);
assert.match(migration, /v_total > new\.participated_minutes/);
assert.match(migration, /TRAINING_ABSENT_PLAYER_HAS_BLOCK_MINUTES/);
assert.match(migration, /TRAINING_BLOCK_DURATION_CONFLICTS_WITH_PARTICIPATION/);
assert.match(absentGuard, /TRAINING_ABSENT_PLAYER_CANNOT_PARTICIPATE_IN_BLOCK/);
assert.match(absentGuard, /TRAINING_BLOCK_PARTIAL_MINUTES_INVALID/);
assert.match(baseline, /TRAINING_REMOVAL_REQUIRES_CONFIRMATION/);
assert.match(baseline, /TRAINING_CHILDREN_CHANGED_RELOAD_REQUIRED/);
console.log('PASS Training V54 minutes: deferred sum, block duration, absence, historical data preserved.');
