-- V55: separate planned roster and absences from actual training evidence.
-- Guarded function-body updates preserve all pre-existing security, feature gates and result shape.
-- Does not touch existing sessions, participants or game records.
do $v55_history$
declare
  v_name text;
  v_old text;
  v_new text;
  v_source text;
  v_target text;
  v_filter text := E'\n        and upper(coalesce(tp.attendance_status,\'\')) in (\'PRESENT\',\'PARTIAL\')\n        and coalesce(tp.participated_minutes,0)>0';
begin
  foreach v_name in array array[
    'iq_v8_family_player_passport','iq_v32_family_player_passport','iq_v33_family_player_passport'
  ] loop
    select pg_get_functiondef(p.oid) into v_source
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_name;
    v_old:='where tp.player_id=p_player_id and tp.team_season_id=rm.team_season_id';
    if v_source is null or strpos(v_source,v_old)=0 then
      raise exception 'TRAINING_V55_PROJECTION_CONTRACT_CHANGED: %',v_name;
    end if;
    v_target:=replace(v_source,v_old,v_old||v_filter);
    if v_name in ('iq_v8_family_player_passport','iq_v33_family_player_passport') then
      v_old:=E'where tp.player_id=p_player_id\n        union all';
      if strpos(v_target,v_old)=0 then raise exception 'TRAINING_V55_TIMELINE_CONTRACT_CHANGED: %',v_name; end if;
      v_new:='where tp.player_id=p_player_id'||v_filter||E'\n        union all';
      v_target:=replace(v_target,v_old,v_new);
    end if;
    execute v_target;
  end loop;
  select pg_get_functiondef('public.iq_v10_family_development_context(uuid,uuid)'::regprocedure) into v_source;
  v_old:=E'and tp.player_id=p_player_id\n      and ts.status';
  if strpos(v_source,v_old)=0 then raise exception 'TRAINING_V55_FAMILY_DEVELOPMENT_CONTRACT_CHANGED'; end if;
  v_new:='and tp.player_id=p_player_id'||v_filter||E'\n      and ts.status';
  execute replace(v_source,v_old,v_new);

  select pg_get_functiondef('public.iq_v16_development_cycle_snapshot(uuid,uuid)'::regprocedure) into v_source;
  v_old:=E'and tp.player_id=p_player_id\n        and ts.status';
  if strpos(v_source,v_old)=0 then raise exception 'TRAINING_V55_DEVELOPMENT_EVIDENCE_CONTRACT_CHANGED'; end if;
  v_new:='and tp.player_id=p_player_id'||v_filter||E'\n        and ts.status';
  execute replace(v_source,v_old,v_new);
end;
$v55_history$;
notify pgrst,'reload schema';
