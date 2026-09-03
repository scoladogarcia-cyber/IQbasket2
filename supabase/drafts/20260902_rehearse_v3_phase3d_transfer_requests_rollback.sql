-- =============================================================================
-- IQBasket v3 · PHASE 3D FULL REHEARSAL · PERSISTENT TRANSFERS · FORCED ROLLBACK
-- Date: 2026-09-02
--
-- Derived from the exact current Phase-3D migration on this branch.
-- Runs DDL + functional workflow in one transaction and ALWAYS rolls back.
-- No production state or synthetic player/request is allowed to persist.
--
-- Expected success notice: PHASE3D_REHEARSAL_OK ...
-- =============================================================================

-- =============================================================================
-- IQBasket v3 · Phase 3D · Persistent transfer requests
-- Date: 2026-09-02
--
-- Scope:
-- - Persist transfer requests across devices/sessions.
-- - Keep request / approve / reject as independent backend actions.
-- - Execute approved moves through iq_v3_transfer_player(), preserving temporal
--   roster history and game-date eligibility.
-- - Temporary approval policy remains SUPERADMIN-only until dual
--   source/destination approval is introduced.
--
-- SAFETY:
-- - Additive migration.
-- - Does not delete players, memberships, stints, games, stats or events.
-- - Does not run automatically; apply only after Phase 3C has been rehearsed.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.players') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null then
    raise exception 'PHASE1_AND_PHASE3C_REQUIRED';
  end if;

  if to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is null
     or to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is null then
    raise exception 'PHASE3C_TRANSFER_BACKEND_REQUIRED';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Persistent workflow table
-- -----------------------------------------------------------------------------
create table if not exists public.roster_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  from_team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  to_team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  status text not null default 'PENDING',
  workflow_version text not null default 'SUPERADMIN_SINGLE_V1',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_last_date_from date,
  approved_first_date_to date,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_transfer_request_distinct_scope
    check (from_team_season_id <> to_team_season_id),
  constraint roster_transfer_request_status
    check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  constraint roster_transfer_request_approved_dates
    check (
      status <> 'APPROVED'
      or (
        approved_last_date_from is not null
        and approved_first_date_to is not null
        and approved_first_date_to > approved_last_date_from
      )
    )
);

create index if not exists idx_roster_transfer_requests_target_status
  on public.roster_transfer_requests(to_team_season_id, status, requested_at desc);

create index if not exists idx_roster_transfer_requests_source_status
  on public.roster_transfer_requests(from_team_season_id, status, requested_at desc);

create index if not exists idx_roster_transfer_requests_player
  on public.roster_transfer_requests(player_id, requested_at desc);

create unique index if not exists uq_roster_transfer_request_pending
  on public.roster_transfer_requests(
    player_id,
    from_team_season_id,
    to_team_season_id
  )
  where status = 'PENDING';

comment on table public.roster_transfer_requests is
'Persistent auditable workflow for player transfers between team-seasons. Approved requests execute the temporal roster transfer RPC; history is never rewritten.';

-- -----------------------------------------------------------------------------
-- 2. Independent authorization boundaries
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_can_request_transfer(
  p_to_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.iq_v3_can_manage_team_season(p_to_team_season_id);
$$;

create or replace function public.iq_v3_can_approve_transfer_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.iq_v3_is_global_superadmin();
$$;

revoke all on function public.iq_v3_can_request_transfer(uuid) from public;
revoke all on function public.iq_v3_can_approve_transfer_request() from public;
grant execute on function public.iq_v3_can_request_transfer(uuid) to authenticated;
grant execute on function public.iq_v3_can_approve_transfer_request() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RLS: read relevant requests, mutate only through RPC
-- -----------------------------------------------------------------------------
alter table public.roster_transfer_requests enable row level security;

revoke all on table public.roster_transfer_requests from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.roster_transfer_requests
  from authenticated;
grant select on table public.roster_transfer_requests to authenticated;

drop policy if exists iq_v3_transfer_request_select_authorized
  on public.roster_transfer_requests;

create policy iq_v3_transfer_request_select_authorized
  on public.roster_transfer_requests
  for select
  to authenticated
  using (
    public.iq_v3_is_global_superadmin()
    or public.iq_v3_can_manage_team_season(from_team_season_id)
    or public.iq_v3_can_manage_team_season(to_team_season_id)
  );

-- -----------------------------------------------------------------------------
-- 4. Capability probe for safe frontend rollout
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_transfer_request_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'persistent_requests', true,
    'request_action_separated', true,
    'approve_action_separated', true,
    'approval_model', 'SUPERADMIN_SINGLE_V1'
  );
