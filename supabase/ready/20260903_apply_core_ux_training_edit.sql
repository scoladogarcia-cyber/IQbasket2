-- =============================================================================
-- IQBasket · Core UX Completion V1
-- Training / external development editable records + frozen-season guard.
-- =============================================================================
begin;

do $$
begin
  if to_regclass('public.training_sessions') is null
     or to_regclass('public.training_blocks') is null
     or to_regclass('public.training_participants') is null
     or to_regclass('public.external_development_sessions') is null
     or to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null then
    raise exception 'CORE_UX_TRAINING_EDIT_PREREQUISITES_MISSING';
  end if;
end $$;

-- Frozen seasons remain fully readable but immutable for Training/External.
create or replace function public.iq_v4_can_manage_training(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.team_seasons ts
      join public.teams t on t.id = ts.team_id
      where ts.id = p_team_season_id
        and upper(coalesce(ts.data_status, 'ACTIVE')) = 'ACTIVE'
        and (
          public.iq_v3_is_global_superadmin()

          or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = ts.id
              and upper(coalesce(m.status, 'ACTIVE')) = 'ACTIVE'
              and (m.valid_from is null or m.valid_from <= now())
              and (m.valid_until is null or m.valid_until > now())
              and upper(m.function_role) in (
                'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO',
                'ENTRENADOR','AYUDANTE','PREPARADOR_FISICO'
              )
          )

          or exists (
            select 1
            from public.club_season_memberships cm
            where cm.user_id = auth.uid()
              and cm.club_id = t.club_id
              and cm.season_id = ts.season_id
              and upper(coalesce(cm.status, 'ACTIVE')) = 'ACTIVE'
              and (cm.valid_from is null or cm.valid_from <= now())
              and (cm.valid_until is null or cm.valid_until > now())
              and upper(cm.function_role) in (
                'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'
              )
          )

          or exists (
            select 1
            from public.user_profiles up
            cross join lateral jsonb_array_elements_text(
              coalesce(to_jsonb(up.assigned_team_ids), '[]'::jsonb)
            ) assigned(team_id)
            where up.id = auth.uid()
              and assigned.team_id = ts.team_id::text
              and upper(coalesce(up.global_role, up.role, 'USER')) in (
                'ADMIN','ENTRENADOR','PREPARADOR_FISICO'
              )
          )
        )
    );
$$;

create or replace function public.iq_v4_update_training_session(
  p_training_session_id uuid,
  p_session_date date,
  p_title text,
  p_objective text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_start_time time default null,
  p_end_time time default null,
  p_blocks jsonb default '[]'::jsonb,
  p_participant_ids jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_season_id uuid;
  v_duration_minutes integer := p_duration_minutes;
  v_default_attendance text;
  v_player_id uuid;
  block_item jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select s.team_season_id
    into v_team_season_id
  from public.training_sessions s
  where s.id = p_training_session_id
  for update;

  if v_team_season_id is null then raise exception 'TRAINING_SESSION_NOT_FOUND'; end if;
  if not public.iq_v4_can_manage_training(v_team_season_id) then
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
    if p_duration_minutes is not null and p_duration_minutes <> v_duration_minutes then
      raise exception 'TRAINING_DURATION_MISMATCH';
    end if;
  end if;

  if v_duration_minutes is not null
     and (v_duration_minutes < 1 or v_duration_minutes > 600) then
    raise exception 'TRAINING_DURATION_INVALID';
  end if;

  if jsonb_typeof(coalesce(p_blocks,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_participant_ids,'[]'::jsonb)) <> 'array' then
    raise exception 'TRAINING_CHILDREN_MUST_BE_ARRAYS';
  end if;

  -- Every retained/new participant must be eligible on the corrected date.
  for v_player_id in
    select distinct value::uuid
    from jsonb_array_elements_text(coalesce(p_participant_ids,'[]'::jsonb))
  loop
    if not public.iq_v3_player_eligible_on_date(
      v_player_id,
      v_team_season_id,
      p_session_date
    ) then
      raise exception 'PLAYER_NOT_ELIGIBLE_ON_TRAINING_DATE';
    end if;
  end loop;

  update public.training_sessions
  set session_date = p_session_date,
      start_time = p_start_time,
      end_time = p_end_time,
      title = trim(p_title),
      objective = nullif(trim(coalesce(p_objective,'')), ''),
      duration_minutes = v_duration_minutes,
      intensity = p_intensity,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_training_session_id;

  -- Blocks have no independent observation payload; replacing them is explicit
  -- and prevents stale content after a structural correction.
  delete from public.training_blocks
  where training_session_id = p_training_session_id;

  for block_item in
    select value from jsonb_array_elements(coalesce(p_blocks,'[]'::jsonb))
  loop
    insert into public.training_blocks(
      training_session_id,activity_type_id,block_order,activity_code,
      title,objective,duration_minutes,intensity,metadata
    )
    values(
      p_training_session_id,
      case when nullif(block_item->>'activity_type_id','') is null
        then null else (block_item->>'activity_type_id')::uuid end,
      coalesce((block_item->>'block_order')::integer,1),
      nullif(trim(coalesce(block_item->>'activity_code','')),''),
      trim(coalesce(block_item->>'title','Bloque')),
      nullif(trim(coalesce(block_item->>'objective','')),''),
      nullif(block_item->>'duration_minutes','')::integer,
      nullif(block_item->>'intensity','')::numeric,
      coalesce(block_item->'metadata','{}'::jsonb)
    );
  end loop;

  -- Explicitly deselected players are removed. Retained rows keep their
  -- attendance/RPE/minutes/notes unchanged.
  delete from public.training_participants tp
  where tp.training_session_id = p_training_session_id
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_participant_ids,'[]'::jsonb)) ids(value)
      where ids.value::uuid = tp.player_id
    );

  v_default_attendance := case
    when p_session_date <= current_date then 'PRESENT'
    else 'PLANNED'
  end;

  for v_player_id in
    select distinct value::uuid
    from jsonb_array_elements_text(coalesce(p_participant_ids,'[]'::jsonb))
  loop
    insert into public.training_participants(
      training_session_id,team_season_id,player_id,attendance_status,
      participated_minutes,captured_by
    )
    values(
      p_training_session_id,
      v_team_season_id,
      v_player_id,
      v_default_attendance,
      case when v_default_attendance='PRESENT' then v_duration_minutes else null end,
      auth.uid()
    )
    on conflict (training_session_id,player_id) do nothing;
  end loop;

  return p_training_session_id;
