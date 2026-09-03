-- =============================================================================
-- IQBasket v3 · PHASE 3F REHEARSAL · ROSTER PERMISSIONS · FORCED ROLLBACK
-- Date: 2026-09-03
-- =============================================================================

-- =============================================================================
-- IQBasket v3 · PHASE 3F · ROSTER-SPECIFIC ACTION AUTHORIZATION
-- Date: 2026-09-03
--
-- PURPOSE
-- Align backend authorization with the existing frontend RBAC matrix without
-- broadening the general team-season administration helper.
--
-- Allows roster actions for:
-- - global SUPERADMIN
-- - team-season ADMIN / COORDINADOR / DIRECTOR_DEPORTIVO
-- - team-season ENTRENADOR / AYUDANTE
-- - club-season ADMIN / COORDINADOR / DIRECTOR_DEPORTIVO
--
-- Approval of transfers remains SUPERADMIN-only.
--
-- DATA IMPACT
-- No player/stat/event/membership/stint rows are modified.
-- Only helper/function definitions are replaced.
-- =============================================================================

begin;

do $$
begin
  if to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null
     or to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)') is null
     or to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)') is null
     or to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is null
     or to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is null then
    raise exception 'PHASE3C_3D_REQUIRED';
  end if;
end $$;

create or replace function public.iq_v3_can_manage_roster(
  target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
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
            'DIRECTOR_DEPORTIVO',
            'ENTRENADOR',
            'AYUDANTE'
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
      )
    );
$$;

revoke all on function public.iq_v3_can_manage_roster(uuid) from public;
grant execute on function public.iq_v3_can_manage_roster(uuid) to authenticated;

-- Patch only the four installed roster RPCs that intentionally share the
-- p_team_season_id authorization check. Guard the replacement so schema drift
-- fails loudly instead of silently changing an unexpected function.
do $$
declare
  signature text;
  target regprocedure;
  definition text;
  old_call constant text :=
    'public.iq_v3_can_manage_team_season(p_team_season_id)';
  new_call constant text :=
    'public.iq_v3_can_manage_roster(p_team_season_id)';
begin
  foreach signature in array array[
    'public.iq_v3_seed_team_season_roster(uuid,date)',
    'public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)',
    'public.iq_v3_remove_roster_member(uuid,uuid,date)',
    'public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)'
  ]
  loop
    target := to_regprocedure(signature);
    if target is null then
      raise exception 'PHASE3F_FUNCTION_NOT_FOUND: %', signature;
    end if;

    definition := pg_get_functiondef(target);
    if position(old_call in definition) = 0 then
      raise exception 'PHASE3F_EXPECTED_AUTH_CALL_NOT_FOUND: %', signature;
    end if;

    execute replace(definition, old_call, new_call);
  end loop;
end $$;

