-- =============================================================================
-- IQBasket v3 · PHASE 3D FUNCTIONAL SMOKE TEST · INSTALLED WORKFLOW · ROLLBACK
-- Date: 2026-09-02
--
-- PURPOSE
-- Exercise the already-installed persistent transfer workflow without changing
-- production data. Synthetic player + requests exist only inside this
-- transaction and are discarded by the final ROLLBACK.
--
-- Tests:
--   1) request -> PENDING
--   2) duplicate pending request blocked
--   3) reject + audit reason
--   4) re-request after rejection
--   5) approve -> temporal transfer
--   6) source/target eligibility boundary
--   7) stale competing request -> CANCELLED when a third team exists
--   8) inactive historical source cannot originate a new request
--
-- SAFETY
-- - Exactly one BEGIN
-- - Zero COMMIT
-- - Exactly one final ROLLBACK
-- =============================================================================

begin;

-- Use one existing global SUPERADMIN only as an authenticated execution context.
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
  v_source_date date;
  v_target_date date;

  v_created jsonb;
  v_request jsonb;
  v_rejected jsonb;
  v_approved jsonb;

  v_player_id uuid;
  v_request_rejected_id uuid;
  v_request_approved_id uuid;
  v_competing_request_id uuid;

  v_status text;
  v_reason text;
  v_expected_error boolean;
