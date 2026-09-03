-- IQBasket v3 PHASE 2.1 - ACCESS SCOPE HARDENING
-- =============================================================================
-- Safe replacement of the Phase 2 authorization helpers.
--
-- Fixes:
--   * contextual COORDINADOR / DIRECTOR_DEPORTIVO / ADMIN membership can manage
--     its own team-season without requiring global ADMIN;
--   * users cannot create duplicate access requests once access is already active.
--
-- No sporting data is changed. RLS remains disabled.
-- =============================================================================

begin;

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
