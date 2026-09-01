-- IQBasket v3 Phase 2 diagnostic B: REVIEW RPC ONLY
-- Safe: creates a temporary request with a fixed ID, approves it, then ROLLBACK.

begin;

insert into public.team_join_requests (
  id,
  user_id,
  team_id,
  team_season_id,
  requested_role,
  status
)
select
  '00000000-0000-4000-8000-000000000099'::uuid,
  '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid,
  ts.team_id,
  ts.id,
  'VISOR',
  'pending'
from public.team_seasons ts
join public.season_catalog sc on sc.id = ts.season_id
where ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
  and sc.code = '2025-2026'
limit 1;

do $$
begin
  if not exists (
    select 1
    from public.team_join_requests
    where id = '00000000-0000-4000-8000-000000000099'::uuid
  ) then
    raise exception 'TEMP_REQUEST_NOT_CREATED';
  end if;
end $$;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"afdf727e-8aa4-43b2-8ee4-bfc63a715a51","email":"scolado@nechigroup.com","role":"authenticated"}',
  true
);

do $$
declare
  reviewed public.team_join_requests;
begin
  reviewed := public.iq_v3_review_team_access(
    '00000000-0000-4000-8000-000000000099'::uuid,
    true
  );

  if reviewed.id is distinct from '00000000-0000-4000-8000-000000000099'::uuid
     or lower(coalesce(reviewed.status,'')) <> 'approved' then
    raise exception 'REVIEW_RPC_DID_NOT_APPROVE_TEMP_REQUEST';
  end if;

  if not exists (
    select 1
    from public.team_season_memberships m
    where m.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
      and upper(m.function_role) = 'VISOR'
      and upper(m.status) = 'ACTIVE'
      and m.team_season_id = (
        select ts.id
        from public.team_seasons ts
        join public.season_catalog sc on sc.id = ts.season_id
        where ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
          and sc.code = '2025-2026'
        limit 1
      )
  ) then
    raise exception 'REVIEW_RPC_APPROVED_BUT_MEMBERSHIP_MISSING';
  end if;
end $$;

reset role;

rollback;

select 'review_rpc_only' as check_name, 'OK' as result;
