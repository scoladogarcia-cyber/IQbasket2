-- IQBasket v3 PHASE 2 ACCESS WORKFLOW VERIFICATION
-- =============================================================================
-- SAFE TEST: requests and approves access inside one transaction, then ROLLBACK.
-- No production data is retained.
--
-- IMPORTANT:
-- The exact request_id returned by iq_v3_request_team_access is stored in a
-- transaction-local PostgreSQL setting and reused for review. This avoids
-- re-discovering the request with a second query.
-- =============================================================================

begin;

-- Resolve the audited Manyanet 2025/2026 team-season once and keep it locally.
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

-- 1) test@test.com requests VISOR access.
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

do $$
begin
    if nullif(current_setting('iq.test_request_id', true), '') is null then
        raise exception 'TEST_REQUEST_ID_NOT_RETURNED';
    end if;
end $$;

reset role;

-- 2) Unique master SUPERADMIN reviews exactly that request.
set local role authenticated;

select set_config(
    'request.jwt.claims',
    '{"sub":"afdf727e-8aa4-43b2-8ee4-bfc63a715a51","email":"scolado@nechigroup.com","role":"authenticated"}',
    true
);

select
    (public.iq_v3_review_team_access(
        current_setting('iq.test_request_id')::uuid,
        true
    )).status as reviewed_status;

-- 3) Validate all atomic side effects before rollback.
select
    'request_approved' as check_name,
    case when exists (
        select 1
        from public.team_join_requests r
        where r.id = current_setting('iq.test_request_id')::uuid
          and lower(r.status) = 'approved'
    ) then 'OK' else 'ERROR' end as result

union all

select
    'membership_created',
    case when exists (
        select 1
        from public.team_season_memberships m
        where m.user_id = '4a3340f6-3e97-4f0f-a3ae-c5481ddb3606'::uuid
          and m.team_season_id = current_setting('iq.test_team_season_id')::uuid
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
        current_setting('iq.test_team_season_id')::uuid
    ) then 'OK' else 'ERROR' end

order by check_name;

reset role;

rollback;

-- 4) Read-only post-rollback verification.
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
    ) then 'OK' else 'REVIEW_EXISTING_DATA' end

order by check_name;
