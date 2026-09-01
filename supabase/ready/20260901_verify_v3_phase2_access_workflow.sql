-- IQBasket v3 PHASE 2 ACCESS WORKFLOW VERIFICATION
-- =============================================================================
-- SAFE TEST: creates a request and approves it inside one transaction, then
-- rolls everything back. Production data must remain unchanged afterwards.
-- RLS remains disabled.
-- =============================================================================

begin;

-- 1) Test user requests VISOR access to the current Manyanet 2025/2026 context.
set local role authenticated;
select set_config(
    'request.jwt.claims',
    '{"sub":"4a3340f6-3e97-4f0f-a3ae-c5481ddb3606","email":"test@test.com","role":"authenticated"}',
    true
);

select
    (public.iq_v3_request_team_access(ts.id, 'VISOR')).id as request_id,
    ts.id as team_season_id,
    ts.team_id
from public.team_seasons ts
join public.season_catalog sc on sc.id = ts.season_id
where ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
  and sc.code = '2025-2026';

reset role;

-- 2) Unique master SUPERADMIN reviews/approves that pending request.
set local role authenticated;
select set_config(
    'request.jwt.claims',
    '{"sub":"afdf727e-8aa4-43b2-8ee4-bfc63a715a51","email":"scolado@nechigroup.com","role":"authenticated"}',
    true
);

select
    (public.iq_v3_review_team_access(
        (
            select r.id
            from public.team_join_requests r
            where r.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
              and r.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
              and lower(coalesce(r.status, 'pending')) in ('pending', 'pendiente')
            order by r.created_at desc
            limit 1
        ),
        true
    )).status as reviewed_status;

-- 3) Validate all atomic side effects before rollback.
select
    'request_approved' as check_name,
    case when exists (
        select 1
        from public.team_join_requests r
        where r.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
          and r.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
          and lower(r.status) = 'approved'
    ) then 'OK' else 'ERROR' end as result

union all

select
    'membership_created',
    case when exists (
        select 1
        from public.team_season_memberships m
        join public.team_seasons ts on ts.id = m.team_season_id
        where m.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
          and ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
          and upper(m.function_role) = 'VISOR'
          and upper(m.status) = 'ACTIVE'
    ) then 'OK' else 'ERROR' end

union all

select
    'legacy_team_scope_synced',
    case when exists (
        select 1
        from public.user_profiles up
        where up.id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
          and 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
              = any(coalesce(up.assigned_team_ids, '{}'::uuid[]))
    ) then 'OK' else 'ERROR' end

union all

select
    'master_can_manage_scope',
    case when public.iq_v3_can_manage_team_season(
        (
            select ts.id
            from public.team_seasons ts
            join public.season_catalog sc on sc.id = ts.season_id
            where ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
              and sc.code = '2025-2026'
            limit 1
        )
    ) then 'OK' else 'ERROR' end;

reset role;

rollback;

-- 4) Post-rollback verification: the synthetic workflow left no trace.
select
    'test_membership_rolled_back' as check_name,
    case when not exists (
        select 1
        from public.team_season_memberships m
        join public.team_seasons ts on ts.id = m.team_season_id
        where m.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
          and ts.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
          and upper(m.function_role) = 'VISOR'
    ) then 'OK' else 'REVIEW_EXISTING_DATA' end as result

union all

select
    'test_request_rolled_back',
    case when not exists (
        select 1
        from public.team_join_requests r
        where r.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
          and r.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
    ) then 'OK' else 'REVIEW_EXISTING_DATA' end;
