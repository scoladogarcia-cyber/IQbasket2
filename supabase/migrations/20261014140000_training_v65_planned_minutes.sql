-- V65.1: preserve planned individual duration without reporting it as attended time.
begin;
alter table public.training_participants add column if not exists duration_override_minutes integer;
do $$ begin
if not exists (select 1 from pg_constraint where conrelid='public.training_participants'::regclass
 and conname='training_participants_duration_override_check') then
 alter table public.training_participants add constraint training_participants_duration_override_check
 check (duration_override_minutes is null or duration_override_minutes between 0 and 600);
end if; end $$;

create or replace function public.iq_v65_check_training_override() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_duration integer;
begin
 if new.duration_override_minutes is null then return new; end if;
 select duration_minutes into v_duration from public.training_sessions where id=new.training_session_id;
 if v_duration is null or new.duration_override_minutes>v_duration then
   raise exception 'TRAINING_OVERRIDE_EXCEEDS_SESSION';
 end if;
 return new;
end $$;
drop trigger if exists iq_v65_training_participant_override on public.training_participants;
create trigger iq_v65_training_participant_override before insert or update of duration_override_minutes,training_session_id
on public.training_participants for each row execute function public.iq_v65_check_training_override();

create or replace function public.iq_v65_check_training_override_parent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists (select 1 from public.training_participants p
            where p.training_session_id=new.id and p.duration_override_minutes>new.duration_minutes) then
   raise exception 'TRAINING_SESSION_SHORTER_THAN_PLAYER_OVERRIDE';
 end if;
 return new;
end $$;
drop trigger if exists iq_v65_training_session_override on public.training_sessions;
create trigger iq_v65_training_session_override before update of duration_minutes
on public.training_sessions for each row execute function public.iq_v65_check_training_override_parent();

-- Team-season ID remains an authorization context; it is not participant membership.
create or replace function public.iq_v65_create_training_session(
 p_team_season_id uuid,p_session_date date,p_title text,p_objective text default null,
 p_notes text default null,p_duration_minutes integer default null,p_intensity numeric default null,
 p_start_time time default null,p_end_time time default null,p_blocks jsonb default '[]'::jsonb,
 p_participants jsonb default '[]'::jsonb,p_focus_codes text[] default '{}'::text[],
 p_clone_source_id uuid default null,p_entry_mode text default 'QUICK',p_kind text default 'TEAM'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_kind text:=upper(trim(coalesce(p_kind,''))); v_item jsonb; v_minutes integer;
begin
 if auth.uid() is null or not public.iq_account_is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if not public.iq_v4_can_manage_training(p_team_season_id) then raise exception 'TRAINING_MANAGE_DENIED'; end if;
 if v_kind not in ('TEAM','TECHNIFICATION','PERSONAL','COGNITIVE') then raise exception 'TRAINING_KIND_INVALID'; end if;
 v_id:=public.iq_v55_create_training_session(p_team_season_id,p_session_date,p_title,p_objective,p_notes,
 p_duration_minutes,p_intensity,p_start_time,p_end_time,p_blocks,p_participants,p_focus_codes,p_clone_source_id,p_entry_mode);
 update public.training_sessions set metadata=coalesce(metadata,'{}'::jsonb)
 || jsonb_build_object('session_kind',v_kind,'session_kind_review','REVIEWED',
 'session_kind_provenance','USER_SELECTED','session_kind_reviewer',auth.uid())
 where id=v_id and team_season_id=p_team_season_id;
 for v_item in select value from jsonb_array_elements(coalesce(p_participants,'[]'::jsonb)) loop
   v_minutes:=nullif(v_item->>'duration_override_minutes','')::integer;
   if v_minutes is not null then
     if v_minutes<0 or v_minutes>coalesce(p_duration_minutes,
       extract(epoch from (p_end_time-p_start_time))/60)::integer then
       raise exception 'TRAINING_OVERRIDE_MINUTES_INVALID';
     end if;
     update public.training_participants set duration_override_minutes=v_minutes
     where training_session_id=v_id and player_id=(v_item->>'player_id')::uuid;
   end if;
 end loop;
 return v_id;
end $$;
revoke all on function public.iq_v65_create_training_session(uuid,date,text,text,text,integer,numeric,time,time,jsonb,jsonb,text[],uuid,text,text) from public,anon;
grant execute on function public.iq_v65_create_training_session(uuid,date,text,text,text,integer,numeric,time,time,jsonb,jsonb,text[],uuid,text,text) to authenticated;

commit;