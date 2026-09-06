begin;

create schema if not exists iq_private;

-- Database-level invariant: explicit start/end always define the canonical
-- session duration. This protects RPC callers and still-open legacy clients.
create or replace function iq_private.iq_training_duration_canonical_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration integer;
begin
  if new.start_time is null and new.end_time is null then
    return new;
  end if;

  if (new.start_time is null) <> (new.end_time is null) then
    raise exception 'TRAINING_TIME_PAIR_REQUIRED';
  end if;

  if new.end_time <= new.start_time then
    raise exception 'TRAINING_TIME_RANGE_INVALID';
  end if;

  v_duration := round(extract(epoch from (new.end_time - new.start_time)) / 60.0)::integer;
  if v_duration <= 0 then
    raise exception 'TRAINING_DURATION_INVALID';
  end if;

  new.duration_minutes := v_duration;
  return new;
end;
$$;
revoke all on function iq_private.iq_training_duration_canonical_guard()
  from public, anon, authenticated;

drop trigger if exists trg_iq_training_duration_canonical_guard
  on public.training_sessions;
create trigger trg_iq_training_duration_canonical_guard
before insert or update of start_time, end_time, duration_minutes
on public.training_sessions
for each row execute function iq_private.iq_training_duration_canonical_guard();

-- Keep only full-attendance rows coupled to a changed full-session duration.
-- PARTIAL attendance is deliberately preserved as the player's actual minutes.
create or replace function iq_private.iq_training_full_attendance_duration_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.duration_minutes is not distinct from new.duration_minutes
     or new.duration_minutes is null then
    return new;
  end if;

  update public.training_participants tp
  set participated_minutes = new.duration_minutes,
      updated_at = now()
  where tp.training_session_id = new.id
    and upper(coalesce(tp.attendance_status, '')) = 'PRESENT'
    and (
      (old.duration_minutes is not null and tp.participated_minutes = old.duration_minutes)
      or (old.duration_minutes is null and tp.participated_minutes is null)
    );

  return new;
end;
$$;
revoke all on function iq_private.iq_training_full_attendance_duration_sync()
  from public, anon, authenticated;

drop trigger if exists trg_iq_training_full_attendance_duration_sync
  on public.training_sessions;
create trigger trg_iq_training_full_attendance_duration_sync
after update on public.training_sessions
for each row execute function iq_private.iq_training_full_attendance_duration_sync();

-- V15 is a thin compatibility-safe scope wrapper. The existing V4 RPC remains
-- the single business-rule authority for permission, roster/date, duration,
-- objective, block and participant validation.
create or replace function public.iq_v15_update_training_session(
  p_training_session_id uuid,
  p_team_season_id uuid,
  p_session_date date,
  p_title text,
  p_objective text,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_duration_minutes integer,
  p_intensity numeric
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_season_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;

  select ts.team_season_id
    into v_team_season_id
  from public.training_sessions ts
  where ts.id = p_training_session_id;

  if v_team_season_id is null then
    raise exception 'TRAINING_SESSION_NOT_FOUND';
  end if;
  if v_team_season_id is distinct from p_team_season_id then
    raise exception 'TRAINING_SESSION_SCOPE_MISMATCH';
  end if;

  return public.iq_v4_update_training_session(
    p_training_session_id,
    p_session_date,
    p_title,
    p_objective,
    p_duration_minutes,
    p_intensity,
    p_start_time,
    p_end_time,
    null,
    null
  );
end;
$$;
revoke all on function public.iq_v15_update_training_session(uuid,uuid,date,text,text,time without time zone,time without time zone,integer,numeric)
  from public, anon;
grant execute on function public.iq_v15_update_training_session(uuid,uuid,date,text,text,time without time zone,time without time zone,integer,numeric)
  to authenticated;

comment on function public.iq_v15_update_training_session(uuid,uuid,date,text,text,time without time zone,time without time zone,integer,numeric)
is 'Scoped training edit boundary; delegates business rules to canonical V4 and keeps duration canonical in DB.';

commit;
