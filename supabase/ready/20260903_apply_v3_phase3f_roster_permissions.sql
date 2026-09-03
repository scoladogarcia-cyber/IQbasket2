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

commit;

select
  'PHASE3F_APPLY' as section,
  to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null as roster_helper_ok,
  position(
    'iq_v3_can_manage_roster(p_team_season_id)'
    in pg_get_functiondef(to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)'))
  ) > 0 as create_uses_roster_helper,
  position(
    'iq_v3_can_manage_roster(p_to_team_season_id)'
    in pg_get_functiondef(to_regprocedure('public.iq_v3_can_request_transfer(uuid)'))
  ) > 0 as request_uses_roster_helper;
