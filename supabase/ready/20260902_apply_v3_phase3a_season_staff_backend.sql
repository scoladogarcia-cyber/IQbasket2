-- IQBasket v3 PHASE 3A - GLOBAL SEASONS + TEAM-SEASON STAFF BACKEND
-- =============================================================================
-- ADDITIVE / NON-DESTRUCTIVE.
-- Creates the canonical staff assignment table and SECURITY DEFINER RPCs.
-- Does NOT delete or rename legacy tables/columns.
-- Does NOT enable RLS.
-- Does NOT migrate legacy coach_name values automatically.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.season_catalog') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.team_season_memberships') is null then
    raise exception 'PHASE1_REQUIRED';
  end if;

  if to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null then
    raise exception 'PHASE2_REQUIRED';
  end if;

  if (
    select count(*)
    from public.user_profiles up
    where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
  ) <> 1 then
    raise exception 'EXPECTED_EXACTLY_ONE_GLOBAL_SUPERADMIN';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Canonical sporting staff assignment
-- -----------------------------------------------------------------------------
create table if not exists public.team_season_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  staff_role text not null,
  user_id uuid references public.user_profiles(id) on delete restrict,
  external_name text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_season_staff_target_check
    check (
      (user_id is not null and nullif(btrim(external_name), '') is null)
      or
      (user_id is null and nullif(btrim(external_name), '') is not null)
    ),
  constraint team_season_staff_role_check
    check (
      upper(staff_role) in (
        'HEAD_COACH',
        'ASSISTANT_COACH',
        'ANALYST',
        'PHYSICAL_TRAINER',
        'TEAM_MANAGER'
      )
    ),
  constraint team_season_staff_status_check
    check (upper(status) in ('ACTIVE','INACTIVE'))
);

create unique index if not exists ux_team_season_staff_registered
  on public.team_season_staff_assignments(team_season_id, user_id, staff_role)
  where user_id is not null;

create unique index if not exists ux_team_season_single_head_coach
  on public.team_season_staff_assignments(team_season_id)
  where upper(staff_role) = 'HEAD_COACH'
    and upper(status) = 'ACTIVE';

create index if not exists idx_team_season_staff_scope
  on public.team_season_staff_assignments(team_season_id, status);

comment on table public.team_season_staff_assignments is
'Canonical sporting staff assignment by team-season. Registered users receive contextual access through team_season_memberships; external staff can be recorded without login access.';

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_is_global_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
  );
$$;

revoke all on function public.iq_v3_is_global_superadmin() from public;
grant execute on function public.iq_v3_is_global_superadmin() to authenticated;

