-- =============================================================================
-- IQBasket Player 360 · Training + External Development edit V1
-- Additive RPCs. No existing domain rows are modified by installation.
-- =============================================================================
begin;

do $preflight$
begin
  if to_regclass('public.training_sessions') is null
     or to_regclass('public.training_blocks') is null
     or to_regclass('public.training_participants') is null
     or to_regclass('public.external_development_sessions') is null
     or to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null then
    raise exception 'TRAINING_EDIT_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

create or replace function public.iq_v4_update_training_session(
  p_training_session_id uuid,
  p_session_date date,
  p_title text,
  p_objective text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_start_time time default null,
  p_end_time time default null,
  p_blocks jsonb default null,
  p_participants jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_team_season_id uuid;
  v_duration_minutes integer := p_duration_minutes;
  v_default_attendance text;
  v_participated_minutes integer;
  v_block_id uuid;
  v_player_id uuid;
  v_keep_block_ids uuid[] := '{}'::uuid[];
  v_selected_player_ids uuid[] := '{}'::uuid[];
  block_item jsonb;
  participant_item jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select s.team_season_id
    into v_team_season_id
  from public.training_sessions s
  where s.id=p_training_session_id
    and upper(coalesce(s.status,'PLANNED')) <> 'ARCHIVED'
  for update;

  if v_team_season_id is null then raise exception 'TRAINING_SESSION_NOT_FOUND'; end if;
  if not public.iq_v4_can_manage_training(v_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  if p_title is null or length(trim(p_title))=0 then
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
      extract(epoch from (p_end_time-p_start_time))/60.0
    )::integer;
    if p_duration_minutes is not null and p_duration_minutes<>v_duration_minutes then
      raise exception 'TRAINING_DURATION_MISMATCH';
    end if;
  end if;

  if v_duration_minutes is not null
     and (v_duration_minutes<1 or v_duration_minutes>600) then
    raise exception 'TRAINING_DURATION_INVALID';
  end if;

  if p_blocks is not null and jsonb_typeof(p_blocks)<>'array' then
    raise exception 'TRAINING_BLOCKS_MUST_BE_ARRAY';
  end if;
  if p_participants is not null and jsonb_typeof(p_participants)<>'array' then
    raise exception 'TRAINING_PARTICIPANTS_MUST_BE_ARRAY';
  end if;

  -- Build the intended participant selection before changing the date.
  if p_participants is not null then
    for participant_item in select value from jsonb_array_elements(p_participants)
    loop
      v_player_id := nullif(participant_item->>'player_id','')::uuid;
      if v_player_id is null then raise exception 'TRAINING_PARTICIPANT_PLAYER_REQUIRED'; end if;
      if not public.iq_v3_player_eligible_on_date(v_player_id,v_team_season_id,p_session_date) then
        raise exception 'PLAYER_NOT_ELIGIBLE_ON_TRAINING_DATE';
      end if;
      if not (v_player_id=any(v_selected_player_ids)) then
        v_selected_player_ids := array_append(v_selected_player_ids,v_player_id);
      end if;
    end loop;

    -- Actual attendance is historical evidence and is never silently deleted.
    if exists (
      select 1
      from public.training_participants tp
      where tp.training_session_id=p_training_session_id
        and upper(coalesce(tp.attendance_status,'PLANNED'))<>'PLANNED'
        and not (tp.player_id=any(v_selected_player_ids))
    ) then
      raise exception 'TRAINING_CONFIRMED_PARTICIPANT_CANNOT_BE_REMOVED';
    end if;
  else
    if exists (
      select 1
      from public.training_participants tp
      where tp.training_session_id=p_training_session_id
        and not public.iq_v3_player_eligible_on_date(
          tp.player_id,v_team_season_id,p_session_date
        )
    ) then
      raise exception 'TRAINING_DATE_CONFLICTS_WITH_EXISTING_PARTICIPANT';
    end if;
  end if;

  update public.training_sessions
  set session_date=p_session_date,
      start_time=p_start_time,
      end_time=p_end_time,
      title=trim(p_title),
      objective=nullif(trim(coalesce(p_objective,'')),''),
      duration_minutes=v_duration_minutes,
      intensity=p_intensity,
      updated_by=auth.uid(),
      updated_at=now()
  where id=p_training_session_id;

  if p_blocks is not null then
    for block_item in select value from jsonb_array_elements(p_blocks)
    loop
      v_block_id := nullif(block_item->>'id','')::uuid;

      if v_block_id is not null then
        if not exists (
          select 1 from public.training_blocks b
          where b.id=v_block_id and b.training_session_id=p_training_session_id
        ) then
          raise exception 'TRAINING_BLOCK_SCOPE_MISMATCH';
        end if;

        update public.training_blocks
        set activity_type_id=case
              when nullif(block_item->>'activity_type_id','') is null then null
              else (block_item->>'activity_type_id')::uuid
            end,
            block_order=coalesce(nullif(block_item->>'block_order','')::integer,1),
            activity_code=nullif(trim(coalesce(block_item->>'activity_code','')),''),
            title=trim(coalesce(nullif(block_item->>'title',''),'Bloque')),
            objective=nullif(trim(coalesce(block_item->>'objective','')),''),
            duration_minutes=nullif(block_item->>'duration_minutes','')::integer,
            intensity=nullif(block_item->>'intensity','')::numeric,
            metadata=coalesce(block_item->'metadata','{}'::jsonb),
            updated_at=now()
        where id=v_block_id;
      else
        insert into public.training_blocks(
          training_session_id,activity_type_id,block_order,activity_code,title,
          objective,duration_minutes,intensity,metadata
        )
        values(
          p_training_session_id,
          case
            when nullif(block_item->>'activity_type_id','') is null then null
            else (block_item->>'activity_type_id')::uuid
          end,
          coalesce(nullif(block_item->>'block_order','')::integer,1),
          nullif(trim(coalesce(block_item->>'activity_code','')),''),
          trim(coalesce(nullif(block_item->>'title',''),'Bloque')),
          nullif(trim(coalesce(block_item->>'objective','')),''),
          nullif(block_item->>'duration_minutes','')::integer,
          nullif(block_item->>'intensity','')::numeric,
          coalesce(block_item->'metadata','{}'::jsonb)
        )
        returning id into v_block_id;
      end if;

      v_keep_block_ids := array_append(v_keep_block_ids,v_block_id);
    end loop;

    delete from public.training_blocks b
    where b.training_session_id=p_training_session_id
      and not (b.id=any(v_keep_block_ids));
  end if;

  if p_participants is not null then
    v_default_attendance := case
      when p_session_date<=current_date then 'PRESENT'
      else 'PLANNED'
    end;

    for participant_item in select value from jsonb_array_elements(p_participants)
    loop
      v_player_id := (participant_item->>'player_id')::uuid;
      v_participated_minutes := case
        when v_default_attendance='PRESENT' then v_duration_minutes
        else null
      end;

      insert into public.training_participants(
        training_session_id,team_season_id,player_id,attendance_status,
        participated_minutes,rpe,notes,captured_by
      )
      values(
        p_training_session_id,v_team_season_id,v_player_id,v_default_attendance,
        v_participated_minutes,null,null,auth.uid()
      )
      on conflict (training_session_id,player_id) do nothing;
    end loop;

    delete from public.training_participants tp
    where tp.training_session_id=p_training_session_id
      and not (tp.player_id=any(v_selected_player_ids))
      and upper(coalesce(tp.attendance_status,'PLANNED'))='PLANNED'
      and tp.participated_minutes is null
      and tp.rpe is null
      and nullif(trim(coalesce(tp.notes,'')),'') is null;
  end if;

  return p_training_session_id;
end;
$$;

create or replace function public.iq_v4_update_external_development(
  p_external_session_id uuid,
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
set search_path=''
as $$
declare
  v_team_season_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select e.team_season_id into v_team_season_id
  from public.external_development_sessions e
  where e.id=p_external_session_id
  for update;

  if v_team_season_id is null then
    raise exception 'EXTERNAL_DEVELOPMENT_NOT_FOUND';
  end if;
  if not public.iq_v4_can_manage_training(v_team_season_id) then
    raise exception 'EXTERNAL_DEVELOPMENT_MANAGE_DENIED';
  end if;
  if p_title is null or length(trim(p_title))=0 then
    raise exception 'EXTERNAL_DEVELOPMENT_TITLE_REQUIRED';
  end if;

  update public.external_development_sessions
  set player_id=p_player_id,
      activity_type_id=p_activity_type_id,
      activity_date=p_activity_date,
      title=trim(p_title),
      activity_code=nullif(trim(coalesce(p_activity_code,'')),''),
      provider_type=nullif(trim(coalesce(p_provider_type,'')),''),
      provider_name=nullif(trim(coalesce(p_provider_name,'')),''),
      objective=nullif(trim(coalesce(p_objective,'')),''),
      duration_minutes=p_duration_minutes,
      intensity=p_intensity,
      rpe=p_rpe,
      source_type=upper(coalesce(nullif(trim(p_source_type),''),'EXTERNAL_COACH')),
      notes=nullif(trim(coalesce(p_notes,'')),''),
      provenance=coalesce(p_provenance,'{}'::jsonb),
      metadata=coalesce(p_metadata,'{}'::jsonb),
      updated_by=auth.uid(),
      updated_at=now()
  where id=p_external_session_id;

  return p_external_session_id;
end;
$$;

create or replace function public.iq_v4_training_capabilities()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'ready',auth.uid() is not null,
    'training_core',true,
    'training_edit',true,
    'external_development',true,
    'external_development_edit',true,
    'activity_catalog',true,
    'temporal_roster_validation',true,
    'recovery',false,
    'nutrition',false,
    'neuro_cognitive',false,
    'contract_version','PLAYER360_OBSERVATION_V2'
  );
$$;

revoke all on function public.iq_v4_update_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) from public,anon;
revoke all on function public.iq_v4_update_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
) from public,anon;
revoke all on function public.iq_v4_training_capabilities() from public,anon;

grant execute on function public.iq_v4_update_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) to authenticated;
grant execute on function public.iq_v4_update_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
) to authenticated;
grant execute on function public.iq_v4_training_capabilities() to authenticated;

commit;

select 'TRAINING_EDIT_APPLY' as section,true as applied;