create or replace function public.iq_v3_can_request_transfer(
  p_to_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.iq_v3_can_manage_roster(p_to_team_season_id);
$$;

revoke all on function public.iq_v3_can_request_transfer(uuid) from public;
grant execute on function public.iq_v3_can_request_transfer(uuid) to authenticated;

do $$
declare
  v_user_id uuid;
  v_user_email text;
  v_target_team_season_id uuid;
  v_superadmin_id uuid;
  v_superadmin_email text;
begin
  -- Pick a real non-superadmin user + team-season where the GENERAL admin helper
  -- is currently false. The test membership is transaction-local and rolls back.
  select up.id, up.email, ts.id
    into v_user_id, v_user_email, v_target_team_season_id
  from public.user_profiles up
  cross join public.team_seasons ts
  join public.teams t on t.id = ts.team_id
  where upper(coalesce(up.global_role, up.role, 'USER')) <> 'SUPERADMIN'
    and not exists (
      select 1
      from public.team_season_memberships m
      where m.user_id = up.id
        and m.team_season_id = ts.id
        and upper(m.status) = 'ACTIVE'
        and upper(m.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO')
    )
    and not exists (
      select 1
      from public.club_season_memberships cm
      where cm.user_id = up.id
        and cm.club_id = t.club_id
        and cm.season_id = ts.season_id
        and upper(cm.status) = 'ACTIVE'
        and upper(cm.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO')
    )
  order by up.created_at nulls last, ts.created_at nulls last
  limit 1;

  if v_user_id is null or v_target_team_season_id is null then
    raise exception 'PHASE3F_NEEDS_NONADMIN_PROFILE_AND_SCOPE';
  end if;

  perform set_config('iq.phase3f.user_id', v_user_id::text, true);
  perform set_config('iq.phase3f.user_email', coalesce(v_user_email,''), true);
  perform set_config('iq.phase3f.team_season_id', v_target_team_season_id::text, true);

  insert into public.team_season_memberships (
    user_id, team_season_id, function_role, status, valid_from, valid_until
  )
  values (
    v_user_id, v_target_team_season_id, 'ENTRENADOR', 'ACTIVE', now(), null
  )
  on conflict (user_id, team_season_id, function_role)
  do update set
    status = 'ACTIVE',
    valid_until = null,
    updated_at = now();

  select up.id, up.email
    into v_superadmin_id, v_superadmin_email
  from public.user_profiles up
  where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  if v_superadmin_id is null then
    raise exception 'PHASE3F_SUPERADMIN_REQUIRED';
  end if;

  perform set_config('iq.phase3f.superadmin_id', v_superadmin_id::text, true);
  perform set_config('iq.phase3f.superadmin_email', coalesce(v_superadmin_email,''), true);
end $$;

-- ---------------------------------------------------------------------------
-- ENTRENADOR: roster/request allowed, general admin and approval denied.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('iq.phase3f.user_id'),
    'email', current_setting('iq.phase3f.user_email'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  v_ts uuid := current_setting('iq.phase3f.team_season_id')::uuid;
begin
  if public.iq_v3_can_manage_team_season(v_ts) then
    raise exception 'ASSERT_COACH_MUST_NOT_GAIN_GENERAL_ADMIN';
  end if;
  if not public.iq_v3_can_manage_roster(v_ts) then
    raise exception 'ASSERT_COACH_ROSTER_PERMISSION_MISSING';
  end if;
  if not public.iq_v3_can_request_transfer(v_ts) then
    raise exception 'ASSERT_COACH_TRANSFER_REQUEST_PERMISSION_MISSING';
  end if;
  if public.iq_v3_can_approve_transfer_request() then
    raise exception 'ASSERT_COACH_MUST_NOT_APPROVE_TRANSFER';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- ANALISTA: same real user/scope, coach membership deactivated; roster/request
-- must now be denied.
-- ---------------------------------------------------------------------------
update public.team_season_memberships
   set status = 'INACTIVE',
       valid_until = now(),
       updated_at = now()
 where user_id = current_setting('iq.phase3f.user_id')::uuid
   and team_season_id = current_setting('iq.phase3f.team_season_id')::uuid
   and upper(function_role) = 'ENTRENADOR';

insert into public.team_season_memberships (
  user_id, team_season_id, function_role, status, valid_from, valid_until
)
values (
  current_setting('iq.phase3f.user_id')::uuid,
  current_setting('iq.phase3f.team_season_id')::uuid,
  'ANALISTA',
  'ACTIVE',
  now(),
  null
)
on conflict (user_id, team_season_id, function_role)
do update set
  status = 'ACTIVE',
  valid_until = null,
  updated_at = now();

set local role authenticated;

do $$
declare
  v_ts uuid := current_setting('iq.phase3f.team_season_id')::uuid;
begin
  if public.iq_v3_can_manage_roster(v_ts) then
    raise exception 'ASSERT_ANALYST_MUST_NOT_MANAGE_ROSTER';
  end if;
  if public.iq_v3_can_request_transfer(v_ts) then
    raise exception 'ASSERT_ANALYST_MUST_NOT_REQUEST_TRANSFER';
  end if;
  if public.iq_v3_can_approve_transfer_request() then
    raise exception 'ASSERT_ANALYST_MUST_NOT_APPROVE_TRANSFER';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- SUPERADMIN: roster/request/approval all allowed.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('iq.phase3f.superadmin_id'),
    'email', current_setting('iq.phase3f.superadmin_email'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

do $$
declare
  v_ts uuid := current_setting('iq.phase3f.team_season_id')::uuid;
begin
  if not public.iq_v3_can_manage_roster(v_ts) then
    raise exception 'ASSERT_SUPERADMIN_ROSTER_PERMISSION_MISSING';
  end if;
  if not public.iq_v3_can_request_transfer(v_ts) then
    raise exception 'ASSERT_SUPERADMIN_TRANSFER_REQUEST_PERMISSION_MISSING';
  end if;
  if not public.iq_v3_can_approve_transfer_request() then
    raise exception 'ASSERT_SUPERADMIN_APPROVAL_PERMISSION_MISSING';
  end if;

  raise notice
    'PHASE3F_RBAC_REHEARSAL_OK team_season=% coach_user=%',
    v_ts,
    current_setting('iq.phase3f.user_id');
end $$;

reset role;

rollback;
