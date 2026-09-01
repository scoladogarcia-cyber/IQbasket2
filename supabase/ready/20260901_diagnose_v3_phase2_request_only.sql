-- IQBasket v3 Phase 2 diagnostic A: REQUEST RPC ONLY
-- Safe: ends with ROLLBACK and leaves no test data.
--
-- The team-season context is resolved BEFORE switching to the simulated
-- authenticated role. The request itself is then executed as test@test.com.

begin;

-- 1) Resolve the real audited scope using the SQL Editor role.
select set_config(
  'iq.test_team_season_id',
  (
    select ts.id::text
    from public.team_seasons ts
    join public.season_catalog sc on sc.id = ts.season_id
    where ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
      and sc.code = '2025-2026'
    limit 1
  ),
  true
);

do $$
begin
  if nullif(current_setting('iq.test_team_season_id', true), '') is null then
    raise exception 'TEST_TEAM_SEASON_NOT_FOUND';
  end if;
end $$;

-- 2) Simulate test@test.com and execute only the request RPC.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"4a3340f6-3e97-4f0f-a3ae-c5481ddb3606","email":"test@test.com","role":"authenticated"}',
  true
);

select set_config(
  'iq.test_request_id',
  (
    select (public.iq_v3_request_team_access(
      current_setting('iq.test_team_season_id')::uuid,
      'VISOR'
    )).id::text
  ),
  true
);

reset role;

-- 3) Verify as SQL Editor role that the RPC really inserted the pending row.
do $$
declare
  rid uuid;
begin
  rid := nullif(current_setting('iq.test_request_id', true), '')::uuid;

  if rid is null then
    raise exception 'REQUEST_RPC_RETURNED_NO_ID';
  end if;

  if not exists (
    select 1
    from public.team_join_requests r
    where r.id = rid
      and r.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
      and r.team_season_id = current_setting('iq.test_team_season_id')::uuid
      and lower(coalesce(r.status, 'pending')) in ('pending', 'pendiente')
  ) then
    raise exception 'REQUEST_RPC_RETURNED_ID_BUT_ROW_NOT_CREATED: %', rid;
  end if;
end $$;

rollback;

select 'request_rpc_only' as check_name, 'OK' as result;
