-- =============================================================================
-- IQBasket v3 · Staff season isolation smoke · FORCED ROLLBACK
-- Date: 2026-09-03
-- Validates that editing HEAD_COACH in one team-season cannot alter another.
-- =============================================================================

begin;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', coalesce(up.email, ''),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $$
declare
  v_team_id uuid;
  v_target_ts uuid;
  v_other_ts uuid;
  v_other_before text;
  v_other_after text;
  v_assignment public.team_season_staff_assignments;
  v_target_active_name text;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'STAFF_SEASON_SMOKE_AUTH_FAILED';
  end if;

  select ts.team_id
    into v_team_id
  from public.team_seasons ts
  group by ts.team_id
  having count(*) >= 2
  order by count(*) desc, ts.team_id
  limit 1;

  if v_team_id is null then
    raise exception 'STAFF_SEASON_SMOKE_REQUIRES_TWO_SEASONS';
  end if;

  select ts.id
    into v_target_ts
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where ts.team_id = v_team_id
  order by sc.start_date desc nulls last, sc.name desc, ts.created_at desc
  limit 1;

  select ts.id
    into v_other_ts
  from public.team_seasons ts
  where ts.team_id = v_team_id
    and ts.id <> v_target_ts
  order by ts.created_at desc
  limit 1;

  if v_target_ts is null or v_other_ts is null then
    raise exception 'STAFF_SEASON_SMOKE_SCOPE_RESOLUTION_FAILED';
  end if;

  select coalesce(
    string_agg(
      concat_ws(
        ':',
        a.id::text,
        a.staff_role,
        a.status,
        coalesce(a.user_id::text, ''),
        coalesce(a.external_name, '')
      ),
      '|' order by a.id
    ),
    ''
  )
  into v_other_before
  from public.team_season_staff_assignments a
  where a.team_season_id = v_other_ts;

  v_assignment := public.iq_v3_assign_team_season_staff(
    v_target_ts,
    'HEAD_COACH',
    null,
    'ZZ_SMOKE_SEASON_COACH'
  );

  if v_assignment.id is null
     or v_assignment.team_season_id <> v_target_ts
     or upper(v_assignment.staff_role) <> 'HEAD_COACH'
     or upper(v_assignment.status) <> 'ACTIVE'
     or v_assignment.external_name <> 'ZZ_SMOKE_SEASON_COACH' then
    raise exception 'ASSERT_TARGET_HEAD_COACH_NOT_UPDATED_CORRECTLY';
  end if;

  select a.external_name
    into v_target_active_name
  from public.team_season_staff_assignments a
  where a.team_season_id = v_target_ts
    and upper(a.staff_role) = 'HEAD_COACH'
    and upper(a.status) = 'ACTIVE'
  limit 1;

  if v_target_active_name is distinct from 'ZZ_SMOKE_SEASON_COACH' then
    raise exception 'ASSERT_TARGET_ACTIVE_COACH_MISMATCH: %', v_target_active_name;
  end if;

  select coalesce(
    string_agg(
      concat_ws(
        ':',
        a.id::text,
        a.staff_role,
        a.status,
        coalesce(a.user_id::text, ''),
        coalesce(a.external_name, '')
      ),
      '|' order by a.id
    ),
    ''
  )
  into v_other_after
  from public.team_season_staff_assignments a
  where a.team_season_id = v_other_ts;

  if v_other_after is distinct from v_other_before then
    raise exception 'ASSERT_OTHER_SEASON_STAFF_CHANGED';
  end if;

  raise notice
    'SEASON_HEAD_COACH_ISOLATION_SMOKE_OK team=% target_ts=% other_ts=%',
    v_team_id,
    v_target_ts,
    v_other_ts;
end $$;

reset role;
rollback;
