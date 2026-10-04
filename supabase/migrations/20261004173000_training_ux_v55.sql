-- =============================================================================
-- IQBasket · Training UX V55
-- Quick multi-select focus taxonomy + free coach note + safe clone provenance.
-- No existing training row is rewritten. Historical sessions remain readable.
-- =============================================================================

begin;

do $preflight$
begin
  if to_regclass('public.training_sessions') is null
     or to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)') is null
     or to_regprocedure('public.iq_v54_update_training_complete(uuid,uuid,jsonb,date,text,text,text,text,time without time zone,time without time zone,numeric,jsonb,jsonb,boolean)') is null
     or to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null
  then
    raise exception 'TRAINING_V55_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

create or replace function public.iq_v55_create_training_session(
  p_team_season_id uuid,
  p_session_date date,
  p_title text,
  p_objective text default null,
  p_notes text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_start_time time default null,
  p_end_time time default null,
  p_blocks jsonb default '[]'::jsonb,
  p_participants jsonb default '[]'::jsonb,
  p_focus_codes text[] default '{}'::text[],
  p_clone_source_id uuid default null,
  p_entry_mode text default 'QUICK'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_session_id uuid;
  v_focus_codes text[];
  v_code text;
  v_entry_mode text:=upper(trim(coalesce(p_entry_mode,'QUICK')));
  v_legacy_type text:='GENERAL';
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  select coalesce(array_agg(distinct upper(trim(x)) order by upper(trim(x))),'{}'::text[])
  into v_focus_codes
  from unnest(coalesce(p_focus_codes,'{}'::text[])) as x
  where nullif(trim(x),'') is not null;

  if cardinality(v_focus_codes)=0 or cardinality(v_focus_codes)>6 then
    raise exception 'TRAINING_FOCUS_SELECTION_REQUIRED';
  end if;

  foreach v_code in array v_focus_codes loop
    if v_code not in (
      'TECHNICAL','SHOOT_FINISH','TACTICAL_TEAM',
      'GAME_5V5','PHYSICAL','RECOVERY_PREMATCH'
    ) then
      raise exception 'TRAINING_FOCUS_INVALID:%',v_code;
    end if;
  end loop;

  if length(coalesce(p_notes,''))>1000 then
    raise exception 'TRAINING_NOTES_TOO_LONG';
  end if;
  if v_entry_mode not in ('QUICK','CLONE','ADVANCED') then
    raise exception 'TRAINING_ENTRY_MODE_INVALID';
  end if;

  if p_clone_source_id is not null and not exists (
    select 1 from public.training_sessions s
    where s.id=p_clone_source_id
      and s.team_season_id=p_team_season_id
      and upper(coalesce(s.status,'PLANNED'))<>'ARCHIVED'
  ) then
    raise exception 'TRAINING_CLONE_SOURCE_SCOPE_MISMATCH';
  end if;

  if cardinality(v_focus_codes)=1 then
    v_legacy_type:=case v_focus_codes[1]
      when 'TECHNICAL' then 'TECHNICAL'
      when 'SHOOT_FINISH' then 'SHOOTING'
      when 'TACTICAL_TEAM' then 'TACTICAL'
      when 'GAME_5V5' then 'SCRIMMAGE'
      when 'PHYSICAL' then 'PHYSICAL'
      when 'RECOVERY_PREMATCH' then 'RECOVERY'
      else 'GENERAL'
    end;
  end if;

  v_session_id:=public.iq_v4_create_training_session(
    p_team_season_id,
    p_session_date,
    coalesce(nullif(trim(coalesce(p_title,'')),''),'Entrenamiento'),
    p_objective,
    p_duration_minutes,
    p_intensity,
    p_start_time,
    p_end_time,
    coalesce(p_blocks,'[]'::jsonb),
    coalesce(p_participants,'[]'::jsonb)
  );

  update public.training_sessions
  set notes=nullif(trim(coalesce(p_notes,'')),''),
      metadata=coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object(
          'training_focus_codes',to_jsonb(v_focus_codes),
          'training_focus_schema_version','1.0',
          'entry_mode',v_entry_mode,
          'training_type',v_legacy_type,
          'cloned_from_session_id',p_clone_source_id
        ),
      updated_by=auth.uid(),
      updated_at=now()
  where id=v_session_id
    and team_season_id=p_team_season_id;

  return v_session_id;
end
$fn$;

revoke all on function public.iq_v55_create_training_session(
  uuid,date,text,text,text,integer,numeric,time,time,jsonb,jsonb,text[],uuid,text
) from public,anon;
grant execute on function public.iq_v55_create_training_session(
  uuid,date,text,text,text,integer,numeric,time,time,jsonb,jsonb,text[],uuid,text
) to authenticated;

create or replace function public.iq_v55_update_training_complete(
  p_session_id uuid,
  p_team_season_id uuid,
  p_revision jsonb,
  p_session_date date,
  p_title text,
  p_focus_codes text[],
  p_objective text,
  p_notes text,
  p_start_time time,
  p_end_time time,
  p_intensity numeric,
  p_blocks jsonb,
  p_participants jsonb,
  p_confirm_removals boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_result uuid;
  v_focus_codes text[];
  v_code text;
  v_legacy_type text:='GENERAL';
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'AUTH_REQUIRED';
  end if;

  select coalesce(array_agg(distinct upper(trim(x)) order by upper(trim(x))),'{}'::text[])
  into v_focus_codes
  from unnest(coalesce(p_focus_codes,'{}'::text[])) as x
  where nullif(trim(x),'') is not null;

  if cardinality(v_focus_codes)=0 or cardinality(v_focus_codes)>6 then
    raise exception 'TRAINING_FOCUS_SELECTION_REQUIRED';
  end if;
  foreach v_code in array v_focus_codes loop
    if v_code not in (
      'TECHNICAL','SHOOT_FINISH','TACTICAL_TEAM',
      'GAME_5V5','PHYSICAL','RECOVERY_PREMATCH'
    ) then
      raise exception 'TRAINING_FOCUS_INVALID:%',v_code;
    end if;
  end loop;

  if cardinality(v_focus_codes)=1 then
    v_legacy_type:=case v_focus_codes[1]
      when 'TECHNICAL' then 'TECHNICAL'
      when 'SHOOT_FINISH' then 'SHOOTING'
      when 'TACTICAL_TEAM' then 'TACTICAL'
      when 'GAME_5V5' then 'SCRIMMAGE'
      when 'PHYSICAL' then 'PHYSICAL'
      when 'RECOVERY_PREMATCH' then 'RECOVERY'
      else 'GENERAL'
    end;
  end if;

  v_result:=public.iq_v54_update_training_complete(
    p_session_id,
    p_team_season_id,
    p_revision,
    p_session_date,
    p_title,
    v_legacy_type,
    p_objective,
    p_notes,
    p_start_time,
    p_end_time,
    p_intensity,
    p_blocks,
    p_participants,
    p_confirm_removals
  );

  update public.training_sessions
  set metadata=jsonb_set(
        jsonb_set(
          coalesce(metadata,'{}'::jsonb),
          '{training_focus_codes}',
          to_jsonb(v_focus_codes),
          true
        ),
        '{training_focus_schema_version}',
        to_jsonb('1.0'::text),
        true
      ) || jsonb_build_object('training_type',v_legacy_type),
      updated_by=auth.uid(),
      updated_at=now()
  where id=p_session_id
    and team_season_id=p_team_season_id;

  return v_result;
end
$fn$;

revoke all on function public.iq_v55_update_training_complete(
  uuid,uuid,jsonb,date,text,text[],text,text,time,time,numeric,jsonb,jsonb,boolean
) from public,anon;
grant execute on function public.iq_v55_update_training_complete(
  uuid,uuid,jsonb,date,text,text[],text,text,time,time,numeric,jsonb,jsonb,boolean
) to authenticated;

commit;
