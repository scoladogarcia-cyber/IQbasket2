-- V54 additive integrity hardening: a block assignment must agree with actual
-- attendance and must never claim more minutes than its own block duration.
-- Applies only to the new table; no historic participant or session is changed.
create or replace function public.iq_v54_validate_block_participation()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_block_session uuid;
  v_participant_session uuid;
  v_duration integer;
  v_attendance text;
begin
  select b.training_session_id,b.duration_minutes into v_block_session,v_duration
  from public.training_blocks b where b.id=new.block_id;
  select p.training_session_id,p.attendance_status into v_participant_session,v_attendance
  from public.training_participants p where p.id=new.participant_id;
  if v_block_session is null or v_participant_session is distinct from v_block_session then
    raise exception 'TRAINING_BLOCK_PARTICIPANT_SCOPE_MISMATCH';
  end if;
  if upper(v_attendance) in ('ABSENT','EXCUSED') and new.participation_status<>'NOT_ATTENDED' then
    raise exception 'TRAINING_ABSENT_PLAYER_CANNOT_PARTICIPATE_IN_BLOCK';
  end if;
  if new.participation_status='NOT_ATTENDED' and new.participated_minutes is distinct from 0 then
    raise exception 'TRAINING_BLOCK_ABSENT_MINUTES_INVALID';
  end if;
  if new.participation_status='FULL' and v_duration is not null
      and new.participated_minutes is distinct from v_duration then
    raise exception 'TRAINING_BLOCK_FULL_MINUTES_MISMATCH';
  end if;
  if new.participation_status='PARTIAL' and (
    new.participated_minutes is null or new.participated_minutes<1
    or (v_duration is not null and new.participated_minutes>=v_duration)
  ) then raise exception 'TRAINING_BLOCK_PARTIAL_MINUTES_INVALID'; end if;
  if v_duration is not null and new.participated_minutes>v_duration then
    raise exception 'TRAINING_BLOCK_MINUTES_EXCEED_DURATION';
  end if;
  new.updated_at:=now();
  return new;
end;$$;

-- PostgREST must discover the new RPC before the updated application is served.
notify pgrst, 'reload schema';
