-- IQBasket V64: non-destructive recovery and player-centric training hours.
-- Snapshot is already held in isolated schema iqbasket_recovery_20261014.
-- Classification is provisional whenever inferred from a historical title.
begin;
do $$
begin
  if to_regclass('iqbasket_recovery_20261014.training_sessions') is null then
    raise exception 'TRAINING_BACKUP_REQUIRED';
  end if;
  if (select count(*) from iqbasket_recovery_20261014.training_sessions)
      <> (select count(*) from public.training_sessions) then
    raise exception 'TRAINING_BACKUP_COUNT_MISMATCH';
  end if;
end $$;

-- Preserve pre-existing specific metadata and mark uncertain historical labels.
update public.training_sessions s
set metadata = coalesce(s.metadata,'{}'::jsonb) ||
    jsonb_build_object(
      'session_kind', case
        when lower(coalesce(s.title,'')) ~ '(cognitiv|neuro)' then 'COGNITIVE'
        when lower(coalesce(s.title,'')) ~ '(tecnific|individual|tiro y 1c1)' then 'TECHNIFICATION'
        when lower(coalesce(s.title,'')) ~ '(personal|f[ií]sico personal)' then 'PERSONAL'
        else 'TEAM'
      end,
      'session_kind_review', 'PENDING',
      'session_kind_provenance', 'HISTORICAL_TITLE_INFERENCE_20261014'
    ),
    updated_at = s.updated_at
where not (coalesce(s.metadata,'{}'::jsonb) ? 'session_kind');

-- A SECURITY INVOKER view respects underlying RLS and uses attendance records
-- without materialized counters, so editing a session recalculates automatically.
create or replace view public.iq_training_player_hours_v64
with (security_invoker = true) as
select p.player_id,
       s.id as training_session_id,
       s.session_date,
       s.team_season_id as authorization_context_id,
       coalesce(nullif(s.metadata->>'session_kind',''),'TEAM') as session_kind,
       p.attendance_status,
       case when s.status='COMPLETED'
                   and p.attendance_status in ('PRESENT','PARTIAL')
            then greatest(0, least(coalesce(p.participated_minutes,s.duration_minutes,0),
                                     coalesce(s.duration_minutes,0)))
            else 0 end::integer as accredited_minutes,
       s.metadata->>'session_kind_review' as classification_review
from public.training_sessions s
join public.training_participants p on p.training_session_id=s.id;

revoke all on public.iq_training_player_hours_v64 from public,anon;
grant select on public.iq_training_player_hours_v64 to authenticated;
commit;