begin
  -- ---------------------------------------------------------------------------
  -- 0. Preconditions
  -- ---------------------------------------------------------------------------
  if auth.uid() is null then
    raise exception 'SMOKE_3D_AUTH_CONTEXT_NOT_SET';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SMOKE_3D_REQUIRES_GLOBAL_SUPERADMIN';
  end if;

  if to_regclass('public.roster_transfer_requests') is null
     or to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is null
     or to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is null
     or to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is null
     or to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is null then
    raise exception 'PHASE3D_NOT_INSTALLED';
  end if;

  -- Pick one global season with at least two linked team-seasons and a usable
  -- two-day transfer window. Open-ended season bounds are supported.
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
    raise exception 'SMOKE_3D_NEEDS_TWO_TEAM_SEASONS';
  end if;

  if v_season_start is not null then
    v_source_date := v_season_start;
  elsif v_season_end is not null then
    v_source_date := v_season_end - 1;
  else
    v_source_date := current_date - 1;
  end if;

  v_target_date := v_source_date + 1;

  if v_season_end is not null and v_target_date > v_season_end then
    raise exception 'SMOKE_3D_NO_TWO_DAY_TRANSFER_WINDOW';
  end if;

  select ts.id
    into v_alt_target_team_season_id
  from public.team_seasons ts
  where ts.season_id = v_season_id
    and ts.id not in (v_source_team_season_id, v_target_team_season_id)
  order by ts.id
  limit 1;

  -- ---------------------------------------------------------------------------
  -- A. Create one synthetic active source player.
  -- ---------------------------------------------------------------------------
  v_created := public.iq_v3_create_player_for_roster(
    v_source_team_season_id,
    'ZZ_SMOKE_3D',
    'TEMP_PLAYER',
    92,
    'Base',
    v_source_date
  );

  v_player_id := (v_created ->> 'player_id')::uuid;

  if v_player_id is null then
    raise exception 'ASSERT_3D_SMOKE_PLAYER_CREATE_FAILED';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_source_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_SOURCE_NOT_ELIGIBLE';
  end if;

  -- ---------------------------------------------------------------------------
  -- B. First request -> PENDING.
  -- ---------------------------------------------------------------------------
  v_request := public.iq_v3_request_transfer(
    v_player_id,
    v_source_team_season_id,
    v_target_team_season_id
  );

  v_request_rejected_id := (v_request ->> 'id')::uuid;

  select r.status
    into v_status
  from public.roster_transfer_requests r
  where r.id = v_request_rejected_id;

  if v_request_rejected_id is null or v_status <> 'PENDING' then
    raise exception 'ASSERT_3D_SMOKE_REQUEST_NOT_PENDING: %', v_status;
  end if;

  -- ---------------------------------------------------------------------------
  -- C. Exact duplicate pending request must be blocked.
  -- ---------------------------------------------------------------------------
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
    raise exception 'ASSERT_3D_SMOKE_DUPLICATE_PENDING_NOT_BLOCKED';
  end if;

  -- ---------------------------------------------------------------------------
  -- D. Reject and preserve audit reason; roster must not move.
  -- ---------------------------------------------------------------------------
  v_rejected := public.iq_v3_reject_transfer_request(
    v_request_rejected_id,
    'SMOKE_REJECTION'
  );

  select r.status, r.rejection_reason
    into v_status, v_reason
  from public.roster_transfer_requests r
  where r.id = v_request_rejected_id;

  if v_status <> 'REJECTED' or v_reason <> 'SMOKE_REJECTION' then
    raise exception 'ASSERT_3D_SMOKE_REJECTION_AUDIT_FAILED: % / %',
      v_status, v_reason;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_source_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_REJECTION_CHANGED_SOURCE';
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_target_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_REJECTION_CHANGED_TARGET';
  end if;

  -- ---------------------------------------------------------------------------
  -- E. Re-request after rejection is allowed.
  -- ---------------------------------------------------------------------------
  v_request := public.iq_v3_request_transfer(
    v_player_id,
    v_source_team_season_id,
    v_target_team_season_id
  );

  v_request_approved_id := (v_request ->> 'id')::uuid;

  if v_request_approved_id is null
     or v_request_approved_id = v_request_rejected_id then
    raise exception 'ASSERT_3D_SMOKE_REREQUEST_FAILED';
  end if;

  -- Optional third-destination competing request.
  if v_alt_target_team_season_id is not null then
    v_request := public.iq_v3_request_transfer(
      v_player_id,
      v_source_team_season_id,
      v_alt_target_team_season_id
    );
    v_competing_request_id := (v_request ->> 'id')::uuid;
  end if;

  -- ---------------------------------------------------------------------------
  -- F. Approve second request -> atomic temporal transfer.
  -- ---------------------------------------------------------------------------
  v_approved := public.iq_v3_approve_transfer_request(
    v_request_approved_id,
    v_source_date,
    v_target_date
  );

  select r.status
    into v_status
  from public.roster_transfer_requests r
  where r.id = v_request_approved_id;

  if v_status <> 'APPROVED' then
    raise exception 'ASSERT_3D_SMOKE_APPROVAL_STATUS_FAILED: %', v_status;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_source_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_SOURCE_LAST_DAY_NOT_ELIGIBLE';
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_target_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_SOURCE_AFTER_TRANSFER_ELIGIBLE';
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_source_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_TARGET_BEFORE_TRANSFER_ELIGIBLE';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_target_date
  ) then
    raise exception 'ASSERT_3D_SMOKE_TARGET_FIRST_DAY_NOT_ELIGIBLE';
  end if;

  -- Competing request, when possible, must be retained for audit but cancelled.
  if v_competing_request_id is not null then
    select r.status, r.rejection_reason
      into v_status, v_reason
    from public.roster_transfer_requests r
    where r.id = v_competing_request_id;

    if v_status <> 'CANCELLED'
       or v_reason <> 'SUPERSEDED_BY_APPROVED_TRANSFER' then
      raise exception 'ASSERT_3D_SMOKE_COMPETING_REQUEST_NOT_CANCELLED: % / %',
        v_status, v_reason;
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- G. Historical source membership is no longer enough to request transfer.
  -- ---------------------------------------------------------------------------
  v_expected_error := false;

  begin
    perform public.iq_v3_request_transfer(
      v_player_id,
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
    raise exception 'ASSERT_3D_SMOKE_INACTIVE_SOURCE_NOT_BLOCKED';
  end if;

  raise notice
    'PHASE3D_FUNCTIONAL_SMOKE_OK player=% rejected_request=% approved_request=% source=% target=% dates=%..% competing_request=%',
    v_player_id,
    v_request_rejected_id,
    v_request_approved_id,
    v_source_team_season_id,
    v_target_team_season_id,
    v_source_date,
    v_target_date,
    v_competing_request_id;
end $$;

reset role;

-- Nothing from the smoke test may persist.
rollback;
