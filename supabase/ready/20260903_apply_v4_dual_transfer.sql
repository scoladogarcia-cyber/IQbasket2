-- =============================================================================
-- IQBasket V4 · Dual-side transfer review
-- Destination requests; source and destination administrators review independently;
-- SUPERADMIN remains the technical finalizer using the already-proven V3 transfer RPC.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Additive workflow metadata and review ledger.
-- -----------------------------------------------------------------------------
alter table public.roster_transfer_requests
  add column if not exists requested_first_date_to date;

create table if not exists public.roster_transfer_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references public.roster_transfer_requests(id) on delete cascade,
  side text not null,
  decision text not null default 'PENDING',
  effective_date date,
  reviewer_id uuid,
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_transfer_reviews_side_check
    check (side in ('SOURCE','DESTINATION')),
  constraint roster_transfer_reviews_decision_check
    check (decision in ('PENDING','APPROVED','REJECTED')),
  constraint roster_transfer_reviews_effective_date_check
    check (decision <> 'APPROVED' or effective_date is not null),
  constraint roster_transfer_reviews_reviewer_check
    check (
      decision = 'PENDING'
      or (reviewer_id is not null and reviewed_at is not null)
    ),
  constraint roster_transfer_reviews_request_side_unique
    unique (request_id, side)
);

create index if not exists ix_roster_transfer_reviews_request
  on public.roster_transfer_reviews(request_id);

create index if not exists ix_roster_transfer_reviews_decision
  on public.roster_transfer_reviews(decision, side);

comment on table public.roster_transfer_reviews is
'Independent source/destination decisions for auditable dual-review roster transfers.';

-- -----------------------------------------------------------------------------
-- 2. Authorization and date helpers.
-- Review authority is intentionally narrower than general roster management:
-- ADMIN / COORDINADOR / DIRECTOR_DEPORTIVO, plus global SUPERADMIN.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v4_can_review_transfer_scope(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      public.iq_v3_is_global_superadmin()
      or exists (
        select 1
        from public.team_season_memberships m
        where m.user_id = auth.uid()
          and m.team_season_id = p_team_season_id
          and upper(coalesce(m.status, '')) = 'ACTIVE'
          and upper(coalesce(m.function_role, '')) in (
            'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'
          )
      )
      or exists (
        select 1
        from public.team_seasons ts
        join public.teams t on t.id = ts.team_id
        join public.club_season_memberships cm
          on cm.club_id = t.club_id
         and cm.season_id = ts.season_id
        where ts.id = p_team_season_id
          and cm.user_id = auth.uid()
          and upper(coalesce(cm.status, '')) = 'ACTIVE'
          and upper(coalesce(cm.function_role, '')) in (
            'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'
          )
      )
    );
$$;

