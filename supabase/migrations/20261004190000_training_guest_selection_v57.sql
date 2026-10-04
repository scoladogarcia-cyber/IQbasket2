-- =============================================================================
-- IQBasket · Training Player Selection V57
-- Allows permission-scoped training guests without altering roster membership.
-- Current roster semantics for games remain untouched.
-- =============================================================================

begin;

do $preflight$
begin
  if to_regclass('public.training_participants') is null
     or to_regclass('public.players') is null
     or to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
  then
    raise exception 'TRAINING_PLAYER_SELECTION_V57_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

alter table public.training_participants
  add column if not exists participant_origin text not null default 'ROSTER';

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='training_participants_origin_check'
      and conrelid='public.training_participants'::regclass
  ) then
    alter table public.training_participants
      add constraint training_participants_origin_check
      check (participant_origin in ('ROSTER','GUEST'));
  end if;
end
$constraint$;

create or replace function public.iq_v57_can_select_training_player(
  p_player_id uuid,
  p_team_season_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_team_id uuid;
  v_club_id uuid;
  v_season_id uuid;
  v_profile_role text;
  v_is_superadmin boolean:=false;
  v_can_browse_club boolean:=false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    return false;
  end if;
  if p_player_id is null or p_team_season_id is null then
    return false;
  end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    return false;
  end if;

  select ts.team_id,t.club_id,ts.season_id
    into v_team_id,v_club_id,v_season_id
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id
  where ts.id=p_team_season_id;

  if v_team_id is null then
    return false;
  end if;

  select upper(coalesce(pr.role,''))
    into v_profile_role
  from public.profiles pr
  where pr.id=auth.uid();

  v_is_superadmin:=public.iq_v3_is_global_superadmin();

  v_can_browse_club:=
    v_is_superadmin
    or v_profile_role in ('SUPERADMIN','ADMIN')
    or exists (
      select 1
      from public.club_season_memberships csm
      where csm.user_id=auth.uid()
        and csm.club_id=v_club_id
        and (csm.season_id is null or csm.season_id=v_season_id)
        and upper(coalesce(csm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
        and (csm.valid_from is null or csm.valid_from<=now())
        and (csm.valid_until is null or csm.valid_until>=now())
    );

  return exists (
    select 1
    from public.players p
    where p.id=p_player_id
      and (
        exists (
          select 1
          from public.roster_memberships current_rm
          where current_rm.player_id=p.id
            and current_rm.team_season_id=p_team_season_id
        )
        or p.team_id=v_team_id
        or exists (
          select 1
          from public.roster_memberships historical_rm
          join public.team_seasons historical_ts
            on historical_ts.id=historical_rm.team_season_id
          where historical_rm.player_id=p.id
            and historical_ts.team_id=v_team_id
        )
        or (
          v_can_browse_club
          and exists (
            select 1
            from public.teams player_team
            where player_team.id=p.team_id
              and player_team.club_id=v_club_id
          )
        )
        or v_is_superadmin
      )
  );
end
$fn$;

revoke all on function public.iq_v57_can_select_training_player(uuid,uuid)
  from public,anon;
grant execute on function public.iq_v57_can_select_training_player(uuid,uuid)
  to authenticated;

create or replace function public.iq_v57_resolve_training_players(
  p_team_season_id uuid,
  p_player_ids uuid[]
)
returns table(
  player_id uuid,
  first_name text,
  last_name text,
  photo_url text,
  jersey integer,
  primary_position text,
  team_id uuid,
  team_name text,
  is_current_roster boolean,
  is_current_team boolean
)
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_team_id uuid;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  select ts.team_id into v_team_id
  from public.team_seasons ts
  where ts.id=p_team_season_id;

  return query
  with current_roster as (
    select distinct on (rm.player_id)
      rm.player_id,rm.jersey,rm.primary_position
    from public.roster_memberships rm
    where rm.team_season_id=p_team_season_id
    order by rm.player_id,rm.updated_at desc nulls last,rm.created_at desc nulls last
  )
  select
    p.id,
    p.first_name,
    p.last_name,
    p.photo_url,
    coalesce(cr.jersey,p.jersey),
    coalesce(nullif(cr.primary_position,''),p.primary_position),
    p.team_id,
    pt.name,
    (cr.player_id is not null),
    (
      cr.player_id is not null
      or p.team_id=v_team_id
      or exists (
        select 1
        from public.roster_memberships rm_hist
        join public.team_seasons ts_hist on ts_hist.id=rm_hist.team_season_id
        where rm_hist.player_id=p.id and ts_hist.team_id=v_team_id
      )
    )
  from public.players p
  left join current_roster cr on cr.player_id=p.id
  left join public.teams pt on pt.id=p.team_id
  where p.id=any(coalesce(p_player_ids,'{}'::uuid[]))
    and (
      public.iq_v57_can_select_training_player(p.id,p_team_season_id)
      or exists (
        select 1
        from public.training_participants tp
        join public.training_sessions s on s.id=tp.training_session_id
        where tp.player_id=p.id
          and s.team_season_id=p_team_season_id
      )
    );
end
$fn$;

revoke all on function public.iq_v57_resolve_training_players(uuid,uuid[])
  from public,anon;
grant execute on function public.iq_v57_resolve_training_players(uuid,uuid[])
  to authenticated;

create or replace function public.iq_v4_validate_training_participant()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  session_scope uuid;
  training_date date;
  v_roster_eligible boolean;
  v_existing boolean:=false;
begin
  select s.team_season_id,s.session_date
    into session_scope,training_date
  from public.training_sessions s
  where s.id=new.training_session_id;

  if session_scope is null then
    raise exception 'TRAINING_SESSION_NOT_FOUND';
  end if;

  if new.team_season_id is distinct from session_scope then
    raise exception 'TRAINING_PARTICIPANT_SCOPE_MISMATCH';
  end if;

  v_roster_eligible:=public.iq_v3_player_eligible_on_date(
    new.player_id,
    session_scope,
    training_date
  );

  select exists (
    select 1
    from public.training_participants existing_participant
    where existing_participant.training_session_id=new.training_session_id
      and existing_participant.player_id=new.player_id
      and (tg_op='INSERT' or existing_participant.id is distinct from new.id)
  ) into v_existing;

  if not v_roster_eligible
     and not v_existing
     and not public.iq_v57_can_select_training_player(new.player_id,session_scope)
  then
    raise exception 'PLAYER_NOT_AUTHORIZED_FOR_TRAINING';
  end if;

  new.participant_origin:=case when v_roster_eligible then 'ROSTER' else 'GUEST' end;
  return new;
end
$fn$;

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
       or (
         not public.iq_v57_can_select_training_player(v_player_id,p_team_season_id)
         and not exists (
           select 1
           from public.training_participants existing_participant
           where existing_participant.training_session_id=p_session_id
             and existing_participant.player_id=v_player_id
         )
       )
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
      participant_origin=excluded.participant_origin,
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

comment on function public.iq_v57_can_select_training_player(uuid,uuid) is
'Checks whether the authenticated training manager may add a player as roster participant or training-only guest without changing roster membership.';

comment on column public.training_participants.participant_origin is
'ROSTER when eligible for the team-season/date; GUEST when included only in this training session.';

commit;
