-- IQBasket v3 Phase 2 diagnostic B: REVIEW RPC ONLY
-- Safe: creates a temporary pending request, approves it, validates all effects,
-- then ROLLBACK. No production data is retained.

begin;

do $$
declare
  target_scope constant uuid := 'f499e286-97f4-4886-b054-4a263a2c475c';
  target_team constant uuid := 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22';
  test_user constant uuid := '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606';
  master_user constant uuid := 'afdf727e-8aa4-43b2-8ee4-bfc63a715a51';
  temp_request_id uuid := gen_random_uuid();
  reviewed public.team_join_requests;
begin
  -- Sanity checks before the synthetic workflow.
  if not exists (
    select 1
    from public.team_seasons ts
    join public.season_catalog sc on sc.id = ts.season_id
    where ts.id = target_scope
      and ts.team_id = target_team
      and sc.code = '2025-2026'
      and upper(ts.status) = 'ACTIVE'
  ) then
    raise exception 'TEST_TEAM_SEASON_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.id = master_user
      and lower(up.email) = 'scolado@nechigroup.com'
      and upper(coalesce(up.global_role,'')) = 'SUPERADMIN'
  ) then
    raise exception 'MASTER_SUPERADMIN_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.team_season_memberships m
    where m.user_id = test_user
      and m.team_season_id = target_scope
      and upper(m.function_role) = 'VISOR'
      and upper(m.status) = 'ACTIVE'
  ) then
    raise exception 'TEST_USER_ALREADY_HAS_VISOR_MEMBERSHIP';
  end if;

  -- Create a controlled pending request directly for the review test.
  insert into public.team_join_requests (
    id,
    user_id,
    team_id,
    team_season_id,
    requested_role,
    status
  )
  values (
    temp_request_id,
    test_user,
    target_team,
    target_scope,
    'VISOR',
    'pending'
  );

  -- Simulate the unique master SUPERADMIN for the SECURITY DEFINER RPC.
  perform set_config(
    'request.jwt.claims',
    '{"sub":"afdf727e-8aa4-43b2-8ee4-bfc63a715a51","email":"scolado@nechigroup.com","role":"authenticated"}',
    true
  );

  reviewed := public.iq_v3_review_team_access(temp_request_id, true);

  if reviewed.id is distinct from temp_request_id then
    raise exception 'REVIEW_RPC_RETURNED_WRONG_REQUEST: %', reviewed.id;
  end if;

  if lower(coalesce(reviewed.status,'')) <> 'approved' then
    raise exception 'REVIEW_RPC_WRONG_STATUS: %', reviewed.status;
  end if;

  if not exists (
    select 1
    from public.team_season_memberships m
    where m.user_id = test_user
      and m.team_season_id = target_scope
      and upper(m.function_role) = 'VISOR'
      and upper(m.status) = 'ACTIVE'
  ) then
    raise exception 'MEMBERSHIP_NOT_CREATED';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.id = test_user
      and target_team = any(coalesce(up.assigned_team_ids, '{}'::uuid[]))
  ) then
    raise exception 'LEGACY_TEAM_SCOPE_NOT_SYNCHRONIZED';
  end if;

  if not exists (
    select 1
    from public.team_join_requests r
    where r.id = temp_request_id
      and lower(coalesce(r.status,'')) = 'approved'
  ) then
    raise exception 'REQUEST_NOT_MARKED_APPROVED';
  end if;
end $$;

rollback;

select 'review_rpc_only' as check_name, 'OK' as result;
