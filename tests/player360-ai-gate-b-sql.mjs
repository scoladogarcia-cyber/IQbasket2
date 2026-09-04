import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const apply = read("supabase/ready/20260904_apply_ai_usage_ledger_v1.sql");
const preflight = read("supabase/ready/20260904_preflight_ai_usage_ledger_v1_readonly.sql");
const verify = read("supabase/ready/20260904_verify_ai_usage_ledger_v1_readonly.sql");
const rollback = read("supabase/ready/20260904_rollback_ai_usage_ledger_v1.sql");
const smoke = read("supabase/drafts/20260904_smoke_ai_usage_ledger_v1_rollback.sql");

assert.match(apply, /create table if not exists public\.ai_usage_ledger/i);
assert.match(apply, /idempotency_key uuid not null/i);
assert.match(apply, /unique \(user_id, operation, idempotency_key\)/i);
assert.match(apply, /club_id uuid references public\.clubs/i);
assert.match(apply, /team_season_id uuid not null references public\.team_seasons/i);
assert.match(apply, /snapshot_id uuid not null references public\.player_longitudinal_snapshots/i);
assert.match(apply, /status in \('RESERVED','IN_PROGRESS','SUCCEEDED','FAILED','EXPIRED'\)/i);
assert.match(apply, /alter table public\.ai_usage_ledger enable row level security/i);
assert.match(apply, /revoke all on table public\.ai_usage_ledger from public, anon, authenticated/i);

assert.match(apply, /create or replace function public\.iq_ai_reserve_usage/i);
assert.match(apply, /pg_advisory_xact_lock/i);
assert.match(apply, /status = 'EXPIRED'[\s\S]*reserved_units = 0/i);
assert.match(apply, /AI_USAGE_STALE_IN_PROGRESS/i);
assert.match(apply, /AI_USAGE_IDEMPOTENCY_SCOPE_CONFLICT/i);
assert.match(apply, /AI_USAGE_LIMIT_INVALID/i);
assert.match(apply, /create or replace function public\.iq_ai_mark_provider_started/i);
assert.match(apply, /status='IN_PROGRESS'[\s\S]*consumed_units=1/i);
assert.match(apply, /create or replace function public\.iq_ai_complete_usage/i);
assert.match(apply, /status='SUCCEEDED'[\s\S]*insight_id=p_insight_id/i);
assert.match(apply, /AI_USAGE_INSIGHT_SCOPE_MISMATCH/i);
assert.match(apply, /create or replace function public\.iq_ai_fail_usage/i);
assert.match(apply, /consumed_units=case when v_row\.status='IN_PROGRESS' then 1 else 0 end/i);

for (const signature of [
  /iq_ai_reserve_usage\(uuid,uuid,uuid,uuid,integer,text\)[\s\S]{0,160}to service_role/i,
  /iq_ai_mark_provider_started\(uuid,uuid,text,text\)[\s\S]{0,160}to service_role/i,
  /iq_ai_complete_usage\(uuid,uuid,uuid,text,integer,integer,integer\)[\s\S]{0,160}to service_role/i,
  /iq_ai_fail_usage\(uuid,uuid,text\)[\s\S]{0,160}to service_role/i
]) assert.match(apply, signature);

assert.doesNotMatch(apply, /grant execute on function public\.iq_ai_[^(]+\([^;]+\)\s+to authenticated/i);
assert.match(preflight, /AI_USAGE_LEDGER_V1_PREFLIGHT/);
assert.match(preflight, /AI_USAGE_LEDGER_PREFLIGHT_PHASE4D_MISSING/);
assert.match(verify, /AI_USAGE_LEDGER_V1_VERIFY/);
assert.match(verify, /AI_USAGE_LEDGER_VERIFY_AUTH_RPC_EXPOSED/);
assert.match(verify, /AI_USAGE_LEDGER_VERIFY_SERVICE_ROLE_RPC_MISSING/);
assert.match(rollback, /drop table if exists public\.ai_usage_ledger/i);
assert.match(rollback, /player_ai_insights[^\n]+is not null as insights_preserved/i);
assert.match(rollback, /player_longitudinal_snapshots[^\n]+is not null as snapshots_preserved/i);
assert.doesNotMatch(rollback, /drop table if exists public\.player_ai_insights/i);

console.log("PLAYER360_AI_GATE_B_SQL_OK");