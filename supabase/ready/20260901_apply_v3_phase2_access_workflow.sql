-- IQBasket v3 PHASE 2 - ATOMIC ACCESS WORKFLOW
-- =============================================================================
-- PRODUCTION-READY.
--
-- Preconditions:
--   * v3 Phase 1 applied and verified;
--   * team_seasons + team_season_memberships exist;
--   * user_profiles.global_role exists;
--   * RLS remains disabled in this phase.
--
-- This phase only creates/replaces SECURITY DEFINER functions and grants.
-- It does NOT delete or rewrite existing sporting data.
-- =============================================================================

begin;

do $$
begin
    if to_regclass('public.team_seasons') is null
       or to_regclass('public.team_season_memberships') is null
       or to_regclass('public.team_join_requests') is null then
        raise exception 'Required v3 Phase 1 tables are missing. Phase 2 aborted.';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'user_profiles'
          and column_name = 'global_role'
    ) then
        raise exception 'user_profiles.global_role is missing. Phase 2 aborted.';
    end if;

    if (
        select count(*)
        from public.user_profiles
        where upper(coalesce(global_role, '')) = 'SUPERADMIN'
    ) <> 1 then
        raise exception 'Expected exactly one global SUPERADMIN. Phase 2 aborted.';
    end if;

    if not exists (
        select 1
        from public.user_profiles
        where lower(email) = 'scolado@nechigroup.com'
          and upper(coalesce(global_role, '')) = 'SUPERADMIN'
    ) then
        raise exception 'Expected master SUPERADMIN is missing. Phase 2 aborted.';
    end if;
end $$;

create or replace function public.iq_v3_can_manage_team_season(
    target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        exists (
            select 1
            from public.user_profiles up
            where up.id = auth.uid()
              and upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
        )
        or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = target_team_season_id
              and upper(m.status) = 'ACTIVE'
              and upper(m.function_role) in (
                  'ADMIN',
                  'COORDINADOR',
                  'DIRECTOR_DEPORTIVO'
              )
        )
        or exists (
            select 1
            from public.team_seasons ts
            join public.teams t on t.id = ts.team_id
            join public.club_season_memberships cm
              on cm.club_id = t.club_id
             and cm.season_id = ts.season_id
            where ts.id = target_team_season_id
              and cm.user_id = auth.uid()
              and upper(cm.status) = 'ACTIVE'
              and upper(cm.function_role) in (
                  'ADMIN',
                  'COORDINADOR',
                  'DIRECTOR_DEPORTIVO'
              )
        );
$$;

revoke all on function public.iq_v3_can_manage_team_season(uuid) from public;
grant execute on function public.iq_v3_can_manage_team_season(uuid) to authenticated;

create or replace function public.iq_v3_request_team_access(
    target_team_season_id uuid,
    requested_function_role text default 'VISOR'
)
returns public.team_join_requests
language plpgsql
security definer
set search_path = ''
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

    if exists (
        select 1
        from public.team_season_memberships m
        where m.user_id = caller_id
          and m.team_season_id = target_team_season_id
          and upper(m.status) = 'ACTIVE'
    ) then
        raise exception 'ACCESS_ALREADY_GRANTED';
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



create or replace function public.iq_v3_review_team_access(
    request_id uuid,
    approve_request boolean
)
returns public.team_join_requests
language plpgsql
security definer
set search_path = ''
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

    -- Transitional compatibility while the app still understands assigned_team_ids.
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

commit;

select
    routine_name,
    security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
      'iq_v3_can_manage_team_season',
      'iq_v3_request_team_access',
      'iq_v3_review_team_access'
  )
order by routine_name;

-- IMPORTANT: RLS remains unchanged in Phase 2.
