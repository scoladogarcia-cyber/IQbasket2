-- IQBasket Player 360 AI Gate B - atomic usage ledger V1
-- Additive migration. It does not enable AI generation or configure provider secrets.

begin;

create table if not exists public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  operation text not null default 'PLAYER360_AI_INSIGHT',
  idempotency_key uuid not null,
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  snapshot_id uuid not null references public.player_longitudinal_snapshots(id) on delete restrict,
  billing_period_start date not null,
  status text not null default 'RESERVED',
  quota_limit integer not null,
  reserved_units integer not null default 1,
  consumed_units integer not null default 0,
  attempt_count integer not null default 1,
  provider text,
  model_name text,
  provider_request_id text,
  insight_id uuid references public.player_ai_insights(id) on delete restrict,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  failure_code text,
  reserved_at timestamptz not null default now(),
  provider_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_usage_ledger
  drop constraint if exists ai_usage_ledger_operation_check,
  add constraint ai_usage_ledger_operation_check
    check (operation = 'PLAYER360_AI_INSIGHT'),
  drop constraint if exists ai_usage_ledger_status_check,
  add constraint ai_usage_ledger_status_check
    check (status in ('RESERVED','IN_PROGRESS','SUCCEEDED','FAILED','EXPIRED')),
  drop constraint if exists ai_usage_ledger_quota_check,
  add constraint ai_usage_ledger_quota_check
    check (quota_limit between 1 and 1000000),
  drop constraint if exists ai_usage_ledger_units_check,
  add constraint ai_usage_ledger_units_check
    check (reserved_units in (0,1) and consumed_units in (0,1)),
  drop constraint if exists ai_usage_ledger_attempt_check,
  add constraint ai_usage_ledger_attempt_check
    check (attempt_count >= 1),
  drop constraint if exists ai_usage_ledger_token_check,
  add constraint ai_usage_ledger_token_check
    check ((input_tokens is null or input_tokens >= 0)
       and (output_tokens is null or output_tokens >= 0)
       and (latency_ms is null or latency_ms >= 0)),
  drop constraint if exists ai_usage_ledger_idempotency_unique,
  add constraint ai_usage_ledger_idempotency_unique
    unique (user_id, operation, idempotency_key);

create index if not exists idx_ai_usage_ledger_user_period
  on public.ai_usage_ledger(user_id, operation, billing_period_start, status);
create index if not exists idx_ai_usage_ledger_club_period
  on public.ai_usage_ledger(club_id, billing_period_start, status);
create index if not exists idx_ai_usage_ledger_scope
  on public.ai_usage_ledger(team_season_id, created_at desc);
alter table public.ai_usage_ledger
  drop constraint if exists ai_usage_ledger_state_units_check,
  add constraint ai_usage_ledger_state_units_check check (
    (status = 'RESERVED' and reserved_units = 1 and consumed_units = 0 and completed_at is null)
    or (status = 'IN_PROGRESS' and reserved_units = 0 and consumed_units = 1 and provider_started_at is not null and completed_at is null)
    or (status = 'SUCCEEDED' and reserved_units = 0 and consumed_units = 1 and insight_id is not null and completed_at is not null)
    or (status = 'FAILED' and reserved_units = 0 and failure_code is not null and completed_at is not null)
    or (status = 'EXPIRED' and reserved_units = 0 and consumed_units = 0 and completed_at is not null)
  );

create or replace function public.iq_ai_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.iq_ai_touch_updated_at() from public, anon, authenticated;

drop trigger if exists trg_ai_usage_ledger_touch on public.ai_usage_ledger;
create trigger trg_ai_usage_ledger_touch
before update on public.ai_usage_ledger
for each row execute function public.iq_ai_touch_updated_at();

alter table public.ai_usage_ledger enable row level security;
revoke all on table public.ai_usage_ledger from public, anon, authenticated;
create or replace function public.iq_ai_monthly_units(
  p_user_id uuid,
  p_operation text,
  p_period_start date
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case
      when l.status = 'RESERVED' then l.reserved_units
      else l.consumed_units
    end
  ), 0)::integer
  from public.ai_usage_ledger l
  where l.user_id = p_user_id
    and l.operation = p_operation
    and l.billing_period_start = p_period_start;