$$;

revoke all on function public.iq_v3_transfer_request_capabilities() from public;
grant execute on function public.iq_v3_transfer_request_capabilities() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Request a transfer
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_request_transfer(
  p_player_id uuid,
  p_from_team_season_id uuid,
  p_to_team_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_season_id uuid;
  target_season_id uuid;
  request_row public.roster_transfer_requests;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_from_team_season_id = p_to_team_season_id then
    raise exception 'SOURCE_AND_TARGET_SCOPE_MUST_DIFFER';
  end if;

  if not public.iq_v3_can_request_transfer(p_to_team_season_id) then
    raise exception 'TRANSFER_REQUEST_DENIED';
  end if;

  select ts.season_id
    into source_season_id
  from public.team_seasons ts
  where ts.id = p_from_team_season_id;

  select ts.season_id
    into target_season_id
  from public.team_seasons ts
  where ts.id = p_to_team_season_id;

  if source_season_id is null or target_season_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if source_season_id is distinct from target_season_id then
    raise exception 'TRANSFER_REQUIRES_SAME_GLOBAL_SEASON';
  end if;

  -- A transfer request must originate from a genuinely active temporal roster
  -- stint. An audit-only membership left behind after excluding an inherited
  -- player has no stint and must never be treated as a transferable player.
  if not exists (
    select 1
    from public.roster_memberships rm
    join public.roster_membership_stints rs
      on rs.roster_membership_id = rm.id
    where rm.player_id = p_player_id
      and rm.team_season_id = p_from_team_season_id
      and rs.valid_until is null
  ) then
    raise exception 'PLAYER_NOT_ACTIVE_IN_SOURCE_TEAM_SEASON';
  end if;

  insert into public.roster_transfer_requests (
    player_id,
    from_team_season_id,
    to_team_season_id,
    status,
    requested_by
  )
  values (
    p_player_id,
    p_from_team_season_id,
    p_to_team_season_id,
    'PENDING',
    auth.uid()
  )
  returning * into request_row;

  return to_jsonb(request_row);
exception
  when unique_violation then
    raise exception 'TRANSFER_REQUEST_ALREADY_PENDING';
end;
$$;

revoke all on function public.iq_v3_request_transfer(uuid,uuid,uuid) from public;
grant execute on function public.iq_v3_request_transfer(uuid,uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Approve: lock request, execute temporal transfer, then audit decision
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_approve_transfer_request(
  p_request_id uuid,
  p_last_date_from date,
  p_first_date_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.roster_transfer_requests;
  transfer_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_approve_transfer_request() then
    raise exception 'TRANSFER_APPROVAL_DENIED';
  end if;

  if p_last_date_from is null or p_first_date_to is null then
    raise exception 'TRANSFER_DATES_REQUIRED';
  end if;

  if p_first_date_to <= p_last_date_from then
    raise exception 'TARGET_START_MUST_BE_AFTER_SOURCE_END';
  end if;

  select *
    into request_row
  from public.roster_transfer_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'TRANSFER_REQUEST_NOT_FOUND';
  end if;

  if request_row.status <> 'PENDING' then
    raise exception 'TRANSFER_REQUEST_NOT_PENDING';
  end if;

  transfer_result := public.iq_v3_transfer_player(
    request_row.player_id,
    request_row.from_team_season_id,
    request_row.to_team_season_id,
    p_last_date_from,
    p_first_date_to,
    null,
    null
  );

  update public.roster_transfer_requests
     set status = 'APPROVED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         approved_last_date_from = p_last_date_from,
         approved_first_date_to = p_first_date_to,
         rejection_reason = null,
         updated_at = now()
   where id = request_row.id
   returning * into request_row;

  -- Once one request moves the player out of the source team-season, any other
  -- pending request from that same source becomes stale. Preserve it for audit
  -- but close it deterministically instead of leaving an impossible PENDING row.
  update public.roster_transfer_requests
     set status = 'CANCELLED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = 'SUPERSEDED_BY_APPROVED_TRANSFER',
         updated_at = now()
   where id <> request_row.id
     and player_id = request_row.player_id
     and from_team_season_id = request_row.from_team_season_id
     and status = 'PENDING';

  return jsonb_build_object(
    'request', to_jsonb(request_row),
    'transfer', transfer_result
  );
end;
$$;

revoke all on function public.iq_v3_approve_transfer_request(uuid,date,date) from public;
grant execute on function public.iq_v3_approve_transfer_request(uuid,date,date) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Reject: audit without changing roster history
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_reject_transfer_request(
  p_request_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.roster_transfer_requests;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_approve_transfer_request() then
    raise exception 'TRANSFER_REJECTION_DENIED';
  end if;

  select *
    into request_row
  from public.roster_transfer_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'TRANSFER_REQUEST_NOT_FOUND';
  end if;

  if request_row.status <> 'PENDING' then
    raise exception 'TRANSFER_REQUEST_NOT_PENDING';
  end if;

  update public.roster_transfer_requests
     set status = 'REJECTED',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = nullif(trim(coalesce(p_reason, '')), ''),
         updated_at = now()
   where id = request_row.id
   returning * into request_row;

  return to_jsonb(request_row);
end;
$$;

revoke all on function public.iq_v3_reject_transfer_request(uuid,text) from public;
grant execute on function public.iq_v3_reject_transfer_request(uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- REHEARSAL ASSERTIONS + FUNCTIONAL WORKFLOW (still inside same transaction)
-- -----------------------------------------------------------------------------

-- Establish an authenticated global SUPERADMIN context for RPC/RLS checks.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', coalesce(up.email, ''),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role, '')) = 'SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $$
declare
  v_source_team_season_id uuid;
  v_target_team_season_id uuid;
  v_alt_target_team_season_id uuid;
  v_season_id uuid;
  v_season_start date;
  v_season_end date;
  v_source_first date;
  v_source_last date;
  v_target_first date;

  v_created jsonb;
  v_request jsonb;
  v_approved jsonb;
  v_rejected jsonb;
  v_player_id uuid;
  v_inactive_player_id uuid;
  v_request_id uuid;
  v_second_request_id uuid;
  v_competing_request_id uuid;
  v_status text;
  v_reason text;
  v_before_target boolean;
  v_expected_error boolean;
begin
  if auth.uid() is null then
    raise exception 'REHEARSAL_AUTH_CONTEXT_NOT_SET';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'REHEARSAL_REQUIRES_GLOBAL_SUPERADMIN';
  end if;

  -- Structural assertions for freshly installed 3D objects.
  if to_regclass('public.roster_transfer_requests') is null then
    raise exception 'REHEARSAL_3D_TABLE_MISSING';
  end if;

  if to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is null
     or to_regprocedure('public.iq_v3_can_approve_transfer_request()') is null
     or to_regprocedure('public.iq_v3_transfer_request_capabilities()') is null
     or to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is null
     or to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is null
     or to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is null then
    raise exception 'REHEARSAL_3D_RPC_MISSING';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'roster_transfer_requests'
      and policyname = 'iq_v3_transfer_request_select_authorized'
  ) then
    raise exception 'REHEARSAL_3D_RLS_POLICY_MISSING';
  end if;

  -- Choose two team-seasons from one global season with a usable two-date
  -- transfer window. Open-ended seasons are supported.
  select
    q.season_id,
    q.start_date,
    q.end_date,
    q.source_id,
    q.target_id
    into
      v_season_id,
      v_season_start,
      v_season_end,
      v_source_team_season_id,
      v_target_team_season_id
  from (
    select
      sc.id as season_id,
      sc.start_date,
      sc.end_date,
      min(ts.id::text)::uuid as source_id,
      max(ts.id::text)::uuid as target_id,
      count(*) as linked_teams
    from public.season_catalog sc
    join public.team_seasons ts on ts.season_id = sc.id
    where sc.start_date is null
       or sc.end_date is null
       or sc.end_date >= sc.start_date + 1
    group by sc.id, sc.start_date, sc.end_date
    having count(*) >= 2
    order by coalesce(sc.start_date, sc.end_date, current_date) desc
    limit 1
  ) q;

  if v_source_team_season_id is null
     or v_target_team_season_id is null
     or v_source_team_season_id = v_target_team_season_id then
    raise exception 'REHEARSAL_3D_NEEDS_TWO_TEAM_SEASONS_WITH_TWO_USABLE_DATES';
  end if;

  if v_season_start is not null then
    v_source_first := v_season_start;
  elsif v_season_end is not null then
    v_source_first := v_season_end - 1;
  else
    v_source_first := current_date - 1;
  end if;

  v_source_last := v_source_first;
  v_target_first := v_source_last + 1;

  if v_season_end is not null and v_target_first > v_season_end then
    raise exception 'REHEARSAL_3D_TRANSFER_WINDOW_OUTSIDE_SEASON';
  end if;

  -- Optional third team-season for competing-request cancellation test.
  select ts.id
    into v_alt_target_team_season_id
  from public.team_seasons ts
  where ts.season_id = v_season_id
    and ts.id not in (v_source_team_season_id, v_target_team_season_id)
  order by ts.id
  limit 1;

  -- A. Create a synthetic player in source scope through the real 3C RPC.
  v_created := public.iq_v3_create_player_for_roster(
    v_source_team_season_id,
    'ZZ_REHEARSAL_3D',
    'TEMP_PLAYER',
    95,
    'Base',
    v_source_first
  );
  v_player_id := (v_created ->> 'player_id')::uuid;

  if v_player_id is null then
    raise exception 'ASSERT_3D_PLAYER_CREATION_FAILED';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_source_last
  ) then
    raise exception 'ASSERT_3D_SOURCE_PLAYER_NOT_ELIGIBLE';
  end if;

  -- B. Create persistent request.
  v_request := public.iq_v3_request_transfer(
    v_player_id,
    v_source_team_season_id,
    v_target_team_season_id
  );
  v_request_id := (v_request ->> 'id')::uuid;

  select r.status into v_status
  from public.roster_transfer_requests r
  where r.id = v_request_id;

  if v_request_id is null or v_status <> 'PENDING' then
    raise exception 'ASSERT_3D_REQUEST_NOT_PENDING: %', v_status;
  end if;

  -- C. Duplicate same pending request must be rejected.
  v_expected_error := false;
  begin
    perform public.iq_v3_request_transfer(
      v_player_id,
      v_source_team_season_id,
      v_target_team_season_id
    );
  exception when others then
    if sqlerrm = 'TRANSFER_REQUEST_ALREADY_PENDING' then
      v_expected_error := true;
    else
      raise;
    end if;
  end;

  if not v_expected_error then
    raise exception 'ASSERT_3D_DUPLICATE_PENDING_NOT_BLOCKED';
  end if;

  -- D. Reject and confirm audit without moving player.
  v_rejected := public.iq_v3_reject_transfer_request(
    v_request_id,
    'REHEARSAL_REJECTION'
  );

  select r.status, r.rejection_reason
    into v_status, v_reason
  from public.roster_transfer_requests r
  where r.id = v_request_id;

  if v_status <> 'REJECTED' or v_reason <> 'REHEARSAL_REJECTION' then
    raise exception 'ASSERT_3D_REJECTION_AUDIT_FAILED: % / %', v_status, v_reason;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_source_last
  ) then
    raise exception 'ASSERT_3D_REJECTION_CHANGED_SOURCE_ROSTER';
  end if;

  v_before_target := public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_target_first
  );

  if v_before_target then
    raise exception 'ASSERT_3D_REJECTION_CHANGED_TARGET_ROSTER';
  end if;

  -- E. Create a new request after rejection; this must be allowed.
  v_request := public.iq_v3_request_transfer(
    v_player_id,
    v_source_team_season_id,
    v_target_team_season_id
  );
  v_second_request_id := (v_request ->> 'id')::uuid;

  if v_second_request_id is null or v_second_request_id = v_request_id then
    raise exception 'ASSERT_3D_REREQUEST_AFTER_REJECTION_FAILED';
  end if;

  -- Optional competing request to third destination.
  if v_alt_target_team_season_id is not null then
    v_request := public.iq_v3_request_transfer(
      v_player_id,
      v_source_team_season_id,
      v_alt_target_team_season_id
    );
    v_competing_request_id := (v_request ->> 'id')::uuid;
  end if;

  -- F. Approve second request. The temporal transfer and audit must be atomic.
  v_approved := public.iq_v3_approve_transfer_request(
    v_second_request_id,
    v_source_last,
    v_target_first
  );

  select r.status
    into v_status
  from public.roster_transfer_requests r
  where r.id = v_second_request_id;

  if v_status <> 'APPROVED' then
    raise exception 'ASSERT_3D_APPROVAL_STATUS_FAILED: %', v_status;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_source_last
  ) then
    raise exception 'ASSERT_3D_SOURCE_LAST_DAY_NOT_ELIGIBLE';
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_target_first
  ) then
    raise exception 'ASSERT_3D_SOURCE_AFTER_TRANSFER_STILL_ELIGIBLE';
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_source_last
  ) then
    raise exception 'ASSERT_3D_TARGET_BEFORE_TRANSFER_ELIGIBLE';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_target_first
  ) then
    raise exception 'ASSERT_3D_TARGET_FIRST_DAY_NOT_ELIGIBLE';
  end if;

  -- If a third destination existed, approval must preserve but cancel the stale
  -- competing request for audit.
  if v_competing_request_id is not null then
    select r.status, r.rejection_reason
      into v_status, v_reason
    from public.roster_transfer_requests r
    where r.id = v_competing_request_id;

    if v_status <> 'CANCELLED'
       or v_reason <> 'SUPERSEDED_BY_APPROVED_TRANSFER' then
      raise exception 'ASSERT_3D_COMPETING_REQUEST_NOT_CANCELLED: % / %',
        v_status, v_reason;
    end if;
  end if;

  -- G. A player with a closed source stint must not be requestable merely
  -- because their historical membership row still exists.
  v_created := public.iq_v3_create_player_for_roster(
    v_source_team_season_id,
    'ZZ_REHEARSAL_3D_INACTIVE',
    'TEMP_PLAYER',
    94,
    'Base',
    v_source_first
  );
  v_inactive_player_id := (v_created ->> 'player_id')::uuid;

  perform public.iq_v3_set_roster_member(
    v_source_team_season_id,
    v_inactive_player_id,
    'INACTIVE',
    null,
    null,
    v_source_last
  );

  v_expected_error := false;
  begin
    perform public.iq_v3_request_transfer(
      v_inactive_player_id,
      v_source_team_season_id,
      v_target_team_season_id
    );
  exception when others then
    if sqlerrm = 'PLAYER_NOT_ACTIVE_IN_SOURCE_TEAM_SEASON' then
      v_expected_error := true;
    else
      raise;
    end if;
  end;

  if not v_expected_error then
    raise exception 'ASSERT_3D_INACTIVE_SOURCE_REQUEST_NOT_BLOCKED';
  end if;

  raise notice
    'PHASE3D_REHEARSAL_OK player=% rejected_request=% approved_request=% source=% target=% dates=%..% competing_request=%',
    v_player_id,
    v_request_id,
    v_second_request_id,
    v_source_team_season_id,
    v_target_team_season_id,
    v_source_last,
    v_target_first,
    v_competing_request_id;
end $$;

reset role;

-- CRITICAL: Phase 3D rehearsal and all synthetic rows are discarded.
rollback;
