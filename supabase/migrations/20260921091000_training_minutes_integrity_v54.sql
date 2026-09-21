-- V54 additive, deferred integrity guard for training block participation.
-- No historic rows are changed. Deferred checks run against the final state of
-- an atomic edit, avoiding false positives during block/roster corrections.
create or replace function public.iq_v54_assert_player_block_minutes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_participant_id uuid;
  v_minutes integer;
  v_session_minutes integer;
  v_attendance text;
  v_block_minutes integer;
begin
  v_participant_id := case when tg_op = 'DELETE' then old.participant_id else new.participant_id end;

  select p.participated_minutes, p.attendance_status, s.duration_minutes
    into v_minutes, v_attendance, v_session_minutes
  from public.training_participants p
  join public.training_sessions s on s.id = p.training_session_id
  where p.id = v_participant_id;
  -- Participant deletion cascades its block detail: no orphan can survive.
  if not found then return null; end if;

  select coalesce(sum(bp.participated_minutes), 0)::integer
    into v_block_minutes
  from public.training_block_participation bp
  where bp.participant_id = v_participant_id;

  if (v_minutes is not null and v_block_minutes > v_minutes)
     or (v_session_minutes is not null and v_block_minutes > v_session_minutes) then
    raise exception 'TRAINING_BLOCK_MINUTES_EXCEED_PLAYER_OR_SESSION';
  end if;
  if upper(coalesce(v_attendance, '')) in ('ABSENT', 'EXCUSED')
     and v_block_minutes > 0 then
    raise exception 'TRAINING_ABSENT_PLAYER_HAS_BLOCK_MINUTES';
  end if;
  return null;
end;$$;

drop trigger if exists trg_iq_v54_total_block_minutes on public.training_block_participation;
create constraint trigger trg_iq_v54_total_block_minutes
  after insert or update or delete on public.training_block_participation
  deferrable initially deferred for each row
  execute function public.iq_v54_assert_player_block_minutes();

-- Attendance/minute changes from the legacy per-player editor must also be
-- checked against already-recorded block detail, at the end of the transaction.
create or replace function public.iq_v54_assert_participant_block_minutes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_total integer;
  v_session_minutes integer;
begin
  select s.duration_minutes into v_session_minutes
  from public.training_sessions s where s.id = new.training_session_id;
  select coalesce(sum(bp.participated_minutes), 0)::integer into v_total
  from public.training_block_participation bp where bp.participant_id = new.id;
  if (new.participated_minutes is not null and v_total > new.participated_minutes)
     or (v_session_minutes is not null and v_total > v_session_minutes) then
    raise exception 'TRAINING_BLOCK_MINUTES_EXCEED_PLAYER_OR_SESSION';
  end if;
  if upper(coalesce(new.attendance_status, '')) in ('ABSENT', 'EXCUSED')
     and v_total > 0 then
    raise exception 'TRAINING_ABSENT_PLAYER_HAS_BLOCK_MINUTES';
  end if;
  return null;
end;$$;

drop trigger if exists trg_iq_v54_participant_minutes on public.training_participants;
create constraint trigger trg_iq_v54_participant_minutes
  after update of participated_minutes, attendance_status on public.training_participants
  deferrable initially deferred for each row
  execute function public.iq_v54_assert_participant_block_minutes();

-- Editing a block's duration through the existing legacy editor must not
-- invalidate any individual participation previously recorded for that block.
create or replace function public.iq_v54_assert_block_duration()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.training_blocks b
    join public.training_block_participation bp on bp.block_id = b.id
    where b.id = new.id and (
      bp.participated_minutes > b.duration_minutes
      or (bp.participation_status = 'FULL' and bp.participated_minutes is distinct from b.duration_minutes)
      or (bp.participation_status = 'PARTIAL' and bp.participated_minutes >= b.duration_minutes)
    )
  ) then raise exception 'TRAINING_BLOCK_DURATION_CONFLICTS_WITH_PARTICIPATION'; end if;
  return null;
end;$$;

drop trigger if exists trg_iq_v54_block_duration on public.training_blocks;
create constraint trigger trg_iq_v54_block_duration
  after update of duration_minutes on public.training_blocks
  deferrable initially deferred for each row
  execute function public.iq_v54_assert_block_duration();
