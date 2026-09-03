-- IQBasket v3 Phase 2 diagnostic A: REQUEST RPC ONLY
-- Safe: one transaction, one diagnostic block, final ROLLBACK.
-- Uses the real audited Manyanet 2025/2026 team_season_id only as a test fixture.

begin;

do $$
declare
  target_scope constant uuid := 'f499e286-97f4-4886-b054-4a263a2c475c';
  test_user constant uuid := '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606';
  created_request public.team_join_requests;
begin
  -- Sanity check before simulating the authenticated caller.
  if not exists (
    select 1
    from public.team_seasons ts
    join public.season_catalog sc on sc.id = ts.season_id
    where ts.id = target_scope
      and ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
      and sc.code = '2025-2026'
      and upper(ts.status) = 'ACTIVE'
  ) then
    raise exception 'TEST_TEAM_SEASON_NOT_FOUND';
  end if;

  -- auth.uid() will resolve to test@test.com for the RPC call.
  perform set_config(
    'request.jwt.claims',
    '{"sub":"4a3340f6-3e97-4f0f-a3ae-c5481ddb3606","email":"test@test.com","role":"authenticated"}',
    true
  );

  created_request := public.iq_v3_request_team_access(target_scope, 'VISOR');

  if created_request.id is null then
    raise exception 'REQUEST_RPC_RETURNED_NO_ID';
  end if;

  if created_request.user_id is distinct from test_user then
    raise exception 'REQUEST_RPC_WRONG_USER: %', created_request.user_id;
  end if;

  if created_request.team_season_id is distinct from target_scope then
    raise exception 'REQUEST_RPC_WRONG_SCOPE: %', created_request.team_season_id;
  end if;

  if lower(coalesce(created_request.status, '')) not in ('pending', 'pendiente') then
    raise exception 'REQUEST_RPC_WRONG_STATUS: %', created_request.status;
  end if;

  if not exists (
    select 1
    from public.team_join_requests r
    where r.id = created_request.id
      and r.user_id = test_user
      and r.team_season_id = target_scope
      and lower(coalesce(r.status, '')) in ('pending', 'pendiente')
  ) then
    raise exception 'REQUEST_ROW_NOT_CREATED: %', created_request.id;
  end if;
end $$;

rollback;

select 'request_rpc_only' as check_name, 'OK' as result;
