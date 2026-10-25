-- IQBasket Passport V68: authorized career, distinct recorded/accredited training and game provenance.
-- Safety: additive objects; no historical session is marked completed and no existing score is overwritten.
begin;
create schema if not exists iqbasket_recovery_20261025;
revoke all on schema iqbasket_recovery_20261025 from public, anon, authenticated;
create table if not exists iqbasket_recovery_20261025.player_evaluations as select * from public.player_evaluations;
create table if not exists iqbasket_recovery_20261025.player_evaluation_scores as select * from public.player_evaluation_scores;
create table if not exists iqbasket_recovery_20261025.training_sessions as select * from public.training_sessions;
create table if not exists iqbasket_recovery_20261025.training_participants as select * from public.training_participants;
create table if not exists iqbasket_recovery_20261025.player_game_stats as select * from public.player_game_stats;
comment on schema iqbasket_recovery_20261025 is 'Private point-in-time pre-Passport V68 snapshot; not an offsite disaster recovery backup.';

create or replace view public.iq_passport_training_minutes_v68
with (security_invoker=true) as
select p.player_id, s.id as training_session_id, s.team_season_id as authorization_context_id,
       s.session_date, s.status as session_status,
       coalesce(nullif(s.metadata->>'session_kind',''),'TEAM') as session_kind,
       coalesce(nullif(s.metadata->>'session_kind_review',''),'NOT_REVIEWED') as classification_review,
       p.attendance_status, p.participated_minutes, p.duration_override_minutes,
       s.duration_minutes,
       case when p.attendance_status in ('PRESENT','PARTIAL') and s.session_date<=current_date
                 and p.participated_minutes is not null
            then greatest(0,least(p.participated_minutes,coalesce(s.duration_minutes,0))) else 0 end::integer as recorded_minutes,
       case when s.status='COMPLETED' and s.session_date<=current_date
                 and p.attendance_status in ('PRESENT','PARTIAL')
                 and p.participated_minutes is not null
            then greatest(0,least(p.participated_minutes,coalesce(s.duration_minutes,0))) else 0 end::integer as accredited_minutes
from public.training_participants p join public.training_sessions s on s.id=p.training_session_id;

revoke all on public.iq_passport_training_minutes_v68 from public, anon;
grant select on public.iq_passport_training_minutes_v68 to authenticated;

create or replace view public.iq_passport_game_evidence_v68
with (security_invoker=true) as
select ps.player_id, ps.game_id, g.team_season_id as authorization_context_id,
       coalesce(g.game_date,g.date) as game_date, g.status as game_status,
       ps.minutes, ps.points, ps.assists,
       coalesce(ps.rebounds_offensive,ps.off_reb,0) as offensive_rebounds,
       coalesce(ps.rebounds_defensive,ps.def_reb,0) as defensive_rebounds,
       ps.steals, ps.blocks, ps.turnovers, ps.fg2_made, ps.fg2_attempted,
       ps.fg3_made, ps.fg3_attempted, ps.ft_made, ps.ft_attempted
from public.player_game_stats ps
join public.games g on g.id=ps.game_id
where lower(coalesce(g.status,'')) in ('finalizado','finalizada','finished','completed','finalized');

revoke all on public.iq_passport_game_evidence_v68 from public, anon;
grant select on public.iq_passport_game_evidence_v68 to authenticated;

-- Never leak previous clubs' private evaluations: each season is independently
-- authorized by the existing passport entitlement/RBAC/roster gate.
create or replace function public.iq_v68_player_passport_career(
 p_player_id uuid, p_team_season_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_season record; v_snapshot jsonb; v_career jsonb:='[]'::jsonb;
        v_category text; v_competition text; v_current jsonb;
begin
 if auth.uid() is null or not public.iq_account_is_active()
    or not public.iq_v4_can_access_player_passport(p_player_id,p_team_season_id)
 then raise exception 'PLAYER_PASSPORT_ACCESS_DENIED' using errcode='42501'; end if;
 select t.category,t.competition into v_category,v_competition
 from public.team_seasons ts join public.teams t on t.id=ts.team_id
 where ts.id=p_team_season_id;

 for v_season in
   select distinct context_id from (
      select p_team_season_id as context_id
      union all
      select rm.team_season_id as context_id
      from public.roster_memberships rm where rm.player_id=p_player_id
   ) x where context_id is not null
 loop
   if public.iq_v4_can_access_player_passport(p_player_id,v_season.context_id) then
      v_snapshot:=public.iq_v4_player_passport_snapshot(p_player_id,v_season.context_id);
      v_career:=v_career||jsonb_build_array(jsonb_build_object(
        'team_season_id',v_season.context_id,
        'team',v_snapshot->'team',
        'evaluations',v_snapshot->'evaluations',
        'measurements',v_snapshot->'measurements'
      ));
   end if;
 end loop;
 return jsonb_build_object(
   'category',v_category,'competition',v_competition,
   'career',v_career,'career_access','PER_SEASON_AUTHORIZED_ONLY',
   'category_source','TEAMS_CATEGORY_CURRENT_SEASON',
   'passport_player_id',p_player_id
 );
end $$;
revoke all on function public.iq_v68_player_passport_career(uuid,uuid) from public,anon;
grant execute on function public.iq_v68_player_passport_career(uuid,uuid) to authenticated;

-- Optional actual assessment duration, separate from training and game minutes.
-- NULL is unknown, never guessed from the number of scored attributes.
alter table public.player_evaluations add column if not exists assessment_duration_minutes integer;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.player_evaluations'::regclass
   and conname='player_evaluations_assessment_duration_v68_chk') then
 alter table public.player_evaluations add constraint player_evaluations_assessment_duration_v68_chk
 check (assessment_duration_minutes is null or assessment_duration_minutes between 1 and 600);
 end if;
end$$;
create or replace function public.iq_v68_set_passport_assessment_duration(
 p_evaluation_id uuid,p_minutes integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_eval public.player_evaluations%rowtype;
begin
 if auth.uid() is null or not public.iq_account_is_active()
 then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_eval from public.player_evaluations where id=p_evaluation_id for update;
 if not found then raise exception 'EVALUATION_NOT_FOUND'; end if;
 if not public.iq_v4_can_manage_evaluation(v_eval.team_season_id)
    or not public.iq_v4_can_access_player_passport(v_eval.player_id,v_eval.team_season_id)
 then raise exception 'EVALUATION_PERMISSION_DENIED' using errcode='42501'; end if;
 if upper(coalesce(v_eval.status,''))='ARCHIVED' then raise exception 'EVALUATION_ARCHIVED'; end if;
 if p_minutes is not null and (p_minutes<1 or p_minutes>600)
 then raise exception 'EVALUATION_DURATION_INVALID'; end if;
 update public.player_evaluations set assessment_duration_minutes=p_minutes,
     updated_at=now(),updated_by=auth.uid()
 where id=p_evaluation_id;
 return p_evaluation_id;
end $$;
revoke all on function public.iq_v68_set_passport_assessment_duration(uuid,integer) from public,anon;
grant execute on function public.iq_v68_set_passport_assessment_duration(uuid,integer) to authenticated;
commit;
