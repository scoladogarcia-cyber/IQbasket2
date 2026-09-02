-- =============================================================================
-- IQBasket v3 · PHASE 3C FUNCTIONAL SMOKE TEST · FORCED ROLLBACK
-- Date: 2026-09-02
--
-- PURPOSE
-- Validate the installed Phase 3C against the real schema/data without
-- persisting test data. Exercises:
--   1) create player + first temporal stint
--   2) eligibility before/inside/after a stint
--   3) real removal closes the active stint
--   4) rejoin opens a second stint
--   5) seed-only inherited membership can be semantically excluded
--
-- SAFETY
-- - Exactly one BEGIN.
-- - No COMMIT.
-- - Exactly one final ROLLBACK.
-- - Synthetic rows exist only inside this transaction.
-- - Run while no one is actively editing IQBasket.
--
-- Expected final notice:
--   PHASE3C_FUNCTIONAL_SMOKE_OK ...
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Preconditions + choose one existing team-season with enough date range.
--    This block still runs as the SQL Editor owner role.
-- -----------------------------------------------------------------------------
do $$
declare
  v_superadmin_id uuid;
  v_superadmin_email text;
  v_team_season_id uuid;
  v_team_id uuid;
  v_season_start date;
  v_season_end date;
  v_seed_player_id uuid;
  v_seed_membership_id uuid;
begin
  if to_regclass('public.roster_membership_stints') is null
     or to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is null
     or to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null then
    raise exception 'PHASE3C_NOT_INSTALLED';
  end if;

  select up.id, up.email
    into v_superadmin_id, v_superadmin_email
  from public.user_profiles up
  where upper(coalesce(up.global_role, '')) = 'SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  if v_superadmin_id is null then
    raise exception 'SMOKE_REQUIRES_GLOBAL_SUPERADMIN';
  end if;

  select ts.id, ts.team_id, sc.start_date, sc.end_date
    into v_team_season_id, v_team_id, v_season_start, v_season_end
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where sc.start_date is not null
    and sc.end_date is not null
    and sc.end_date >= sc.start_date + 14
  order by sc.start_date desc, ts.created_at desc
  limit 1;

  if v_team_season_id is null then
    raise exception 'SMOKE_NEEDS_TEAM_SEASON_WITH_AT_LEAST_15_DAYS';
  end if;

  -- Persist only transaction-local context through custom GUCs.
  perform set_config('iq.smoke.team_season_id', v_team_season_id::text, true);
  perform set_config('iq.smoke.team_id', v_team_id::text, true);
  perform set_config('iq.smoke.season_start', v_season_start::text, true);
  perform set_config('iq.smoke.season_end', v_season_end::text, true);

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_superadmin_id::text,
      'email', coalesce(v_superadmin_email, ''),
      'role', 'authenticated'
    )::text,
    true
  );

  -- Prepare one seed-only synthetic player using owner privileges.
  -- It will be removed through the public semantic-removal RPC after role switch.
  insert into public.players (
    team_id,
    first_name,
    last_name,
    jersey,
    primary_position,
    status
  )
  values (
    v_team_id,
    'ZZ_SMOKE_SEED',
    'TEMP_PLAYER',
    97,
    'Base',
    'Activo'
  )
  returning id into v_seed_player_id;

  insert into public.roster_memberships (
    player_id,
    team_season_id,
    jersey,
    primary_position,
    secondary_positions,
    status,
    joined_at,
    left_at
  )
  values (
    v_seed_player_id,
    v_team_season_id,
    97,
    'Base',
    '{}'::text[],
    'ACTIVE',
    v_season_start::timestamptz,
    null
  )
  returning id into v_seed_membership_id;

  insert into public.roster_membership_stints (
    roster_membership_id,
    valid_from,
    valid_until,
    source,
    notes
  )
  values (
    v_seed_membership_id,
    v_season_start,
    null,
    'SEASON_SEED',
    'Synthetic Phase3C rollback-only smoke test'
  );

  perform set_config('iq.smoke.seed_player_id', v_seed_player_id::text, true);
  perform set_config('iq.smoke.seed_membership_id', v_seed_membership_id::text, true);
end $$;

set local role authenticated;

-- -----------------------------------------------------------------------------
-- 1. Exercise public Phase-3C RPCs as an authenticated global SUPERADMIN.
-- -----------------------------------------------------------------------------
do $$
declare
  v_team_season_id uuid := current_setting('iq.smoke.team_season_id')::uuid;
  v_season_start date := current_setting('iq.smoke.season_start')::date;
  v_season_end date := current_setting('iq.smoke.season_end')::date;
  v_seed_player_id uuid := current_setting('iq.smoke.seed_player_id')::uuid;

  v_first_date date;
  v_last_date date;
  v_rejoin_date date;

  v_created jsonb;
  v_remove jsonb;
  v_seed_remove jsonb;

  v_player_id uuid;
  v_membership_id uuid;
  v_stint_count integer;
