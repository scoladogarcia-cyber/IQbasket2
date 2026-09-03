-- IQBasket v3 access workflow (DRAFT / ROLLBACK ONLY)
-- -----------------------------------------------------------------------------
-- DO NOT DEPLOY YET.
-- Depends on the v3 structures in 20260901_data_model_v3.sql.
-- Ends with ROLLBACK so an accidental SQL Editor run persists nothing.
-- -----------------------------------------------------------------------------

begin;

-- Helper: can the authenticated user manage a team-season?
create or replace function public.iq_v3_can_manage_team_season(
    target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    with caller as (
        select
            up.id,
            upper(coalesce(up.global_role, up.role, 'USER')) as global_role
        from public.user_profiles up
        where up.id = auth.uid()
    ),
    target as (
        select
            ts.id,
            ts.team_id,
            ts.season_id,
            t.club_id
        from public.team_seasons ts
        join public.teams t on t.id = ts.team_id
        where ts.id = target_team_season_id
    )
    select exists (
        select 1
        from caller c
        where c.global_role = 'SUPERADMIN'
           or (
               c.global_role = 'ADMIN'
               and (
                   exists (
                       select 1
                       from public.team_season_memberships m
                       where m.user_id = c.id
                         and m.team_season_id = target_team_season_id
                         and upper(m.status) = 'ACTIVE'
                         and upper(m.function_role) in ('ADMIN', 'COORDINADOR', 'DIRECTOR_DEPORTIVO')
                   )
                   or exists (
                       select 1
                       from target x
                       join public.club_season_memberships cm
                         on cm.club_id = x.club_id
                        and cm.season_id = x.season_id
                       where cm.user_id = c.id
                         and upper(cm.status) = 'ACTIVE'
                         and upper(cm.function_role) in ('ADMIN', 'COORDINADOR', 'DIRECTOR_DEPORTIVO')
                   )
               )
           )
    );
$$;

revoke all on function public.iq_v3_can_manage_team_season(uuid) from public;
grant execute on function public.iq_v3_can_manage_team_season(uuid) to authenticated;

-- Request access to one team-season.
create or replace function public.iq_v3_request_team_access(
    target_team_season_id uuid,
    requested_function_role text default 'VISOR'
)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    caller_id uuid := auth.uid();
    target_team_id uuid;
    normalized_role text := upper(trim(coalesce(requested_function_role, 'VISOR')));
    existing_request public.team_join_requests;
    created_request public.team_join_requests;
begin
    if caller_id is null then
        raise exception 'AUTH_REQUIRED';
    end if;

    if normalized_role not in (
        'ENTRENADOR',
        'AYUDANTE',
        'ANALISTA',
        'PREPARADOR_FISICO',
        'JUGADOR',
        'FAMILIA_TUTOR',
        'VISOR'
    ) then
        raise exception 'INVALID_REQUESTED_ROLE';
    end if;

    select ts.team_id
      into target_team_id
      from public.team_seasons ts
     where ts.id = target_team_season_id
       and upper(ts.status) = 'ACTIVE';

    if target_team_id is null then
        raise exception 'TEAM_SEASON_NOT_FOUND';
    end if;

    select r.*
      into existing_request
      from public.team_join_requests r
     where r.user_id = caller_id
       and r.team_season_id = target_team_season_id
       and lower(coalesce(r.status, 'pending')) in ('pending', 'pendiente')
     order by r.created_at desc
     limit 1;

    if existing_request.id is not null then
        return existing_request;
    end if;

    insert into public.team_join_requests (
        user_id,
        team_id,
        team_season_id,
        requested_role,
        status
    )
    values (
        caller_id,
        target_team_id,
        target_team_season_id,
        normalized_role,
        'pending'
    )
    returning * into created_request;

    return created_request;
end;
$$;

revoke all on function public.iq_v3_request_team_access(uuid, text) from public;
grant execute on function public.iq_v3_request_team_access(uuid, text) to authenticated;

-- Review a request atomically.
-- Approval:
--   1) locks request;
--   2) validates caller scope;
--   3) creates contextual membership;
--   4) updates legacy assigned_team_ids for temporary app compatibility;
--   5) marks request approved;
-- all in a single database transaction.
create or replace function public.iq_v3_review_team_access(
    request_id uuid,
    approve_request boolean
)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    req public.team_join_requests;
    target_team_id uuid;
    normalized_role text;
    updated_request public.team_join_requests;
begin
    if auth.uid() is null then
        raise exception 'AUTH_REQUIRED';
    end if;

    select r.*
      into req
      from public.team_join_requests r
     where r.id = request_id
     for update;

    if req.id is null then
        raise exception 'REQUEST_NOT_FOUND';
    end if;

    if req.team_season_id is null then
        raise exception 'REQUEST_HAS_NO_TEAM_SEASON_SCOPE';
    end if;

    if lower(coalesce(req.status, 'pending')) not in ('pending', 'pendiente') then
        raise exception 'REQUEST_ALREADY_REVIEWED';
    end if;

    if not public.iq_v3_can_manage_team_season(req.team_season_id) then
        raise exception 'FORBIDDEN';
    end if;

    if not approve_request then
        update public.team_join_requests
           set status = 'rejected'
         where id = req.id
         returning * into updated_request;

        return updated_request;
    end if;

    normalized_role := upper(trim(coalesce(req.requested_role, 'VISOR')));

    if normalized_role not in (
        'ENTRENADOR',
        'AYUDANTE',
        'ANALISTA',
        'PREPARADOR_FISICO',
        'JUGADOR',
        'FAMILIA_TUTOR',
        'VISOR'
    ) then
        raise exception 'INVALID_REQUESTED_ROLE';
    end if;

    select ts.team_id
      into target_team_id
      from public.team_seasons ts
     where ts.id = req.team_season_id
       and upper(ts.status) = 'ACTIVE';

    if target_team_id is null then
        raise exception 'TEAM_SEASON_NOT_FOUND';
    end if;

    insert into public.team_season_memberships (
        user_id,
        team_season_id,
        function_role,
        status,
        valid_from
    )
    values (
        req.user_id,
        req.team_season_id,
        normalized_role,
        'ACTIVE',
        now()
    )
    on conflict (user_id, team_season_id, function_role)
    do update
       set status = 'ACTIVE',
           valid_from = coalesce(public.team_season_memberships.valid_from, now()),
           valid_until = null,
           updated_at = now();

    -- Temporary compatibility with the current application while reads migrate
    -- from assigned_team_ids to normalized memberships.
    update public.user_profiles up
       set assigned_team_ids = (
           select array(
               select distinct x
               from unnest(
                   coalesce(up.assigned_team_ids, '{}'::uuid[])
                   || array[target_team_id]::uuid[]
               ) as x
           )
       )
     where up.id = req.user_id;

    update public.team_join_requests
       set status = 'approved'
     where id = req.id
     returning * into updated_request;

    return updated_request;
end;
$$;

revoke all on function public.iq_v3_review_team_access(uuid, boolean) from public;
grant execute on function public.iq_v3_review_team_access(uuid, boolean) to authenticated;

rollback;

-- Deployment prerequisites:
-- 1. v3 schema/backfill validated;
-- 2. RLS matrix written and tested;
-- 3. ADMIN scope memberships backfilled explicitly;
-- 4. request UI sends team_season_id;
-- 5. external backup;
-- 6. explicit approval.
