-- =============================================================================
-- IQBasket v4 · Phase 4B Installed Functional Smoke · FORCED ROLLBACK
-- Date: 2026-09-03
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
  v_player_id uuid;
  v_team_season_id uuid;
  v_date date;
  v_training_type_id uuid;
  v_external_type_id uuid;
  v_session_id uuid;
  v_external_id uuid;
  v_load numeric;
begin
  if to_regclass('public.training_sessions') is null
     or to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb)') is null then
    raise exception 'PHASE4B_NOT_INSTALLED';
  end if;

  select
    rm.player_id,
    rm.team_season_id,
    greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
  into
    v_player_id,
    v_team_season_id,
    v_date
  from public.roster_memberships rm
  join public.roster_membership_stints rs on rs.roster_membership_id = rm.id
  join public.team_seasons ts on ts.id = rm.team_season_id
  join public.season_catalog sc on sc.id = ts.season_id
  where rs.valid_from is not null
    and (rs.valid_until is null or rs.valid_until >= rs.valid_from)
  order by rs.valid_from
  limit 1;

  if v_player_id is null then
    raise exception 'PHASE4B_SMOKE_ELIGIBLE_PLAYER_REQUIRED';
  end if;

  insert into public.player360_activity_types (
    team_season_id,module,code,name,created_by,updated_by
  )
  values (
    v_team_season_id,'TRAINING','ZZ_SMOKE_4B_TRAIN','ZZ Smoke 4B Training',auth.uid(),auth.uid()
  )
  returning id into v_training_type_id;

  insert into public.player360_activity_types (
    team_season_id,module,code,name,created_by,updated_by
  )
  values (
    v_team_season_id,'EXTERNAL_DEVELOPMENT','ZZ_SMOKE_4B_EXT','ZZ Smoke 4B External',auth.uid(),auth.uid()
  )
  returning id into v_external_type_id;

  v_session_id := public.iq_v4_create_training_session(
    v_team_season_id,
    v_date,
    'ZZ_SMOKE_4B Session',
    'Installed functional smoke',
    80,
    7,
    null,
    null,
    jsonb_build_array(
      jsonb_build_object(
        'activity_type_id',v_training_type_id,
        'block_order',1,
        'title','ZZ Smoke block',
        'duration_minutes',20,
        'intensity',8
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'player_id',v_player_id,
        'attendance_status','PRESENT',
        'participated_minutes',70,
        'rpe',6
      )
    )
  );

  select internal_load into v_load
  from public.training_participants
  where training_session_id = v_session_id
    and player_id = v_player_id;

  if v_load is distinct from 420 then
    raise exception 'ASSERT_PHASE4B_INSTALLED_TRAINING_LOAD: %', v_load;
  end if;

  v_external_id := public.iq_v4_create_external_development(
    v_team_season_id,
    v_player_id,
    v_date,
    'ZZ_SMOKE_4B External',
    'INDIVIDUAL',
    v_external_type_id,
    'EXTERNAL_COACH',
    'ZZ Smoke',
    null,
    50,
    6,
    5,
    'EXTERNAL_COACH',
    null,
    jsonb_build_object('smoke',true),
    '{}'::jsonb
  );

  select internal_load into v_load
  from public.external_development_sessions
  where id = v_external_id;

  if v_load is distinct from 250 then
    raise exception 'ASSERT_PHASE4B_INSTALLED_EXTERNAL_LOAD: %', v_load;
  end if;

  raise notice
    'PLAYER360_PHASE4B_INSTALLED_SMOKE_OK session=% external=%',
    v_session_id,
    v_external_id;
end $$;

reset role;
rollback;
