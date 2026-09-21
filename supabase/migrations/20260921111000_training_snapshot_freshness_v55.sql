-- V55: retain earlier immutable snapshots for audit, never serve stale ones as current.
-- Applying this migration does not change any historical training or snapshot data.
alter table public.player_longitudinal_snapshots
  add column if not exists invalidated_at timestamptz;
drop policy if exists iq_v55_hide_stale_longitudinal_snapshots on public.player_longitudinal_snapshots;
create policy iq_v55_hide_stale_longitudinal_snapshots
  on public.player_longitudinal_snapshots as restrictive for select to authenticated
  using (invalidated_at is null);

create or replace function public.iq_v55_invalidate_participant_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_person public.training_participants%rowtype;
  v_date date;
begin
  if TG_OP='UPDATE' then
    if (old.attendance_status,old.participated_minutes,old.rpe,old.internal_load,old.player_id,old.team_season_id)
       is not distinct from (new.attendance_status,new.participated_minutes,new.rpe,new.internal_load,new.player_id,new.team_season_id)
    then return new; end if;
  end if;
  if TG_OP='DELETE' then v_person:=old;
  else v_person:=new; end if;
  select session_date into v_date from public.training_sessions where id=v_person.training_session_id;
  if v_date is not null then
    update public.player_longitudinal_snapshots x set invalidated_at=now()
    where x.team_season_id=v_person.team_season_id and x.player_id=v_person.player_id
      and v_date between x.period_start and x.period_end and x.invalidated_at is null;
    if TG_OP='UPDATE' then
      if (old.player_id,old.team_season_id) is distinct from (new.player_id,new.team_season_id) then
        update public.player_longitudinal_snapshots x set invalidated_at=now()
        where x.team_season_id=old.team_season_id and x.player_id=old.player_id
          and v_date between x.period_start and x.period_end and x.invalidated_at is null;
      end if;
    end if;
  end if;
  if TG_OP='DELETE' then return old; else return new; end if;
end;$$;

create or replace function public.iq_v55_invalidate_session_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if (old.session_date,old.status) is not distinct from (new.session_date,new.status)
      then return new; end if;
    update public.player_longitudinal_snapshots x set invalidated_at=now()
    where x.team_season_id=old.team_season_id and x.invalidated_at is null
      and (old.session_date between x.period_start and x.period_end
        or new.session_date between x.period_start and x.period_end)
      and exists (select 1 from public.training_participants tp
        where tp.training_session_id=old.id and tp.player_id=x.player_id);
    return new;
  end if;
  -- BEFORE DELETE runs while participants still exist, before cascading FKs.
  update public.player_longitudinal_snapshots x set invalidated_at=now()
  where x.team_season_id=old.team_season_id and x.invalidated_at is null
    and old.session_date between x.period_start and x.period_end
    and exists (select 1 from public.training_participants tp
      where tp.training_session_id=old.id and tp.player_id=x.player_id);
  return old;
end;$$;

drop trigger if exists trg_iq_v55_participant_history_freshness on public.training_participants;
create trigger trg_iq_v55_participant_history_freshness
  after insert or update or delete on public.training_participants
  for each row execute function public.iq_v55_invalidate_participant_snapshot();
drop trigger if exists trg_iq_v55_session_history_freshness on public.training_sessions;
create trigger trg_iq_v55_session_history_freshness
  before update of session_date,status or delete on public.training_sessions
  for each row execute function public.iq_v55_invalidate_session_snapshot();