end;
$$;

create or replace function public.iq_v4_update_external_development(
  p_external_development_id uuid,
  p_player_id uuid,
  p_activity_date date,
  p_title text,
  p_activity_code text default null,
  p_activity_type_id uuid default null,
  p_provider_type text default null,
  p_provider_name text default null,
  p_objective text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_rpe numeric default null,
  p_source_type text default 'EXTERNAL_COACH',
  p_notes text default null,
  p_provenance jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_season_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select e.team_season_id
    into v_team_season_id
  from public.external_development_sessions e
  where e.id = p_external_development_id
  for update;

  if v_team_season_id is null then
    raise exception 'EXTERNAL_DEVELOPMENT_NOT_FOUND';
  end if;

  if not public.iq_v4_can_manage_training(v_team_season_id) then
    raise exception 'EXTERNAL_DEVELOPMENT_MANAGE_DENIED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'EXTERNAL_DEVELOPMENT_TITLE_REQUIRED';
  end if;

  update public.external_development_sessions
  set player_id = p_player_id,
      activity_type_id = p_activity_type_id,
      activity_date = p_activity_date,
      title = trim(p_title),
      activity_code = nullif(trim(coalesce(p_activity_code,'')),''),
      provider_type = nullif(trim(coalesce(p_provider_type,'')),''),
      provider_name = nullif(trim(coalesce(p_provider_name,'')),''),
      objective = nullif(trim(coalesce(p_objective,'')),''),
      duration_minutes = p_duration_minutes,
      intensity = p_intensity,
      rpe = p_rpe,
      source_type = upper(coalesce(nullif(trim(p_source_type),''),'EXTERNAL_COACH')),
      notes = nullif(trim(coalesce(p_notes,'')),''),
      provenance = coalesce(p_provenance,'{}'::jsonb),
      metadata = coalesce(p_metadata,'{}'::jsonb),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_external_development_id;

  return p_external_development_id;
end;
$$;

revoke all on function public.iq_v4_update_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) from public,anon;
revoke all on function public.iq_v4_update_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
) from public,anon;

grant execute on function public.iq_v4_update_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) to authenticated;
grant execute on function public.iq_v4_update_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
) to authenticated;

create or replace function public.iq_core_ux_training_edit_capabilities()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'ready',auth.uid() is not null,
    'update_training',true,
    'update_external_development',true,
    'frozen_season_guard',true,
    'contract_version','CORE_UX_COMPLETION_V1'
  );
$$;

revoke all on function public.iq_core_ux_training_edit_capabilities() from public,anon;
grant execute on function public.iq_core_ux_training_edit_capabilities() to authenticated;

commit;