create or replace function public.iq_v4_date_within_team_season(
  p_team_season_id uuid,
  p_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_date is not null
    and exists (
      select 1
      from public.team_seasons ts
      join public.season_catalog sc on sc.id = ts.season_id
      where ts.id = p_team_season_id
        and (sc.start_date is null or p_date >= sc.start_date)
        and (sc.end_date is null or p_date <= sc.end_date)
    );
$$;

create or replace function public.iq_v4_dual_transfer_reviews_ready(
  p_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where decision = 'APPROVED') = 2
    and count(*) filter (
      where decision = 'APPROVED' and effective_date is not null
    ) = 2
  from public.roster_transfer_reviews
  where request_id = p_request_id
    and side in ('SOURCE','DESTINATION');
$$;

revoke all on function public.iq_v4_can_review_transfer_scope(uuid) from public, anon;
revoke all on function public.iq_v4_date_within_team_season(uuid,date) from public, anon;
revoke all on function public.iq_v4_dual_transfer_reviews_ready(uuid) from public, anon;

grant execute on function public.iq_v4_can_review_transfer_scope(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. RLS: reviews are readable by involved scopes/requester, never directly writable.
-- -----------------------------------------------------------------------------
alter table public.roster_transfer_reviews enable row level security;

revoke all on table public.roster_transfer_reviews from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.roster_transfer_reviews
  from authenticated;
grant select on table public.roster_transfer_reviews to authenticated;

drop policy if exists iq_v4_transfer_reviews_select_authorized
  on public.roster_transfer_reviews;

create policy iq_v4_transfer_reviews_select_authorized
  on public.roster_transfer_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.roster_transfer_requests r
      where r.id = request_id
        and (
          r.requested_by = auth.uid()
          or public.iq_v3_is_global_superadmin()
          or public.iq_v3_can_manage_team_season(r.from_team_season_id)
          or public.iq_v3_can_manage_team_season(r.to_team_season_id)
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Capability probe for progressive frontend rollout.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v4_transfer_request_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(public.iq_v3_transfer_request_capabilities(), '{}'::jsonb)
    || jsonb_build_object(
      'dual_review', true,
      'workflow_version', 'DUAL_REVIEW_V2',
      'source_review', true,
      'destination_review', true,
      'destination_proposed_date', true,
      'technical_finalizer', 'SUPERADMIN',
      'legacy_requests_supported', true
    );
$$;

revoke all on function public.iq_v4_transfer_request_capabilities() from public, anon;
grant execute on function public.iq_v4_transfer_request_capabilities() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. V4 request: reuse V3 eligibility/uniqueness checks, then initialize reviews.
-- The requester proposes the destination start date. If the requester already
-- has admin-like review authority on destination, that side is auto-approved.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v4_request_transfer(
  p_player_id uuid,
  p_from_team_season_id uuid,
  p_to_team_season_id uuid,
  p_requested_first_date_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_json jsonb;
  v_request_id uuid;
  v_destination_auto_approved boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_requested_first_date_to is null then
    raise exception 'DESTINATION_START_DATE_REQUIRED';
  end if;

  if not public.iq_v4_date_within_team_season(
    p_to_team_season_id,
    p_requested_first_date_to
  ) then
    raise exception 'DESTINATION_START_DATE_OUTSIDE_SEASON';
  end if;

  -- V3 remains the source of truth for same-season, active-source and duplicate checks.
  v_request_json := public.iq_v3_request_transfer(
    p_player_id,
    p_from_team_season_id,
    p_to_team_season_id
  );

  v_request_id := nullif(v_request_json ->> 'id', '')::uuid;
  if v_request_id is null then
    raise exception 'TRANSFER_REQUEST_ID_MISSING';
  end if;

  update public.roster_transfer_requests
     set workflow_version = 'DUAL_REVIEW_V2',
         requested_first_date_to = p_requested_first_date_to,
         updated_at = now()
   where id = v_request_id;

  insert into public.roster_transfer_reviews (
    request_id, side, decision
  )
  values
    (v_request_id, 'SOURCE', 'PENDING'),
    (v_request_id, 'DESTINATION', 'PENDING')
  on conflict (request_id, side) do nothing;

  if public.iq_v4_can_review_transfer_scope(p_to_team_season_id) then
    update public.roster_transfer_reviews
       set decision = 'APPROVED',
           effective_date = p_requested_first_date_to,
           reviewer_id = auth.uid(),
           reviewed_at = now(),
           reason = 'AUTO_APPROVED_BY_DESTINATION_REQUESTER',
           updated_at = now()
     where request_id = v_request_id
       and side = 'DESTINATION'
       and decision = 'PENDING';

    v_destination_auto_approved := found;
  end if;

  return jsonb_build_object(
    'request_id', v_request_id,
    'workflow_version', 'DUAL_REVIEW_V2',
    'requested_first_date_to', p_requested_first_date_to,
    'destination_auto_approved', v_destination_auto_approved,
    'ready_for_finalization',
      public.iq_v4_dual_transfer_reviews_ready(v_request_id)
  );
end;
$$;

revoke all on function public.iq_v4_request_transfer(uuid,uuid,uuid,date)
  from public, anon;
grant execute on function public.iq_v4_request_transfer(uuid,uuid,uuid,date)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Independent source/destination review action.
-- A rejection closes the overall request without touching roster history.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v4_review_transfer_side(
  p_request_id uuid,
  p_side text,
  p_decision text,
  p_effective_date date default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.roster_transfer_requests%rowtype;
  v_side text := upper(trim(coalesce(p_side, '')));
  v_decision text := upper(trim(coalesce(p_decision, '')));
  v_scope_id uuid;
  v_other_date date;
  v_review public.roster_transfer_reviews%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_side not in ('SOURCE','DESTINATION') then
    raise exception 'TRANSFER_REVIEW_SIDE_INVALID';
  end if;

  if v_decision not in ('APPROVED','REJECTED') then
    raise exception 'TRANSFER_REVIEW_DECISION_INVALID';
  end if;

  select *
    into v_request
  from public.roster_transfer_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'TRANSFER_REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'TRANSFER_REQUEST_NOT_PENDING';
  end if;

  if upper(coalesce(v_request.workflow_version, '')) <> 'DUAL_REVIEW_V2' then
    raise exception 'TRANSFER_REQUEST_NOT_DUAL_REVIEW';
  end if;

  v_scope_id := case
    when v_side = 'SOURCE' then v_request.from_team_season_id
    else v_request.to_team_season_id
  end;

  if not public.iq_v4_can_review_transfer_scope(v_scope_id) then
    raise exception 'TRANSFER_SIDE_REVIEW_DENIED';
  end if;

  select *
    into v_review
  from public.roster_transfer_reviews
  where request_id = p_request_id
    and side = v_side
  for update;

  if v_review.id is null then
    raise exception 'TRANSFER_REVIEW_ROW_NOT_FOUND';
  end if;

  if v_review.decision <> 'PENDING' then
    raise exception 'TRANSFER_SIDE_ALREADY_REVIEWED';
  end if;

  if v_decision = 'APPROVED' then
    if p_effective_date is null then
      raise exception 'TRANSFER_REVIEW_EFFECTIVE_DATE_REQUIRED';
    end if;

    if not public.iq_v4_date_within_team_season(v_scope_id, p_effective_date) then
      raise exception 'TRANSFER_REVIEW_DATE_OUTSIDE_SEASON';
    end if;

    if v_side = 'SOURCE' then
      select effective_date
        into v_other_date
      from public.roster_transfer_reviews
      where request_id = p_request_id
        and side = 'DESTINATION'
        and decision = 'APPROVED';

      v_other_date := coalesce(v_other_date, v_request.requested_first_date_to);

      if v_other_date is null or v_other_date <= p_effective_date then
        raise exception 'TARGET_START_MUST_BE_AFTER_SOURCE_END';
      end if;
    else
      select effective_date
        into v_other_date
      from public.roster_transfer_reviews
      where request_id = p_request_id
        and side = 'SOURCE'
        and decision = 'APPROVED';

      if v_other_date is not null and p_effective_date <= v_other_date then
        raise exception 'TARGET_START_MUST_BE_AFTER_SOURCE_END';
      end if;
    end if;
  end if;

  update public.roster_transfer_reviews
     set decision = v_decision,
         effective_date = case when v_decision='APPROVED' then p_effective_date else null end,
         reviewer_id = auth.uid(),
         reviewed_at = now(),
         reason = nullif(trim(p_reason), ''),
         updated_at = now()
   where id = v_review.id;

  if v_decision = 'REJECTED' then
    update public.roster_transfer_requests
       set status = 'REJECTED',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           rejection_reason = coalesce(
             nullif(trim(p_reason), ''),
             v_side || '_REJECTED'
           ),
           updated_at = now()
     where id = p_request_id;
  end if;

  return jsonb_build_object(
    'request_id', p_request_id,
    'side', v_side,
    'decision', v_decision,
    'effective_date', case when v_decision='APPROVED' then p_effective_date else null end,
    'ready_for_finalization',
      public.iq_v4_dual_transfer_reviews_ready(p_request_id)
  );
end;
$$;

revoke all on function public.iq_v4_review_transfer_side(uuid,text,text,date,text)
  from public, anon;
grant execute on function public.iq_v4_review_transfer_side(uuid,text,text,date,text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Harden legacy finalizer for V2 requests.
-- Legacy requests keep old behavior; DUAL_REVIEW_V2 requires both reviews and
-- the exact dates agreed by the two sides.
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
  v_source_review_date date;
  v_destination_review_date date;
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

  if upper(coalesce(request_row.workflow_version, '')) = 'DUAL_REVIEW_V2' then
    if not public.iq_v4_dual_transfer_reviews_ready(request_row.id) then
      raise exception 'DUAL_TRANSFER_REVIEWS_REQUIRED';
    end if;

    select effective_date
      into v_source_review_date
    from public.roster_transfer_reviews
    where request_id = request_row.id
      and side = 'SOURCE'
      and decision = 'APPROVED';

    select effective_date
      into v_destination_review_date
    from public.roster_transfer_reviews
    where request_id = request_row.id
      and side = 'DESTINATION'
      and decision = 'APPROVED';

    if v_source_review_date is distinct from p_last_date_from
       or v_destination_review_date is distinct from p_first_date_to then
      raise exception 'DUAL_TRANSFER_REVIEW_DATES_MISMATCH';
    end if;
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

revoke all on function public.iq_v3_approve_transfer_request(uuid,date,date)
  from public, anon;
grant execute on function public.iq_v3_approve_transfer_request(uuid,date,date)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 8. V4 technical finalization: reviews decide; SUPERADMIN executes trusted V3.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v4_finalize_transfer_request(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.roster_transfer_requests%rowtype;
  v_source_date date;
  v_destination_date date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_REQUIRED_FOR_TRANSFER_FINALIZATION';
  end if;

  select *
    into v_request
  from public.roster_transfer_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'TRANSFER_REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'TRANSFER_REQUEST_NOT_PENDING';
  end if;

  if upper(coalesce(v_request.workflow_version, '')) <> 'DUAL_REVIEW_V2' then
    raise exception 'TRANSFER_REQUEST_NOT_DUAL_REVIEW';
  end if;

  if not public.iq_v4_dual_transfer_reviews_ready(p_request_id) then
    raise exception 'DUAL_TRANSFER_REVIEWS_REQUIRED';
  end if;

  select effective_date into v_source_date
  from public.roster_transfer_reviews
  where request_id = p_request_id
    and side = 'SOURCE'
    and decision = 'APPROVED';

  select effective_date into v_destination_date
  from public.roster_transfer_reviews
  where request_id = p_request_id
    and side = 'DESTINATION'
    and decision = 'APPROVED';

  return public.iq_v3_approve_transfer_request(
    p_request_id,
    v_source_date,
    v_destination_date
  );
end;
$$;

revoke all on function public.iq_v4_finalize_transfer_request(uuid)
  from public, anon;
grant execute on function public.iq_v4_finalize_transfer_request(uuid)
  to authenticated;

commit;
