-- =============================================================================
-- IQBasket hotfix - canonical training duration + historical participant defaults
-- Replaces only iq_v4_create_training_session. Additive data behavior, no schema drop.
-- =============================================================================

begin;

do $training_hotfix$
begin
  if to_regclass('public.training_sessions') is null
     or to_regclass('public.training_participants') is null
     or to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)') is null
     or to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null then
    raise exception 'TRAINING_DURATION_HOTFIX_PREREQUISITES_MISSING';
  end if;
end
$training_hotfix$;

create or replace function public.iq_v4_create_training_session(
  p_team_season_id uuid,
  p_session_date date,
  p_title text,
  p_objective text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_start_time time default null,
  p_end_time time default null,
  p_blocks jsonb default '[]'::jsonb,
  p_participants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_duration_minutes integer := p_duration_minutes;
  v_default_attendance text;
  v_attendance text;
  v_participated_minutes integer;
  block_item jsonb;
  participant_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'TRAINING_TITLE_REQUIRED';
  end if;

  if (p_start_time is null) <> (p_end_time is null) then
    raise exception 'TRAINING_TIME_PAIR_REQUIRED';
  end if;

  if p_start_time is not null and p_end_time is not null then
    if p_end_time <= p_start_time then
      raise exception 'TRAINING_TIME_RANGE_INVALID';
    end if;

    v_duration_minutes := round(
      extract(epoch from (p_end_time - p_start_time)) / 60.0
    )::integer;

    if p_duration_minutes is not null
       and p_duration_minutes <> v_duration_minutes then
      raise exception 'TRAINING_DURATION_MISMATCH';
    end if;
  end if;

  if v_duration_minutes is not null
     and (v_duration_minutes < 1 or v_duration_minutes > 600) then
    raise exception 'TRAINING_DURATION_INVALID';
  end if;

  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_participants, '[]'::jsonb)) <> 'array' then
    raise exception 'TRAINING_CHILDREN_MUST_BE_ARRAYS';
  end if;

  insert into public.training_sessions (
    team_season_id,
    session_date,
    start_time,
    end_time,
    title,
    objective,
    duration_minutes,
    intensity,
    status,
    created_by,
    updated_by
  )
  values (
    p_team_season_id,
    p_session_date,
    p_start_time,
    p_end_time,
    trim(p_title),
    nullif(trim(coalesce(p_objective, '')), ''),
    v_duration_minutes,
    p_intensity,
    'PLANNED',
    auth.uid(),
    auth.uid()
  )
  returning id into v_session_id;

  for block_item in
    select value
    from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb))
  loop
    insert into public.training_blocks (
      training_session_id,
      activity_type_id,
      block_order,
      activity_code,
      title,
      objective,
      duration_minutes,
      intensity,
      metadata
    )
    values (
      v_session_id,
      case
        when nullif(block_item ->> 'activity_type_id', '') is null then null
        else (block_item ->> 'activity_type_id')::uuid
      end,
      coalesce((block_item ->> 'block_order')::integer, 1),
      nullif(trim(coalesce(block_item ->> 'activity_code', '')), ''),
      trim(coalesce(block_item ->> 'title', 'Bloque')),
      nullif(trim(coalesce(block_item ->> 'objective', '')), ''),
      nullif(block_item ->> 'duration_minutes', '')::integer,
      nullif(block_item ->> 'intensity', '')::numeric,
      coalesce(block_item -> 'metadata', '{}'::jsonb)
    );
  end loop;

  v_default_attendance := case
    when p_session_date <= current_date then 'PRESENT'
    else 'PLANNED'
  end;

  for participant_item in
    select value
    from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
  loop
    v_attendance := upper(
      coalesce(
        nullif(participant_item ->> 'attendance_status', ''),
        v_default_attendance
      )
    );
    v_participated_minutes :=
      nullif(participant_item ->> 'participated_minutes', '')::integer;

    if v_participated_minutes is null
       and v_attendance = 'PRESENT'
       and p_session_date <= current_date then
      v_participated_minutes := v_duration_minutes;
    end if;

    insert into public.training_participants (
      training_session_id,
      team_season_id,
      player_id,
      attendance_status,
      participated_minutes,
      rpe,
      notes,
      captured_by
    )
    values (
      v_session_id,
      p_team_season_id,
      (participant_item ->> 'player_id')::uuid,
      v_attendance,
      v_participated_minutes,
      nullif(participant_item ->> 'rpe', '')::numeric,
      nullif(trim(coalesce(participant_item ->> 'notes', '')), ''),
      auth.uid()
    );
  end loop;

  return v_session_id;
end;
$$;

revoke all on function public.iq_v4_create_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) from public, anon;
grant execute on function public.iq_v4_create_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) to authenticated;


-- Functional smoke. Function replacement and synthetic rows are rolled back.
do $training_hotfix_smoke$
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
    raise exception 'TRAINING_HOTFIX_SMOKE_FIXTURE_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_admin::text,'role','authenticated')::text,
    true
  );

  v_session:=public.iq_v4_create_training_session(
    v_team_season,
    v_date,
    'TRAINING_HOTFIX_SMOKE',
    null,
    60,
    5,
    '18:00'::time,
    '19:00'::time,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('player_id',v_player))
  );

  select duration_minutes into v_duration
  from public.training_sessions where id=v_session;
  if v_duration<>60 then
    raise exception 'TRAINING_HOTFIX_SMOKE_DURATION_FAILED';
  end if;

  select attendance_status,participated_minutes
    into v_status,v_minutes
  from public.training_participants
  where training_session_id=v_session and player_id=v_player;

  if v_status<>'PRESENT' or v_minutes<>60 then
    raise exception 'TRAINING_HOTFIX_SMOKE_HISTORICAL_ATTENDANCE_FAILED';
  end if;

  begin
    perform public.iq_v4_create_training_session(
      v_team_season,
      v_date,
      'TRAINING_HOTFIX_MISMATCH',
      null,
      45,
      5,
      '18:00'::time,
      '19:00'::time,
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'TRAINING_HOTFIX_SMOKE_MISMATCH_NOT_BLOCKED';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if position('TRAINING_DURATION_MISMATCH' in v_error)=0 then
      raise;
    end if;
  end;

  begin
    perform public.iq_v4_create_training_session(
      v_team_season,
      v_date,
      'TRAINING_HOTFIX_HALF_TIME',
      null,
      null,
      5,
      '18:00'::time,
      null,
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'TRAINING_HOTFIX_SMOKE_HALF_TIME_NOT_BLOCKED';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if position('TRAINING_TIME_PAIR_REQUIRED' in v_error)=0 then
      raise;
    end if;
  end;

  raise notice 'TRAINING_DURATION_HOTFIX_REHEARSAL_OK session=%',v_session;
end
$training_hotfix_smoke$;

rollback;

select
  'TRAINING_DURATION_HOTFIX_REHEARSAL_ROLLBACK' as section,
  position(
    'TRAINING_DURATION_MISMATCH' in pg_get_functiondef(
      'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
    )
  )=0 as function_restored,
  not exists (
    select 1 from public.training_sessions where title like 'TRAINING_HOTFIX_%'
  ) as synthetic_rows_removed,
  (
    position(
      'TRAINING_DURATION_MISMATCH' in pg_get_functiondef(
        'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
      )
    )=0
    and not exists (
      select 1 from public.training_sessions where title like 'TRAINING_HOTFIX_%'
    )
  ) as rollback_clean;
