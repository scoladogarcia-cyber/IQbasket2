-- V55: preserve immutable analytics evidence for audit but never present stale
-- pre-correction snapshots as current player-development history.
-- Schema-only migration: no existing snapshot or training row is rewritten.
alter table public.player_longitudinal_snapshots
  add column if not exists invalidated_at timestamptz;
drop policy if exists iq_v55_hide_stale_longitudinal_snapshots on public.player_longitudinal_snapshots;
create policy iq_v55_hide_stale_longitudinal_snapshots
  on public.player_longitudinal_snapshots as restrictive for select to authenticated
  using (invalidated_at is null);

create or replace function public.iq_v55_invalidate_training_snapshots()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_team_season_id uuid;
  v_player_id uuid;
  v_date date;
begin
  if TG_TABLE_NAME='training_participants' then
    if TG_OP='UPDATE' and (old.attendance_status,old.participated_minutes,old.rpe,old.internal_load,old.player_id,old.team_season_id)
      is not distinct from (new.attendance_status,new.participated_minutes,new.rpe,new.internal_load,new.player_id,new.team_season_id)
    then return new; end if;
    v_team_season_id:=case when TG_OP='DELETE' then old.team_season_id else new.team_season_id end;
    v_player_id:=case when TG_OP='DELETE' then old.player_id else new.player_id end;
    select s.session_date into v_date from public.training_sessions s
      where s.id=case when TG_OP='DELETE' then old.training_session_id else new.training_session_id end;
    if v_date is not null then
      update public.player_longitudinal_snapshots x set invalidated_at=now()
      where x.team_season_id=v_team_season_id and x.player_id=v_player_id
        and v_date between x.period_start and x.period_end and x.invalidated_at is null;
    end if;
    if TG_OP='UPDATE' and (old.player_id,old.team_season_id) is distinct from (new.player_id,new.team_season_id)
      and v_date is not null then
      update public.player_longitudinal_snapshots x set invalidated_at=now()
      where x.team_season_id=old.team_season_id and x.player_id=old.player_id
        and v_date between x.period_start and x.period_end and x.invalidated_at is null;
    end if;
    return case when TG_OP='DELETE' then old else new end;
  end if;
  -- Date moved, status archived or session deleted: invalidate for all linked people.
  if TG_OP='UPDATE' and old.session_date is not distinct from new.session_date
     and old.status is not distinct from new.status then return new; end if;
  update public.player_longitudinal_snapshots x set invalidated_at=now()
  where x.team_season_id=old.team_season_id and x.invalidated_at is null
    and (old.session_date between x.period_start and x.period_end
      or (TG_OP='UPDATE' and new.session_date between x.period_start and x.period_end))
    and exists (select 1 from public.training_participants tp
      where tp.training_session_id=old.id and tp.player_id=x.player_id);
  return case when TG_OP='DELETE' then old else new end;
end;$$;

drop trigger if exists trg_iq_v55_participant_history_freshness on public.training_participants;
create trigger trg_iq_v55_participant_history_freshness
  after insert or update or delete on public.training_participants
  for each row execute function public.iq_v55_invalidate_training_snapshots();
drop trigger if exists trg_iq_v55_session_history_freshness on public.training_sessions;
create trigger trg_iq_v55_session_history_freshness
  before update of session_date,status or delete on public.training_sessions
  for each row execute function public.iq_v55_invalidate_training_snapshots();
