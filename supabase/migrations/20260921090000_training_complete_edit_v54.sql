-- Training V54: additive block-by-player participation and an atomic edit boundary.
-- No existing training record is rewritten by this migration.
create table if not exists public.training_block_participation (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.training_blocks(id) on delete cascade,
  participant_id uuid not null references public.training_participants(id) on delete cascade,
  participation_status text not null check (participation_status in ('FULL','PARTIAL','NOT_ATTENDED')),
  participated_minutes integer check (participated_minutes is null or participated_minutes between 0 and 300),
  exception_reason text check (exception_reason is null or exception_reason in ('LATE','EARLY','LIMITED','OTHER')),
  updated_at timestamptz not null default now(),
  unique(block_id,participant_id)
);

create or replace function public.iq_v54_validate_block_participation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_block_session uuid; v_participant_session uuid; v_duration integer;
begin
  select b.training_session_id,b.duration_minutes into v_block_session,v_duration
  from public.training_blocks b where b.id=new.block_id;
  select p.training_session_id into v_participant_session
  from public.training_participants p where p.id=new.participant_id;
  if v_block_session is null or v_participant_session is distinct from v_block_session then
    raise exception 'TRAINING_BLOCK_PARTICIPANT_SCOPE_MISMATCH';
  end if;
  if new.participation_status='NOT_ATTENDED' and coalesce(new.participated_minutes,0)<>0 then
    raise exception 'TRAINING_BLOCK_ABSENT_MINUTES_INVALID';
  end if;
  if new.participation_status='FULL' and v_duration is not null
      and new.participated_minutes is not null and new.participated_minutes<>v_duration then
    raise exception 'TRAINING_BLOCK_FULL_MINUTES_MISMATCH';
  end if;
  if v_duration is not null and new.participated_minutes>v_duration then
    raise exception 'TRAINING_BLOCK_MINUTES_EXCEED_DURATION';
  end if;
  new.updated_at:=now();
  return new;
end;$$;

drop trigger if exists trg_iq_v54_block_participation_validate on public.training_block_participation;
create trigger trg_iq_v54_block_participation_validate
before insert or update on public.training_block_participation
for each row execute function public.iq_v54_validate_block_participation();

alter table public.training_block_participation enable row level security;
revoke all on public.training_block_participation from public,anon,authenticated;
grant select on public.training_block_participation to authenticated;
drop policy if exists iq_v54_training_block_participation_staff_read on public.training_block_participation;
create policy iq_v54_training_block_participation_staff_read
on public.training_block_participation for select to authenticated using (
  public.iq_account_is_active() and exists (
    select 1 from public.training_participants p
    where p.id=participant_id and public.iq_v4_can_manage_training(p.team_season_id)
  )
);

