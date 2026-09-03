-- IQBasket rollback - restore pre-hotfix training create RPC.

begin;

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
    p_duration_minutes,
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

  for participant_item in
    select value
    from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
  loop
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
      upper(coalesce(nullif(participant_item ->> 'attendance_status', ''), 'PLANNED')),
      nullif(participant_item ->> 'participated_minutes', '')::integer,
      nullif(participant_item ->> 'rpe', '')::numeric,
      nullif(trim(coalesce(participant_item ->> 'notes', '')), ''),
      auth.uid()
    );
  end loop;

  return v_session_id;
end;
$$;

commit;

select 'TRAINING_DURATION_HOTFIX_ROLLBACK' as section, true as rollback_ok;
