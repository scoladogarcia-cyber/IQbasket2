-- Training duration/attendance hotfix installed smoke.
-- Assumes hotfix is installed. Synthetic rows always ROLLBACK.

begin;

do $training_hotfix_installed$
declare
  v_admin uuid;
  v_team_season uuid;
  v_player uuid;
  v_date date;
  v_session uuid;
  v_duration integer;
  v_status text;
  v_minutes integer;
  v_error text;
begin
  select up.id into v_admin
  from public.user_profiles up
  where upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  select rm.team_season_id,rm.player_id,
         greatest(rms.valid_from,least(current_date,coalesce(rms.valid_until,current_date)))
    into v_team_season,v_player,v_date
  from public.roster_memberships rm
  join public.roster_membership_stints rms on rms.roster_membership_id=rm.id
  where rms.valid_from<=current_date
  order by rms.valid_from desc
  limit 1;

  if v_admin is null or v_team_season is null or v_player is null then
    raise exception 'TRAINING_HOTFIX_INSTALLED_FIXTURE_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_admin::text,'role','authenticated')::text,
    true
  );

  v_session:=public.iq_v4_create_training_session(
    v_team_season,
    v_date,
    'TRAINING_HOTFIX_INSTALLED_SMOKE',
    null,
    75,
    6,
    '18:00'::time,
    '19:15'::time,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('player_id',v_player))
  );

  select duration_minutes into v_duration
  from public.training_sessions where id=v_session;
  if v_duration<>75 then
    raise exception 'TRAINING_HOTFIX_INSTALLED_DURATION_FAILED';
  end if;

  select attendance_status,participated_minutes
    into v_status,v_minutes
  from public.training_participants
  where training_session_id=v_session and player_id=v_player;

  if v_status<>'PRESENT' or v_minutes<>75 then
    raise exception 'TRAINING_HOTFIX_INSTALLED_ATTENDANCE_FAILED';
  end if;

  begin
    perform public.iq_v4_create_training_session(
      v_team_season,
      v_date,
      'TRAINING_HOTFIX_INSTALLED_MISMATCH',
      null,
      60,
      5,
      '18:00'::time,
      '19:15'::time,
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'TRAINING_HOTFIX_INSTALLED_MISMATCH_NOT_BLOCKED';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if position('TRAINING_DURATION_MISMATCH' in v_error)=0 then raise; end if;
  end;

  raise notice 'TRAINING_DURATION_HOTFIX_INSTALLED_SMOKE_OK session=%',v_session;
end
$training_hotfix_installed$;

rollback;

select
  'TRAINING_DURATION_HOTFIX_INSTALLED_SMOKE_ROLLBACK' as section,
  position(
    'TRAINING_DURATION_MISMATCH' in pg_get_functiondef(
      'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
    )
  )>0 as hotfix_preserved,
  not exists (
    select 1 from public.training_sessions where title like 'TRAINING_HOTFIX_INSTALLED_%'
  ) as synthetic_rows_removed,
  (
    position(
      'TRAINING_DURATION_MISMATCH' in pg_get_functiondef(
        'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
      )
    )>0
    and not exists (
      select 1 from public.training_sessions where title like 'TRAINING_HOTFIX_INSTALLED_%'
    )
  ) as smoke_clean;