-- A single transaction controls metadata, blocks, roster and block exceptions.
-- The client must send the full current revision (including child timestamps).
create or replace function public.iq_v54_update_training_complete(
  p_session_id uuid,p_team_season_id uuid,p_revision jsonb,
  p_session_date date,p_title text,p_training_type text,p_objective text,p_notes text,
  p_start_time time,p_end_time time,p_intensity numeric,
  p_blocks jsonb,p_participants jsonb,p_confirm_removals boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_session public.training_sessions%rowtype;
  v_duration integer;
  v_block jsonb; v_person jsonb; v_assignment jsonb;
  v_block_id uuid; v_participant_id uuid; v_player_id uuid;
  v_keys text[]:='{}'; v_player_ids uuid[]:='{}'; v_keep_blocks uuid[]:='{}';
  v_key text; v_map jsonb:='{}'::jsonb;
  v_old_blocks jsonb; v_old_participants jsonb; v_old_assignments jsonb;
  v_status text; v_minutes integer; v_rpe numeric; v_block_duration integer;
  v_reason text; v_participation text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_session from public.training_sessions where id=p_session_id for update;
  if not found or v_session.team_season_id is distinct from p_team_season_id
    or upper(v_session.status)='ARCHIVED' then raise exception 'TRAINING_NOT_EDITABLE_OR_SCOPE_MISMATCH'; end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) or exists (
    select 1 from public.team_seasons t where t.id=p_team_season_id
      and upper(coalesce(t.data_status,'ACTIVE'))<>'ACTIVE'
  ) then raise exception 'TRAINING_EDIT_DENIED_OR_SEASON_FROZEN'; end if;
  if p_revision is null or v_session.updated_at is distinct from (p_revision->>'session')::timestamptz then
    raise exception 'TRAINING_CHANGED_RELOAD_REQUIRED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id),'[]'::jsonb)
    into v_old_blocks from public.training_blocks where training_session_id=p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id),'[]'::jsonb)
    into v_old_participants from public.training_participants where training_session_id=p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'updated_at',x.updated_at) order by x.id),'[]'::jsonb)
    into v_old_assignments from public.training_block_participation x
    join public.training_blocks b on b.id=x.block_id where b.training_session_id=p_session_id;
  if v_old_blocks is distinct from coalesce(p_revision->'blocks','[]'::jsonb)
     or v_old_participants is distinct from coalesce(p_revision->'participants','[]'::jsonb)
     or v_old_assignments is distinct from coalesce(p_revision->'assignments','[]'::jsonb)
  then raise exception 'TRAINING_CHILDREN_CHANGED_RELOAD_REQUIRED'; end if;
  if p_title is null or length(trim(p_title))=0 or length(trim(p_title))>140
    or p_session_date is null or p_start_time is null or p_end_time is null
    or p_end_time<=p_start_time then raise exception 'TRAINING_DATE_TITLE_OR_TIME_INVALID'; end if;
  v_duration:=round(extract(epoch from (p_end_time-p_start_time))/60.0)::integer;
  if v_duration not between 1 and 600 or (p_intensity is not null and p_intensity not between 0 and 10)
    or length(coalesce(p_objective,''))>500 or length(coalesce(p_notes,''))>1000
    or length(coalesce(p_training_type,''))>80 then raise exception 'TRAINING_FIELD_OUT_OF_RANGE'; end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks)>40
    or jsonb_typeof(p_participants) is distinct from 'array' or jsonb_array_length(p_participants)>100
  then raise exception 'TRAINING_BLOCKS_OR_PARTICIPANTS_INVALID'; end if;
  -- Validate all identities and ranges BEFORE touching any parent or child row.
  for v_block in select value from jsonb_array_elements(p_blocks) loop
    v_key:=nullif(trim(v_block->>'key'),'');
    if v_key is null or v_key=any(v_keys) or length(v_key)>100
      or length(trim(coalesce(v_block->>'title','')))=0 or length(v_block->>'title')>140
      or (v_block->>'duration_minutes')::integer not between 1 and 300
      or ((v_block->>'intensity') is not null and (v_block->>'intensity')::numeric not between 0 and 10)
      or length(coalesce(v_block->>'activity_code',''))>80 or length(coalesce(v_block->>'objective',''))>500
    then raise exception 'TRAINING_BLOCK_INVALID_OR_DUPLICATED'; end if;
    v_keys:=array_append(v_keys,v_key);
    if nullif(v_block->>'id','') is not null and not exists (
      select 1 from public.training_blocks where id=(v_block->>'id')::uuid and training_session_id=p_session_id
    ) then raise exception 'TRAINING_BLOCK_SCOPE_MISMATCH'; end if;
  end loop;
  for v_person in select value from jsonb_array_elements(p_participants) loop
    v_player_id:=(v_person->>'player_id')::uuid; v_status:=upper(coalesce(v_person->>'status',''));
    v_minutes:=nullif(v_person->>'minutes','')::integer;
    v_rpe:=nullif(v_person->>'rpe','')::numeric;
    if v_player_id is null or v_player_id=any(v_player_ids)
       or not public.iq_v3_player_eligible_on_date(v_player_id,p_team_season_id,p_session_date)
       or v_status not in ('PLANNED','PRESENT','PARTIAL','ABSENT','EXCUSED')
       or (v_minutes is not null and v_minutes not between 0 and v_duration)
       or (v_rpe is not null and v_rpe not between 0 and 10)
       or length(coalesce(v_person->>'notes',''))>240
       or (v_status in ('ABSENT','EXCUSED') and coalesce(v_minutes,0)<>0)
       or jsonb_typeof(coalesce(v_person->'blocks','[]'::jsonb))<>'array'
    then raise exception 'TRAINING_PARTICIPANT_INVALID_OR_INELIGIBLE'; end if;
    v_player_ids:=array_append(v_player_ids,v_player_id);
    for v_assignment in select value from jsonb_array_elements(coalesce(v_person->'blocks','[]'::jsonb)) loop
      v_key:=v_assignment->>'key'; v_participation:=v_assignment->>'status';
      if v_key is null or not(v_key=any(v_keys))
        or v_participation not in ('FULL','PARTIAL','NOT_ATTENDED')
        or (nullif(v_assignment->>'minutes','') is not null and (v_assignment->>'minutes')::integer not between 0 and 300)
        or (nullif(v_assignment->>'reason','') is not null and (v_assignment->>'reason') not in ('LATE','EARLY','LIMITED','OTHER'))
      then raise exception 'TRAINING_BLOCK_ASSIGNMENT_INVALID'; end if;
    end loop;
  end loop;
  if exists (select 1 from public.training_participants p
      where p.training_session_id=p_session_id and not(p.player_id=any(v_player_ids)))
      and not p_confirm_removals then raise exception 'TRAINING_REMOVAL_REQUIRES_CONFIRMATION'; end if;

  -- Explicit removals are allowed as a correction; cascade removes their block assignments.
  delete from public.training_participants p where p.training_session_id=p_session_id
    and not(p.player_id=any(v_player_ids));
  -- Duration trigger synchronizes previously full-session participants; the explicit
  -- participant payload below is authoritative for partial attendance corrections.
  update public.training_sessions set session_date=p_session_date,title=trim(p_title),
    objective=nullif(trim(coalesce(p_objective,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),
    start_time=p_start_time,end_time=p_end_time,duration_minutes=v_duration,intensity=p_intensity,
    metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{training_type}',to_jsonb(coalesce(nullif(trim(p_training_type),''),'GENERAL'))),
    updated_by=auth.uid(),updated_at=now() where id=p_session_id;
  for v_block in select value from jsonb_array_elements(p_blocks) loop
    v_block_id:=nullif(v_block->>'id','')::uuid;v_key:=v_block->>'key';
    if v_block_id is null then
      insert into public.training_blocks(training_session_id,block_order,title,activity_code,objective,duration_minutes,intensity)
      values(p_session_id,(v_block->>'order')::integer,trim(v_block->>'title'),
        nullif(trim(coalesce(v_block->>'activity_code','')),''),nullif(trim(coalesce(v_block->>'objective','')),''),
        (v_block->>'duration_minutes')::integer,nullif(v_block->>'intensity','')::numeric)
      returning id into v_block_id;
    else
      update public.training_blocks set block_order=(v_block->>'order')::integer,title=trim(v_block->>'title'),
        activity_code=nullif(trim(coalesce(v_block->>'activity_code','')),''),
        objective=nullif(trim(coalesce(v_block->>'objective','')),''),
        duration_minutes=(v_block->>'duration_minutes')::integer,
        intensity=nullif(v_block->>'intensity','')::numeric where id=v_block_id and training_session_id=p_session_id;
    end if;
    v_map:=v_map||jsonb_build_object(v_key,v_block_id::text);
    v_keep_blocks:=array_append(v_keep_blocks,v_block_id);
  end loop;
  delete from public.training_blocks b where b.training_session_id=p_session_id
    and not(b.id=any(v_keep_blocks));
  for v_person in select value from jsonb_array_elements(p_participants) loop
    v_player_id:=(v_person->>'player_id')::uuid;v_status:=v_person->>'status';
    v_minutes:=nullif(v_person->>'minutes','')::integer;v_rpe:=nullif(v_person->>'rpe','')::numeric;
    insert into public.training_participants(training_session_id,team_season_id,player_id,attendance_status,participated_minutes,rpe,notes,captured_by)
    values(p_session_id,p_team_season_id,v_player_id,v_status,v_minutes,v_rpe,nullif(trim(coalesce(v_person->>'notes','')),''),auth.uid())
    on conflict(training_session_id,player_id) do update set attendance_status=excluded.attendance_status,
      participated_minutes=excluded.participated_minutes,rpe=excluded.rpe,notes=excluded.notes,
      captured_by=auth.uid(),updated_at=now()
    returning id into v_participant_id;
    delete from public.training_block_participation where participant_id=v_participant_id;
    for v_assignment in select value from jsonb_array_elements(coalesce(v_person->'blocks','[]'::jsonb)) loop
      v_block_id:=(v_map->>(v_assignment->>'key'))::uuid;
      select duration_minutes into v_block_duration from public.training_blocks where id=v_block_id;
      v_participation:=v_assignment->>'status';
      v_minutes:=nullif(v_assignment->>'minutes','')::integer;
      v_reason:=nullif(v_assignment->>'reason','');
      if v_participation='NOT_ATTENDED' then v_minutes:=0; end if;
      if v_participation='FULL' and v_minutes is null then v_minutes:=v_block_duration; end if;
      insert into public.training_block_participation(block_id,participant_id,participation_status,participated_minutes,exception_reason)
      values(v_block_id,v_participant_id,v_participation,v_minutes,v_reason);
    end loop;
  end loop;
  return p_session_id;
end;$$;
revoke all on function public.iq_v54_update_training_complete(uuid,uuid,jsonb,date,text,text,text,text,time,time,numeric,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.iq_v54_update_training_complete(uuid,uuid,jsonb,date,text,text,text,text,time,time,numeric,jsonb,jsonb,boolean) to authenticated;
