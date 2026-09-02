-- =============================================================================
-- IQBasket v3 · Rehearsal · Temporal roster + persistent transfers
-- Date: 2026-09-02
--
-- PURPOSE
-- Run ONLY in a non-production rehearsal/staging database AFTER applying:
--   1) 20260902_apply_v3_phase3c_season_roster_backend.sql
--   2) 20260902_apply_v3_phase3d_transfer_requests.sql
--
-- The whole rehearsal runs in one transaction and ALWAYS ends with ROLLBACK.
-- It creates a synthetic player, exercises temporal eligibility and the
-- persistent transfer workflow, asserts expected outcomes, then removes every
-- change by rolling the transaction back.
-- =============================================================================

begin;

-- Resolve the existing global SUPERADMIN while still using the SQL-editor role,
-- then impersonate that authenticated user for the RPC/RLS exercise.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', up.email,
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role, '')) = 'SUPERADMIN'
limit 1;

set local role authenticated;

do $$
declare
  source_team_season_id uuid;
  target_team_season_id uuid;
  test_season_id uuid;
  season_start date;
  season_end date;
  source_start date;
  source_end date;
  target_start date;
  target_end date;
  rejoin_date date;
  created jsonb;
  request_result jsonb;
  approval_result jsonb;
  removal_result jsonb;
  test_player_id uuid;
  request_id uuid;
  target_membership_id uuid;
  stint_count integer;
  request_status text;
