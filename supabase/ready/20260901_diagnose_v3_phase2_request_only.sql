-- IQBasket v3 Phase 2 diagnostic A: REQUEST RPC ONLY
-- Safe: ends with ROLLBACK and leaves no test data.

begin;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"4a3340f6-3e97-4f0f-a3ae-c5481ddb3606","email":"test@test.com","role":"authenticated"}',
  true
);

do $$
declare
  target_scope uuid;
  created_request public.team_join_requests;
begin
  select ts.id
    into target_scope
    from public.team_seasons ts
    join public.season_catalog sc on sc.id = ts.season_id
   where ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
     and sc.code = '2025-2026'
   limit 1;

  if target_scope is null then
    raise exception 'TEST_TEAM_SEASON_NOT_FOUND';
  end if;

  created_request := public.iq_v3_request_team_access(target_scope, 'VISOR');

  if created_request.id is null then
    raise exception 'REQUEST_RPC_RETURNED_NO_ID';
  end if;

  if not exists (
    select 1
      from public.team_join_requests r
     where r.id = created_request.id
       and r.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
       and r.team_season_id = target_scope
       and lower(coalesce(r.status,'pending')) in ('pending','pendiente')
  ) then
    raise exception 'REQUEST_RPC_RETURNED_ID_BUT_ROW_NOT_VISIBLE: %', created_request.id;
  end if;
end $$;

reset role;

rollback;

select 'request_rpc_only' as check_name, 'OK' as result;
