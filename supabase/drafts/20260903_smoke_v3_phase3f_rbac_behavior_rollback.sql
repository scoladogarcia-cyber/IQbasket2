-- =============================================================================
-- IQBasket v3 · PHASE 3F POST-APPLY RBAC BEHAVIOR SMOKE · FORCED ROLLBACK
-- Date: 2026-09-03
--
-- Assumes Phase 3F is already installed. Only temporary membership rows/statuses
-- are touched and everything in this script is rolled back.
-- =============================================================================

begin;

do $$
declare
  v_user_id uuid;
  v_user_email text;
  v_target_team_season_id uuid;
begin
  if to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null then
    raise exception 'PHASE3F_NOT_INSTALLED';
  end if;

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

  if v_user_id is null then
    raise exception 'PHASE3F_SMOKE_NEEDS_NONADMIN_PROFILE';
  end if;

  insert into public.team_season_memberships (
    user_id, team_season_id, function_role, status, valid_from, valid_until
  )
  values (
    v_user_id, v_target_team_season_id, 'ENTRENADOR', 'ACTIVE', now(), null
  )
  on conflict (user_id, team_season_id, function_role)
  do update set status='ACTIVE', valid_until=null, updated_at=now();

  perform set_config('iq.phase3f.user_id', v_user_id::text, true);
  perform set_config('iq.phase3f.user_email', coalesce(v_user_email,''), true);
  perform set_config('iq.phase3f.team_season_id', v_target_team_season_id::text, true);

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', coalesce(v_user_email,''),
      'role', 'authenticated'
    )::text,
    true
  );
end $$;

set local role authenticated;

do $$
declare
  v_ts uuid := current_setting('iq.phase3f.team_season_id')::uuid;
begin
  if public.iq_v3_can_manage_team_season(v_ts) then
    raise exception 'ASSERT_POSTAPPLY_COACH_GENERAL_ADMIN_LEAK';
  end if;
  if not public.iq_v3_can_manage_roster(v_ts) then
    raise exception 'ASSERT_POSTAPPLY_COACH_ROSTER_DENIED';
  end if;
  if not public.iq_v3_can_request_transfer(v_ts) then
    raise exception 'ASSERT_POSTAPPLY_COACH_TRANSFER_REQUEST_DENIED';
  end if;
  if public.iq_v3_can_approve_transfer_request() then
    raise exception 'ASSERT_POSTAPPLY_COACH_APPROVAL_LEAK';
  end if;

  raise notice
    'PHASE3F_POSTAPPLY_RBAC_SMOKE_OK team_season=% coach_user=%',
    v_ts,
    current_setting('iq.phase3f.user_id');
end $$;

reset role;

rollback;