create or replace function public.iq_v3_staff_membership_role(p_staff_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(trim(coalesce(p_staff_role, '')))
    when 'HEAD_COACH' then 'ENTRENADOR'
    when 'ASSISTANT_COACH' then 'AYUDANTE'
    when 'ANALYST' then 'ANALISTA'
    when 'PHYSICAL_TRAINER' then 'PREPARADOR_FISICO'
    when 'TEAM_MANAGER' then 'VISOR'
    else null
  end;
$$;

revoke all on function public.iq_v3_staff_membership_role(text) from public;
grant execute on function public.iq_v3_staff_membership_role(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Capability probe used by the UI
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_season_admin_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', true,
    'season_management_ready', true,
    'global_season_write', public.iq_v3_is_global_superadmin(),
    'staff_write_model', 'TEAM_SEASON_STAFF_V1'
  );
$$;

revoke all on function public.iq_v3_season_admin_capabilities() from public;
grant execute on function public.iq_v3_season_admin_capabilities() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Global season creation: intentionally SUPERADMIN only
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_create_global_season(
  p_code text,
  p_name text,
  p_start_date date default null,
  p_end_date date default null
)
returns public.season_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_row public.season_catalog;
  normalized_code text := trim(coalesce(p_code, ''));
  normalized_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_REQUIRED';
  end if;

  if normalized_code = '' or normalized_name = '' then
    raise exception 'CODE_AND_NAME_REQUIRED';
  end if;

  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  insert into public.season_catalog (
    code, name, start_date, end_date, status, is_test
  )
  values (
    normalized_code, normalized_name, p_start_date, p_end_date, 'ACTIVE', false
  )
  returning * into created_row;

  return created_row;
end;
$$;

revoke all on function public.iq_v3_create_global_season(text,text,date,date) from public;
grant execute on function public.iq_v3_create_global_season(text,text,date,date) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Global season update: no deletion
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_update_global_season(
  p_season_id uuid,
  p_code text,
  p_name text,
  p_start_date date default null,
  p_end_date date default null,
  p_status text default 'ACTIVE'
)
returns public.season_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_row public.season_catalog;
  normalized_status text := upper(trim(coalesce(p_status, 'ACTIVE')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_REQUIRED';
  end if;

  if normalized_status not in ('ACTIVE','INACTIVE','ARCHIVED') then
    raise exception 'INVALID_SEASON_STATUS';
  end if;

  if trim(coalesce(p_code,'')) = '' or trim(coalesce(p_name,'')) = '' then
    raise exception 'CODE_AND_NAME_REQUIRED';
  end if;

  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  update public.season_catalog
     set code = trim(p_code),
         name = trim(p_name),
         start_date = p_start_date,
         end_date = p_end_date,
         status = normalized_status,
         updated_at = now()
   where id = p_season_id
   returning * into updated_row;

  if updated_row.id is null then
    raise exception 'SEASON_NOT_FOUND';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.iq_v3_update_global_season(uuid,text,text,date,date,text) from public;
grant execute on function public.iq_v3_update_global_season(uuid,text,text,date,date,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Link team to global season: setup operation, SUPERADMIN only for now
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_link_team_season(
  p_team_id uuid,
  p_season_id uuid
)
returns public.team_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.team_seasons;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_REQUIRED';
  end if;

  if not exists (select 1 from public.teams t where t.id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if not exists (select 1 from public.season_catalog s where s.id = p_season_id) then
    raise exception 'SEASON_NOT_FOUND';
  end if;

  insert into public.team_seasons (
    team_id, season_id, status, data_status
  )
  values (
    p_team_id, p_season_id, 'ACTIVE', 'ACTIVE'
  )
  on conflict (team_id, season_id)
  do update set
    status = 'ACTIVE',
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.iq_v3_link_team_season(uuid,uuid) from public;
grant execute on function public.iq_v3_link_team_season(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Activate/archive team-season without deleting history
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_set_team_season_status(
  p_team_season_id uuid,
  p_status text
)
returns public.team_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.team_seasons;
  normalized_status text := upper(trim(coalesce(p_status, '')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_manage_team_season(p_team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  if normalized_status not in ('ACTIVE','INACTIVE','ARCHIVED') then
    raise exception 'INVALID_TEAM_SEASON_STATUS';
  end if;

  update public.team_seasons
     set status = normalized_status,
         updated_at = now()
   where id = p_team_season_id
   returning * into result_row;

  if result_row.id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  return result_row;
end;
$$;

revoke all on function public.iq_v3_set_team_season_status(uuid,text) from public;
grant execute on function public.iq_v3_set_team_season_status(uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Staff assignment
-- Registered users get the matching contextual membership.
-- Removing/replacing staff does NOT silently revoke access; access revocation
-- remains an explicit security action.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_assign_team_season_staff(
  p_team_season_id uuid,
  p_staff_role text,
  p_user_id uuid default null,
  p_external_name text default null
)
returns public.team_season_staff_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_role text := upper(trim(coalesce(p_staff_role, '')));
  normalized_external text := nullif(trim(coalesce(p_external_name, '')), '');
  membership_role text;
  result_row public.team_season_staff_assignments;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_manage_team_season(p_team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  if normalized_role not in (
    'HEAD_COACH',
    'ASSISTANT_COACH',
    'ANALYST',
    'PHYSICAL_TRAINER',
    'TEAM_MANAGER'
  ) then
    raise exception 'INVALID_STAFF_ROLE';
  end if;

  if (p_user_id is null and normalized_external is null)
     or (p_user_id is not null and normalized_external is not null) then
    raise exception 'EXACTLY_ONE_STAFF_TARGET_REQUIRED';
  end if;

  if p_user_id is not null
     and not exists (select 1 from public.user_profiles up where up.id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  if normalized_role = 'HEAD_COACH' then
    update public.team_season_staff_assignments
       set status = 'INACTIVE',
           updated_at = now()
     where team_season_id = p_team_season_id
       and upper(staff_role) = 'HEAD_COACH'
       and upper(status) = 'ACTIVE';
  end if;

  if p_user_id is not null then
    insert into public.team_season_staff_assignments (
      team_season_id, staff_role, user_id, external_name, status
    )
    values (
      p_team_season_id, normalized_role, p_user_id, null, 'ACTIVE'
    )
    on conflict (team_season_id, user_id, staff_role)
      where user_id is not null
    do update set
      status = 'ACTIVE',
      external_name = null,
      updated_at = now()
    returning * into result_row;

    membership_role := public.iq_v3_staff_membership_role(normalized_role);

    if membership_role is not null then
      insert into public.team_season_memberships (
        user_id, team_season_id, function_role, status
      )
      values (
        p_user_id, p_team_season_id, membership_role, 'ACTIVE'
      )
      on conflict (user_id, team_season_id, function_role)
      do update set
        status = 'ACTIVE',
        valid_until = null,
        updated_at = now();
    end if;
  else
    insert into public.team_season_staff_assignments (
      team_season_id, staff_role, user_id, external_name, status
    )
    values (
      p_team_season_id, normalized_role, null, normalized_external, 'ACTIVE'
    )
    returning * into result_row;
  end if;

  return result_row;
end;
$$;

revoke all on function public.iq_v3_assign_team_season_staff(uuid,text,uuid,text) from public;
grant execute on function public.iq_v3_assign_team_season_staff(uuid,text,uuid,text) to authenticated;

create or replace function public.iq_v3_remove_team_season_staff(
  p_assignment_id uuid
)
returns public.team_season_staff_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.team_season_staff_assignments;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select a.*
    into target_row
    from public.team_season_staff_assignments a
   where a.id = p_assignment_id
   for update;

  if target_row.id is null then
    raise exception 'STAFF_ASSIGNMENT_NOT_FOUND';
  end if;

  if not public.iq_v3_can_manage_team_season(target_row.team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  update public.team_season_staff_assignments
     set status = 'INACTIVE',
         updated_at = now()
   where id = p_assignment_id
   returning * into target_row;

  return target_row;
end;
$$;

revoke all on function public.iq_v3_remove_team_season_staff(uuid) from public;
grant execute on function public.iq_v3_remove_team_season_staff(uuid) to authenticated;

commit;

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'iq_v3_season_admin_capabilities',
    'iq_v3_create_global_season',
    'iq_v3_update_global_season',
    'iq_v3_link_team_season',
    'iq_v3_set_team_season_status',
    'iq_v3_assign_team_season_staff',
    'iq_v3_remove_team_season_staff'
  )
order by routine_name;