begin
  if auth.uid() is null then
    raise exception 'REHEARSAL_AUTH_CONTEXT_NOT_SET';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'REHEARSAL_REQUIRES_GLOBAL_SUPERADMIN';
  end if;

  if to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is null
     or to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is null then
    raise exception 'PHASE3C_AND_PHASE3D_REQUIRED';
  end if;

  -- Choose one global season with at least two linked teams and enough room for
  -- several temporal transitions.
  select
    candidate.season_id,
    candidate.start_date,
    candidate.end_date,
    candidate.first_team_season_id,
    candidate.second_team_season_id
    into
      test_season_id,
      season_start,
      season_end,
      source_team_season_id,
      target_team_season_id
  from (
    select
      sc.id as season_id,
      sc.start_date,
      sc.end_date,
      min(ts.id::text)::uuid as first_team_season_id,
      max(ts.id::text)::uuid as second_team_season_id,
      count(*) as linked_teams
    from public.season_catalog sc
    join public.team_seasons ts on ts.season_id = sc.id
    where sc.start_date is not null
      and sc.end_date is not null
      and sc.end_date >= sc.start_date + 20
    group by sc.id, sc.start_date, sc.end_date
    having count(*) >= 2
    order by sc.start_date desc
    limit 1
  ) candidate;

  if source_team_season_id is null
     or target_team_season_id is null
     or source_team_season_id = target_team_season_id then
    raise exception 'REHEARSAL_NEEDS_TWO_TEAM_SEASONS_IN_ONE_GLOBAL_SEASON';
  end if;

  source_start := season_start + 2;
  source_end := season_start + 7;
  target_start := source_end + 1;
  target_end := target_start + 5;
  rejoin_date := target_end + 2;

  if rejoin_date > season_end then
    raise exception 'REHEARSAL_SELECTED_SEASON_TOO_SHORT';
  end if;

  -- A. Create a permanent player identity with a first source-team stint.
  created := public.iq_v3_create_player_for_roster(
    source_team_season_id,
    'ZZ_REHEARSAL',
    'TEMPORAL_PLAYER',
    98,
    'Base',
    source_start
  );
  test_player_id := (created ->> 'player_id')::uuid;

  if test_player_id is null then
    raise exception 'REHEARSAL_PLAYER_CREATION_FAILED';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    test_player_id,
    source_team_season_id,
    source_start
  ) then
    raise exception 'ASSERT_SOURCE_START_ELIGIBLE_FAILED';
  end if;

  -- B. Persist a request instead of storing anything in browser localStorage.
  request_result := public.iq_v3_request_transfer(
    test_player_id,
    source_team_season_id,
    target_team_season_id
  );
  request_id := (request_result ->> 'id')::uuid;

  if request_id is null then
    raise exception 'REHEARSAL_TRANSFER_REQUEST_FAILED';
  end if;

  select r.status
    into request_status
  from public.roster_transfer_requests r
  where r.id = request_id;

  if request_status <> 'PENDING' then
    raise exception 'ASSERT_REQUEST_PENDING_FAILED: %', request_status;
  end if;

  -- C. Approve atomically with inclusive source end and next target start.
  approval_result := public.iq_v3_approve_transfer_request(
    request_id,
    source_end,
    target_start
  );

  select r.status
    into request_status
  from public.roster_transfer_requests r
  where r.id = request_id;

  if request_status <> 'APPROVED' then
    raise exception 'ASSERT_REQUEST_APPROVED_FAILED: %', request_status;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    test_player_id,
    source_team_season_id,
    source_end
  ) then
    raise exception 'ASSERT_SOURCE_LAST_DAY_ELIGIBLE_FAILED';
  end if;

  if public.iq_v3_player_eligible_on_date(
    test_player_id,
    source_team_season_id,
    target_start
  ) then
    raise exception 'ASSERT_SOURCE_AFTER_TRANSFER_NOT_ELIGIBLE_FAILED';
  end if;

  if public.iq_v3_player_eligible_on_date(
    test_player_id,
    target_team_season_id,
    source_end
  ) then
    raise exception 'ASSERT_TARGET_BEFORE_TRANSFER_NOT_ELIGIBLE_FAILED';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    test_player_id,
    target_team_season_id,
    target_start
  ) then
    raise exception 'ASSERT_TARGET_FIRST_DAY_ELIGIBLE_FAILED';
  end if;

  -- D. Close a real target stint, preserving its historical interval.
  removal_result := public.iq_v3_remove_roster_member(
    target_team_season_id,
    test_player_id,
    target_end
  );

  if coalesce(removal_result ->> 'mode', '') <> 'CLOSED_TEMPORAL_STINT' then
    raise exception 'ASSERT_REAL_REMOVAL_CLOSES_STINT_FAILED: %', removal_result;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    test_player_id,
    target_team_season_id,
    target_end
  ) then
    raise exception 'ASSERT_TARGET_LAST_DAY_ELIGIBLE_FAILED';
  end if;

  if public.iq_v3_player_eligible_on_date(
    test_player_id,
    target_team_season_id,
    target_end + 1
  ) then
    raise exception 'ASSERT_TARGET_AFTER_REMOVAL_NOT_ELIGIBLE_FAILED';
  end if;

  -- E. Rejoin: open a second stint; the previous interval must remain intact.
  perform public.iq_v3_set_roster_member(
    target_team_season_id,
    test_player_id,
    'ACTIVE',
    98,
    'Base',
    rejoin_date
  );

  if not public.iq_v3_player_eligible_on_date(
    test_player_id,
    target_team_season_id,
    rejoin_date
  ) then
    raise exception 'ASSERT_REJOIN_ELIGIBLE_FAILED';
  end if;

  select rm.id
    into target_membership_id
  from public.roster_memberships rm
  where rm.player_id = test_player_id
    and rm.team_season_id = target_team_season_id;

  select count(*)
    into stint_count
  from public.roster_membership_stints rs
  where rs.roster_membership_id = target_membership_id;

  if stint_count < 2 then
    raise exception 'ASSERT_MULTIPLE_TARGET_STINTS_FAILED: %', stint_count;
  end if;

  raise notice
    'REHEARSAL_OK player=% request=% season=% source=% target=% source_interval=%..% target_first_interval=%..% rejoin=%',
    test_player_id,
    request_id,
    test_season_id,
    source_team_season_id,
    target_team_season_id,
    source_start,
    source_end,
    target_start,
    target_end,
    rejoin_date;
end;
$$;

reset role;

-- Nothing from the rehearsal is allowed to persist.
rollback;