$$;

revoke all on function public.iq_ai_monthly_units(uuid,text,date)
  from public, anon, authenticated;
grant execute on function public.iq_ai_monthly_units(uuid,text,date)
  to service_role;

create or replace function public.iq_ai_reserve_usage(
  p_user_id uuid,
  p_team_season_id uuid,
  p_snapshot_id uuid,
  p_idempotency_key uuid,
  p_monthly_limit integer,
  p_operation text default 'PLAYER360_AI_INSIGHT'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date := date_trunc('month', now() at time zone 'UTC')::date;
  v_club_id uuid;
  v_existing public.ai_usage_ledger%rowtype;
  v_ledger_id uuid;
  v_used integer;
begin
  if p_user_id is null or p_team_season_id is null or p_snapshot_id is null
     or p_idempotency_key is null then
    raise exception 'AI_USAGE_RESERVATION_INPUT_REQUIRED';
  end if;
  if p_operation <> 'PLAYER360_AI_INSIGHT' then
    raise exception 'AI_USAGE_OPERATION_UNSUPPORTED';
  end if;
  if p_monthly_limit is null or p_monthly_limit < 1 or p_monthly_limit > 1000000 then
    raise exception 'AI_USAGE_LIMIT_INVALID';
  end if;
  if not exists(select 1 from public.user_profiles u where u.id = p_user_id) then
    raise exception 'AI_USAGE_USER_NOT_FOUND';
  end if;

  select t.club_id into v_club_id
  from public.team_seasons ts
  join public.teams t on t.id = ts.team_id
  where ts.id = p_team_season_id;
  if not found then raise exception 'AI_USAGE_TEAM_SEASON_NOT_FOUND'; end if;
  if not exists(
    select 1 from public.player_longitudinal_snapshots s
    where s.id = p_snapshot_id and s.team_season_id = p_team_season_id
  ) then raise exception 'AI_USAGE_SNAPSHOT_SCOPE_MISMATCH'; end if;
  -- Serialize quota decisions for one user/operation/month.
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(p_operation || ':' || v_period_start::text)
  );

  -- A reservation that never reached the provider can release its unit safely.
  update public.ai_usage_ledger
  set status = 'EXPIRED', reserved_units = 0, completed_at = now(),
      failure_code = 'AI_USAGE_RESERVATION_EXPIRED'
  where user_id = p_user_id
    and operation = p_operation
    and billing_period_start = v_period_start
    and status = 'RESERVED'
    and reserved_at < now() - interval '5 minutes';

  -- Once the provider started, a stale request still counts as consumed.
  update public.ai_usage_ledger
  set status = 'FAILED', reserved_units = 0, consumed_units = 1,
      completed_at = now(), failure_code = 'AI_USAGE_STALE_IN_PROGRESS'
  where user_id = p_user_id
    and operation = p_operation
    and billing_period_start = v_period_start
    and status = 'IN_PROGRESS'
    and provider_started_at < now() - interval '15 minutes';

  select * into v_existing
  from public.ai_usage_ledger l
  where l.user_id = p_user_id
    and l.operation = p_operation
    and l.idempotency_key = p_idempotency_key
  for update;

  if v_existing.id is not null and (
    v_existing.team_season_id <> p_team_season_id
    or v_existing.snapshot_id <> p_snapshot_id
  ) then raise exception 'AI_USAGE_IDEMPOTENCY_SCOPE_CONFLICT'; end if;
  if v_existing.id is not null and v_existing.status <> 'EXPIRED' then
    v_used := public.iq_ai_monthly_units(p_user_id, p_operation, v_period_start);
    return jsonb_build_object(
      'accepted', false,
      'replayed', v_existing.status = 'SUCCEEDED',
      'ledger_id', v_existing.id,
      'state', v_existing.status,
      'insight_id', v_existing.insight_id,
      'failure_code', v_existing.failure_code,
      'used', v_used,
      'limit', v_existing.quota_limit
    );
  end if;

  v_used := public.iq_ai_monthly_units(p_user_id, p_operation, v_period_start);
  if v_used >= p_monthly_limit then
    return jsonb_build_object(
      'accepted', false,
      'replayed', false,
      'state', 'DENIED',
      'reason', 'QUOTA_EXCEEDED',
      'used', v_used,
      'limit', p_monthly_limit
    );
  end if;

  if v_existing.id is not null then
    update public.ai_usage_ledger
    set team_season_id = p_team_season_id,
        snapshot_id = p_snapshot_id,
        club_id = v_club_id,
        billing_period_start = v_period_start,
        status = 'RESERVED', quota_limit = p_monthly_limit,
        reserved_units = 1, consumed_units = 0,
        attempt_count = attempt_count + 1,
        provider = null, model_name = null, provider_request_id = null,
        insight_id = null, input_tokens = null, output_tokens = null,
        latency_ms = null, failure_code = null,
        reserved_at = now(), provider_started_at = null, completed_at = null
    where id = v_existing.id
    returning id into v_ledger_id;
  else
    insert into public.ai_usage_ledger(
      operation,idempotency_key,user_id,club_id,team_season_id,snapshot_id,
      billing_period_start,status,quota_limit,reserved_units,consumed_units
    ) values (
      p_operation,p_idempotency_key,p_user_id,v_club_id,p_team_season_id,p_snapshot_id,
      v_period_start,'RESERVED',p_monthly_limit,1,0
    ) returning id into v_ledger_id;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'replayed', false,
    'ledger_id', v_ledger_id,
    'state', 'RESERVED',
    'used', v_used + 1,
    'limit', p_monthly_limit
  );
