-- IQBasket V58 · intelligence integrity refinements
-- 1) optional explicit focus-minute allocation,
-- 2) network benchmark quantile bounds,
-- 3) derived BoxScore refresh after PBP player reassignment.

create or replace function iq_v58_private.recalculate_player_derived_stats(
  p_game_id uuid,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.player_game_stats s
  set
    evaluation =
      coalesce(s.points,0)
      + coalesce(s.off_reb,0) + coalesce(s.def_reb,0)
      + coalesce(s.assists,0) + coalesce(s.steals,0)
      + coalesce(s.blocks_made,s.blocks,0) + coalesce(s.fouls_drawn,s.fouls_received,0)
      - greatest(0,(coalesce(s.fg2_attempted,0)+coalesce(s.fg3_attempted,0))-(coalesce(s.fg2_made,0)+coalesce(s.fg3_made,0)))
      - greatest(0,coalesce(s.ft_attempted,0)-coalesce(s.ft_made,0))
      - coalesce(s.turnovers,0) - coalesce(s.blocks_received,0) - coalesce(s.fouls_committed,0),
    game_score = round((
      coalesce(s.points,0)
      + 0.4*(coalesce(s.fg2_made,0)+coalesce(s.fg3_made,0))
      - 0.7*(coalesce(s.fg2_attempted,0)+coalesce(s.fg3_attempted,0))
      - 0.4*greatest(0,coalesce(s.ft_attempted,0)-coalesce(s.ft_made,0))
      + 0.7*coalesce(s.off_reb,0)
      + 0.3*coalesce(s.def_reb,0)
      + coalesce(s.steals,0)
      + 0.7*coalesce(s.assists,0)
      + 0.7*coalesce(s.blocks_made,s.blocks,0)
      - 0.4*coalesce(s.fouls_committed,0)
      - coalesce(s.turnovers,0)
    )::numeric,1),
    efg_pct = case
      when (coalesce(s.fg2_attempted,0)+coalesce(s.fg3_attempted,0))>0 then
        round((100.0*(coalesce(s.fg2_made,0)+1.5*coalesce(s.fg3_made,0))
          /(coalesce(s.fg2_attempted,0)+coalesce(s.fg3_attempted,0)))::numeric,1)
      else 0 end,
    true_shooting_pct = case
      when (coalesce(s.fg2_attempted,0)+coalesce(s.fg3_attempted,0)+0.44*coalesce(s.ft_attempted,0))>0 then
        round((100.0*coalesce(s.points,0)
          /(2.0*(coalesce(s.fg2_attempted,0)+coalesce(s.fg3_attempted,0)+0.44*coalesce(s.ft_attempted,0))))::numeric,1)
      else 0 end
  where s.game_id=p_game_id and s.player_id=p_player_id;
end;
$$;

create or replace function iq_v58_private.apply_event_stat_delta(
  p_game_id uuid,
  p_player_id uuid,
  p_action_type text,
  p_points integer,
  p_delta integer
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_action text:=lower(trim(coalesce(p_action_type,'')));
  v_points integer:=greatest(coalesce(p_points,0),0);
begin
  if p_player_id is null or p_delta not in (-1,1) then return; end if;

  insert into public.player_game_stats(game_id,player_id)
  values(p_game_id,p_player_id)
  on conflict(game_id,player_id) do nothing;

  update public.player_game_stats s
  set
    points=greatest(0,coalesce(s.points,0) + case when v_action in ('fg2_made','fg3_made','ft_made') then p_delta*v_points else 0 end),
    fg2_made=greatest(0,s.fg2_made + case when v_action='fg2_made' then p_delta else 0 end),
    fg2_attempted=greatest(0,s.fg2_attempted + case when v_action in ('fg2_made','fg2_attempted') then p_delta else 0 end),
    fg3_made=greatest(0,s.fg3_made + case when v_action='fg3_made' then p_delta else 0 end),
    fg3_attempted=greatest(0,s.fg3_attempted + case when v_action in ('fg3_made','fg3_attempted') then p_delta else 0 end),
    ft_made=greatest(0,s.ft_made + case when v_action='ft_made' then p_delta else 0 end),
    ft_attempted=greatest(0,s.ft_attempted + case when v_action in ('ft_made','ft_attempted') then p_delta else 0 end),
    off_reb=greatest(0,s.off_reb + case when v_action='off_reb' then p_delta else 0 end),
    def_reb=greatest(0,s.def_reb + case when v_action='def_reb' then p_delta else 0 end),
    rebounds_offensive=greatest(0,coalesce(s.rebounds_offensive,0) + case when v_action='off_reb' then p_delta else 0 end),
    rebounds_defensive=greatest(0,coalesce(s.rebounds_defensive,0) + case when v_action='def_reb' then p_delta else 0 end),
    assists=greatest(0,s.assists + case when v_action='assists' then p_delta else 0 end),
    steals=greatest(0,s.steals + case when v_action='steals' then p_delta else 0 end),
    blocks=greatest(0,s.blocks + case when v_action='blocks_made' then p_delta else 0 end),
    blocks_made=greatest(0,coalesce(s.blocks_made,0) + case when v_action='blocks_made' then p_delta else 0 end),
    blocks_received=greatest(0,coalesce(s.blocks_received,0) + case when v_action='blocks_received' then p_delta else 0 end),
    turnovers=greatest(0,s.turnovers + case when v_action='turnovers' then p_delta else 0 end),
    fouls_committed=greatest(0,s.fouls_committed + case when v_action='fouls_committed' then p_delta else 0 end),
    fouls_drawn=greatest(0,s.fouls_drawn + case when v_action='fouls_drawn' then p_delta else 0 end),
    fouls_received=greatest(0,coalesce(s.fouls_received,0) + case when v_action='fouls_drawn' then p_delta else 0 end)
  where s.game_id=p_game_id and s.player_id=p_player_id;

  perform iq_v58_private.recalculate_player_derived_stats(p_game_id,p_player_id);
end;
$$;

create or replace function iq_v58_private.set_training_focus_allocation(
  p_session_id uuid,
  p_team_season_id uuid,
  p_allocations jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_session public.training_sessions%rowtype;
  v_key text;
  v_value numeric;
  v_sum numeric:=0;
  v_allowed text[]:=array['TECHNICAL','SHOOT_FINISH','TACTICAL_TEAM','GAME_5V5','PHYSICAL','RECOVERY_PREMATCH'];
  v_focus_codes text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_EDIT_FORBIDDEN' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_allocations,'{}'::jsonb))<>'object' then
    raise exception 'TRAINING_FOCUS_ALLOCATION_OBJECT_REQUIRED' using errcode='22023';
  end if;

  select * into v_session from public.training_sessions
  where id=p_session_id and team_season_id=p_team_season_id for update;
  if v_session.id is null then raise exception 'TRAINING_SESSION_NOT_FOUND' using errcode='P0002'; end if;

  select array_agg(upper(value))
  into v_focus_codes
  from jsonb_array_elements_text(coalesce(v_session.metadata->'training_focus_codes','[]'::jsonb));

  for v_key,v_value in
    select upper(key), value::text::numeric
    from jsonb_each(coalesce(p_allocations,'{}'::jsonb))
  loop
    if not (v_key=any(v_allowed)) then
      raise exception 'TRAINING_FOCUS_CODE_INVALID: %',v_key using errcode='22023';
    end if;
    if coalesce(array_length(v_focus_codes,1),0)>0 and not (v_key=any(v_focus_codes)) then
      raise exception 'TRAINING_FOCUS_NOT_SELECTED: %',v_key using errcode='22023';
    end if;
    if v_value<0 or v_value>coalesce(v_session.duration_minutes,600) then
      raise exception 'TRAINING_FOCUS_MINUTES_INVALID: %',v_key using errcode='22023';
    end if;
    v_sum:=v_sum+v_value;
  end loop;

  if v_sum>coalesce(v_session.duration_minutes,600) then
    raise exception 'TRAINING_FOCUS_ALLOCATION_EXCEEDS_SESSION' using errcode='22023';
  end if;

  update public.training_sessions
  set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'training_focus_minutes',coalesce(p_allocations,'{}'::jsonb),
      'training_focus_allocation_schema_version','V58',
      'training_focus_allocation_updated_at',now(),
      'training_focus_allocation_updated_by',v_uid
    ),
    updated_at=now(),
    updated_by=v_uid
  where id=p_session_id;
  return p_session_id;
end;
$$;

create or replace function public.iq_v58_set_training_focus_allocation(
  p_session_id uuid,
  p_team_season_id uuid,
  p_allocations jsonb
) returns uuid
language sql
set search_path=''
as $$
  select iq_v58_private.set_training_focus_allocation(p_session_id,p_team_season_id,p_allocations);
$$;
revoke all on function public.iq_v58_set_training_focus_allocation(uuid,uuid,jsonb) from public,anon;
grant execute on function public.iq_v58_set_training_focus_allocation(uuid,uuid,jsonb) to authenticated;

create or replace function public.iq_v58_network_benchmark_snapshot(
  p_team_season_id uuid,
  p_cohort_key text,
  p_metric_codes text[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.iq_v4_can_view_longitudinal_analytics(p_team_season_id) then
    raise exception 'BENCHMARK_VIEW_FORBIDDEN' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'cohort_key',s.cohort_key,'metric_code',s.metric_code,'sample_size',s.sample_size,
    'reliability',case when s.sample_size<20 then 'HIDDEN' when s.sample_size<50 then 'PROVISIONAL'
      when s.sample_size<100 then 'REASONABLE' else 'ROBUST' end,
    'minimum_value',case when s.sample_size>=20 then s.minimum_value else null end,
    'p10',case when s.sample_size>=20 then s.p10 else null end,
    'p25',case when s.sample_size>=20 then s.p25 else null end,
    'p50',case when s.sample_size>=20 then s.p50 else null end,
    'p75',case when s.sample_size>=20 then s.p75 else null end,
    'p90',case when s.sample_size>=20 then s.p90 else null end,
    'maximum_value',case when s.sample_size>=20 then s.maximum_value else null end,
    'generated_at',s.generated_at,'calculation_version',s.calculation_version
  ) order by s.metric_code),'[]'::jsonb)
  into v_result
  from iq_v58_private.benchmark_network_snapshots s
  where s.cohort_key=upper(trim(p_cohort_key))
    and s.metric_code=any(coalesce(p_metric_codes,array[]::text[]));
  return v_result;
end;
$$;
revoke all on function public.iq_v58_network_benchmark_snapshot(uuid,text,text[]) from public,anon;
grant execute on function public.iq_v58_network_benchmark_snapshot(uuid,text,text[]) to authenticated;