begin
  if auth.uid() is null then
    raise exception 'SMOKE_AUTH_CONTEXT_NOT_SET';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SMOKE_GLOBAL_SUPERADMIN_CONTEXT_FAILED';
  end if;

  v_first_date := v_season_start + 2;
  v_last_date := v_season_start + 6;
  v_rejoin_date := v_season_start + 8;

  if v_rejoin_date > v_season_end then
    raise exception 'SMOKE_SELECTED_SEASON_TOO_SHORT';
  end if;

  -- A. Create identity + first stint atomically.
  v_created := public.iq_v3_create_player_for_roster(
    v_team_season_id,
    'ZZ_SMOKE_TEMPORAL',
    'TEMP_PLAYER',
    96,
    'Base',
    v_first_date
  );

  v_player_id := (v_created ->> 'player_id')::uuid;
  v_membership_id := (v_created ->> 'membership_id')::uuid;

  if v_player_id is null or v_membership_id is null then
    raise exception 'ASSERT_CREATE_PLAYER_FAILED: %', v_created;
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_first_date - 1
  ) then
    raise exception 'ASSERT_BEFORE_FIRST_DATE_MUST_BE_INELIGIBLE';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_first_date
  ) then
    raise exception 'ASSERT_FIRST_DATE_MUST_BE_ELIGIBLE';
  end if;

  -- B. Real participation removal closes the current stint inclusively.
  v_remove := public.iq_v3_remove_roster_member(
    v_team_season_id,
    v_player_id,
    v_last_date
  );

  if coalesce(v_remove ->> 'mode', '') <> 'CLOSED_TEMPORAL_STINT' then
    raise exception 'ASSERT_REAL_REMOVAL_MODE_FAILED: %', v_remove;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_last_date
  ) then
    raise exception 'ASSERT_LAST_DATE_MUST_REMAIN_ELIGIBLE';
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_last_date + 1
  ) then
    raise exception 'ASSERT_AFTER_LAST_DATE_MUST_BE_INELIGIBLE';
  end if;

  -- C. Rejoin opens a second non-overlapping stint.
  perform public.iq_v3_set_roster_member(
    v_team_season_id,
    v_player_id,
    'ACTIVE',
    96,
    'Base',
    v_rejoin_date
  );

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_rejoin_date - 1
  ) then
    raise exception 'ASSERT_GAP_BEFORE_REJOIN_MUST_BE_INELIGIBLE';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_rejoin_date
  ) then
    raise exception 'ASSERT_REJOIN_DATE_MUST_BE_ELIGIBLE';
  end if;

  select count(*)
    into v_stint_count
  from public.roster_membership_stints rs
  where rs.roster_membership_id = v_membership_id;

  if v_stint_count <> 2 then
    raise exception 'ASSERT_REJOIN_MUST_CREATE_SECOND_STINT: %', v_stint_count;
  end if;

  -- D. Seed-only/no-history removal must EXCLUDE, not invent participation.
  v_seed_remove := public.iq_v3_remove_roster_member(
    v_team_season_id,
    v_seed_player_id,
    v_season_start
  );

  if coalesce(v_seed_remove ->> 'mode', '') <> 'EXCLUDED_FROM_SEASON' then
    raise exception 'ASSERT_SEED_EXCLUSION_MODE_FAILED: %', v_seed_remove;
  end if;

  if public.iq_v3_player_eligible_on_date(
    v_seed_player_id,
    v_team_season_id,
    v_season_start
  ) then
    raise exception 'ASSERT_EXCLUDED_SEED_PLAYER_MUST_NOT_BE_ELIGIBLE';
  end if;

  if exists (
    select 1
    from public.roster_membership_stints rs
    where rs.roster_membership_id = current_setting('iq.smoke.seed_membership_id')::uuid
  ) then
    raise exception 'ASSERT_SEED_EXCLUSION_MUST_REMOVE_SYNTHETIC_STINT';
  end if;

  raise notice
    'PHASE3C_FUNCTIONAL_SMOKE_OK team_season=% temporal_player=% first=% last=% rejoin=% seed_player=%',
    v_team_season_id,
    v_player_id,
    v_first_date,
    v_last_date,
    v_rejoin_date,
    v_seed_player_id;
end $$;

reset role;

-- CRITICAL: no smoke-test row is allowed to persist.
rollback;