end;
$$;

revoke all on function public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)
  from public, anon, authenticated;
grant execute on function public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)
  to service_role;

create or replace function public.iq_ai_mark_provider_started(
  p_ledger_id uuid,
  p_user_id uuid,
  p_provider text,
  p_model_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_usage_ledger%rowtype;
begin
  if length(trim(coalesce(p_provider,''))) = 0
     or length(trim(coalesce(p_model_name,''))) = 0 then
    raise exception 'AI_USAGE_PROVIDER_TRACE_REQUIRED';
  end if;

  select * into v_row from public.ai_usage_ledger
  where id = p_ledger_id and user_id = p_user_id
  for update;
  if v_row.id is null then raise exception 'AI_USAGE_LEDGER_NOT_FOUND'; end if;

  if v_row.status = 'IN_PROGRESS' then
    return jsonb_build_object('ledger_id',v_row.id,'state',v_row.status);
  end if;
  if v_row.status <> 'RESERVED' then
    raise exception 'AI_USAGE_RESERVATION_NOT_ACTIVE';
  end if;

  update public.ai_usage_ledger
  set status='IN_PROGRESS', reserved_units=0, consumed_units=1,
      provider=upper(trim(p_provider)), model_name=trim(p_model_name),
      provider_started_at=now()
  where id=v_row.id;

  return jsonb_build_object('ledger_id',v_row.id,'state','IN_PROGRESS');
end;
$$;

revoke all on function public.iq_ai_mark_provider_started(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.iq_ai_mark_provider_started(uuid,uuid,text,text)
  to service_role;
create or replace function public.iq_ai_complete_usage(
  p_ledger_id uuid,
  p_user_id uuid,
  p_insight_id uuid,
  p_provider_request_id text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_latency_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_usage_ledger%rowtype;
  v_used integer;
begin
  select * into v_row from public.ai_usage_ledger
  where id=p_ledger_id and user_id=p_user_id
  for update;
  if v_row.id is null then raise exception 'AI_USAGE_LEDGER_NOT_FOUND'; end if;
  if v_row.status='SUCCEEDED' then
    v_used := public.iq_ai_monthly_units(v_row.user_id,v_row.operation,v_row.billing_period_start);
    return jsonb_build_object('ledger_id',v_row.id,'state','SUCCEEDED','used',v_used,'limit',v_row.quota_limit);
  end if;
  if v_row.status <> 'IN_PROGRESS' then raise exception 'AI_USAGE_NOT_IN_PROGRESS'; end if;

  if not exists(
    select 1 from public.player_ai_insights i
    where i.id=p_insight_id and i.requested_by=p_user_id
      and i.snapshot_id=v_row.snapshot_id and i.team_season_id=v_row.team_season_id
  ) then raise exception 'AI_USAGE_INSIGHT_SCOPE_MISMATCH'; end if;
  update public.ai_usage_ledger
  set status='SUCCEEDED', reserved_units=0, consumed_units=1,
      insight_id=p_insight_id,
      provider_request_id=nullif(trim(coalesce(p_provider_request_id,'')),''),
      input_tokens=case when p_input_tokens is null then null else greatest(0,p_input_tokens) end,
      output_tokens=case when p_output_tokens is null then null else greatest(0,p_output_tokens) end,
      latency_ms=case when p_latency_ms is null then null else greatest(0,p_latency_ms) end,
      failure_code=null, completed_at=now()
  where id=v_row.id;

  v_used := public.iq_ai_monthly_units(v_row.user_id,v_row.operation,v_row.billing_period_start);
  return jsonb_build_object(
    'ledger_id',v_row.id,'state','SUCCEEDED',
    'used',v_used,'limit',v_row.quota_limit
  );
end;
$$;

revoke all on function public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)
  to service_role;

create or replace function public.iq_ai_fail_usage(
  p_ledger_id uuid,
  p_user_id uuid,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_usage_ledger%rowtype;
  v_code text;
  v_used integer;
begin
  v_code := left(
    regexp_replace(upper(trim(coalesce(p_failure_code,'AI_GATEWAY_GENERATION_FAILED'))),
      '[^A-Z0-9_]+','_','g'),
    120
  );
  if v_code = '' then v_code := 'AI_GATEWAY_GENERATION_FAILED'; end if;

  select * into v_row from public.ai_usage_ledger
  where id=p_ledger_id and user_id=p_user_id
  for update;
  if v_row.id is null then raise exception 'AI_USAGE_LEDGER_NOT_FOUND'; end if;

  if v_row.status='SUCCEEDED' then
    v_used := public.iq_ai_monthly_units(v_row.user_id,v_row.operation,v_row.billing_period_start);
    return jsonb_build_object('ledger_id',v_row.id,'state','SUCCEEDED','used',v_used,'limit',v_row.quota_limit);
  end if;
  if v_row.status='FAILED' then
    v_used := public.iq_ai_monthly_units(v_row.user_id,v_row.operation,v_row.billing_period_start);
    return jsonb_build_object('ledger_id',v_row.id,'state','FAILED','used',v_used,'limit',v_row.quota_limit);
  end if;
  if v_row.status not in ('RESERVED','IN_PROGRESS') then
    raise exception 'AI_USAGE_FAILURE_STATE_INVALID';
  end if;

  update public.ai_usage_ledger
  set status='FAILED', reserved_units=0,
      consumed_units=case when v_row.status='IN_PROGRESS' then 1 else 0 end,
      failure_code=v_code, completed_at=now()
  where id=v_row.id;
  v_used := public.iq_ai_monthly_units(v_row.user_id,v_row.operation,v_row.billing_period_start);
  return jsonb_build_object(
    'ledger_id',v_row.id,'state','FAILED',
    'used',v_used,'limit',v_row.quota_limit,
    'consumed',case when v_row.status='IN_PROGRESS' then 1 else 0 end
  );
end;
$$;

revoke all on function public.iq_ai_fail_usage(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.iq_ai_fail_usage(uuid,uuid,text)
  to service_role;

-- No browser role can inspect or mutate the commercial usage ledger directly.
revoke all on function public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)
  from anon, authenticated;
revoke all on function public.iq_ai_mark_provider_started(uuid,uuid,text,text)
  from anon, authenticated;
revoke all on function public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)
  from anon, authenticated;
revoke all on function public.iq_ai_fail_usage(uuid,uuid,text)
  from anon, authenticated;

commit;

select
  'AI_USAGE_LEDGER_V1_APPLY' as section,
  to_regclass('public.ai_usage_ledger') is not null as ledger_installed,
  to_regprocedure('public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)') is not null as reserve_rpc_installed,
  to_regprocedure('public.iq_ai_mark_provider_started(uuid,uuid,text,text)') is not null as provider_rpc_installed,
  to_regprocedure('public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)') is not null as complete_rpc_installed,
  to_regprocedure('public.iq_ai_fail_usage(uuid,uuid,text)') is not null as fail_rpc_installed;