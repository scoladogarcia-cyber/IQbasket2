-- =============================================================================
-- IQBasket · Family Played History V33
-- Longitudinal Family statistics must describe played games, not scheduled game
-- shells that already contain zero-value player_game_stats rows.
--
-- Security invariant: this RPC delegates authorization/entitlement decisions to
-- V32 and only narrows the sporting projection to FINISHED games.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- Preconditions
-- -----------------------------------------------------------------------------
do $preflight$
begin
  if to_regprocedure('public.iq_v32_family_player_passport(uuid)') is null
     or to_regclass('public.season_catalog') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.player_game_stats') is null
     or to_regclass('public.games') is null then
    raise exception 'FAMILY_PLAYED_HISTORY_V33_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

create or replace function public.iq_v33_family_player_passport(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_base jsonb;
  v_result jsonb;
  v_history_allowed boolean:=false;
  v_stats_allowed boolean:=false;
  v_timeline_allowed boolean:=false;
  v_career jsonb:='[]'::jsonb;
  v_totals jsonb:='{}'::jsonb;
  v_recent_games jsonb:='[]'::jsonb;
  v_timeline jsonb:='[]'::jsonb;
begin
  -- V32 remains the authoritative security and commercial gate.
  v_base:=public.iq_v32_family_player_passport(p_player_id);
  v_history_allowed:=coalesce((v_base#>>'{section_access,game_history}')::boolean,false);
  v_stats_allowed:=coalesce((v_base#>>'{section_access,basic_stats}')::boolean,false);
  v_timeline_allowed:=coalesce((v_base#>>'{section_access,basic_timeline}')::boolean,false);

  -- Career keeps membership/training context but game aggregates only include
  -- games that completed the lifecycle and reached FINISHED.
  if v_history_allowed then
    select coalesce(jsonb_agg(jsonb_build_object(
      'team_season_id',rm.team_season_id,'team_id',ts.team_id,
      'team_name',t.name,'club_name',c.name,'season_name',sc.name,
      'season_start',sc.start_date,'season_end',sc.end_date,
      'membership_status',rm.status,'jersey',rm.jersey,
      'primary_position',rm.primary_position,
      'stints',coalesce(st.stints,'[]'::jsonb),
      'games',coalesce(gs.games,0),'minutes',coalesce(gs.minutes,0),
      'points',coalesce(gs.points,0),'rebounds',coalesce(gs.rebounds,0),
      'assists',coalesce(gs.assists,0),'steals',coalesce(gs.steals,0),
      'blocks',coalesce(gs.blocks,0),'turnovers',coalesce(gs.turnovers,0),
      'fg2_made',coalesce(gs.fg2_made,0),'fg2_attempted',coalesce(gs.fg2_attempted,0),
      'fg3_made',coalesce(gs.fg3_made,0),'fg3_attempted',coalesce(gs.fg3_attempted,0),
      'ft_made',coalesce(gs.ft_made,0),'ft_attempted',coalesce(gs.ft_attempted,0),
      'training_sessions',coalesce(tr.sessions,0),'training_minutes',coalesce(tr.minutes,0),
      'technification_sessions',coalesce(ed.sessions,0),'technification_minutes',coalesce(ed.minutes,0)
    ) order by coalesce(sc.end_date,sc.start_date) desc nulls last),'[]'::jsonb)
    into v_career
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.teams t on t.id=ts.team_id
    left join public.clubs c on c.id=t.club_id
    join public.season_catalog sc on sc.id=ts.season_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'valid_from',rs.valid_from,'valid_until',rs.valid_until,'source',rs.source
      ) order by rs.valid_from) as stints
      from public.roster_membership_stints rs
      where rs.roster_membership_id=rm.id
    ) st on true
    left join lateral (
      select count(*)::integer games,
        coalesce(sum(pgs.minutes),0)::integer minutes,
        coalesce(sum(pgs.points),0)::integer points,
        coalesce(sum(coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0)),0)::integer rebounds,
        coalesce(sum(pgs.assists),0)::integer assists,
        coalesce(sum(pgs.steals),0)::integer steals,
        coalesce(sum(coalesce(pgs.blocks,pgs.blocks_made,0)),0)::integer blocks,
        coalesce(sum(pgs.turnovers),0)::integer turnovers,
        coalesce(sum(pgs.fg2_made),0)::integer fg2_made,
        coalesce(sum(pgs.fg2_attempted),0)::integer fg2_attempted,
        coalesce(sum(pgs.fg3_made),0)::integer fg3_made,
        coalesce(sum(pgs.fg3_attempted),0)::integer fg3_attempted,
        coalesce(sum(pgs.ft_made),0)::integer ft_made,
        coalesce(sum(pgs.ft_attempted),0)::integer ft_attempted
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      where pgs.player_id=p_player_id
        and g.team_season_id=rm.team_season_id
        and upper(coalesce(g.play_state,''))='FINISHED'
    ) gs on true
    left join lateral (
      select count(*)::integer sessions,
             coalesce(sum(tp.participated_minutes),0)::integer minutes
      from public.training_participants tp
      where tp.player_id=p_player_id and tp.team_season_id=rm.team_season_id
    ) tr on true
    left join lateral (
      select count(*)::integer sessions,
             coalesce(sum(ed.duration_minutes),0)::integer minutes
      from public.external_development_sessions ed
      where ed.player_id=p_player_id and ed.team_season_id=rm.team_season_id
    ) ed on true
    where rm.player_id=p_player_id;
  end if;

  if v_stats_allowed then
    select jsonb_build_object(
      'games',count(*)::integer,
      'minutes',coalesce(sum(pgs.minutes),0)::integer,
      'points',coalesce(sum(pgs.points),0)::integer,
      'rebounds',coalesce(sum(coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0)),0)::integer,
      'assists',coalesce(sum(pgs.assists),0)::integer,
      'steals',coalesce(sum(pgs.steals),0)::integer,
      'blocks',coalesce(sum(coalesce(pgs.blocks,pgs.blocks_made,0)),0)::integer,
      'turnovers',coalesce(sum(pgs.turnovers),0)::integer,
      'fg2_made',coalesce(sum(pgs.fg2_made),0)::integer,
      'fg2_attempted',coalesce(sum(pgs.fg2_attempted),0)::integer,
      'fg3_made',coalesce(sum(pgs.fg3_made),0)::integer,
      'fg3_attempted',coalesce(sum(pgs.fg3_attempted),0)::integer,
      'ft_made',coalesce(sum(pgs.ft_made),0)::integer,
      'ft_attempted',coalesce(sum(pgs.ft_attempted),0)::integer
    ) into v_totals
    from public.player_game_stats pgs
    join public.games g on g.id=pgs.game_id
    where pgs.player_id=p_player_id
      and upper(coalesce(g.play_state,''))='FINISHED';
  end if;

  if v_history_allowed and v_stats_allowed then
    select coalesce(jsonb_agg(x.item order by x.game_date desc nulls last),'[]'::jsonb)
    into v_recent_games
    from (
      select coalesce(g.game_date,g.date) game_date,jsonb_build_object(
        'game_id',g.id,'team_season_id',g.team_season_id,
        'date',coalesce(g.game_date,g.date),'team_name',t.name,
        'opponent',g.opponent,'competition',g.competition,
        'team_score',coalesce(g.team_score,g.our_score),
        'opponent_score',coalesce(g.opponent_score,g.opp_score),
        'play_state',g.play_state,
        'minutes',coalesce(pgs.minutes,0),'points',coalesce(pgs.points,0),
        'rebounds',coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0),
        'assists',coalesce(pgs.assists,0),'steals',coalesce(pgs.steals,0),
        'blocks',coalesce(pgs.blocks,pgs.blocks_made,0),'turnovers',coalesce(pgs.turnovers,0),
        'fg3_made',coalesce(pgs.fg3_made,0),'fg3_attempted',coalesce(pgs.fg3_attempted,0)
      ) item
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      left join public.teams t on t.id=g.team_id
      where pgs.player_id=p_player_id
        and upper(coalesce(g.play_state,''))='FINISHED'
      order by coalesce(g.game_date,g.date) desc nulls last,g.created_at desc
      limit 12
    ) x;
  end if;

  -- Timeline uses the same sporting meaning: scheduled games are future context,
  -- not completed evidence. Training/technification entries are unchanged.
  if v_timeline_allowed then
    select coalesce(jsonb_agg(x.item order by x.event_date desc nulls last,x.sort_order),'[]'::jsonb)
    into v_timeline
    from (
      select * from (
        select coalesce(g.game_date,g.date) event_date,1 sort_order,jsonb_build_object(
          'type','GAME','date',coalesce(g.game_date,g.date),'team_season_id',g.team_season_id,
          'title',concat('vs ',coalesce(g.opponent,'Rival')),
          'detail',jsonb_build_object('points',coalesce(pgs.points,0),'minutes',coalesce(pgs.minutes,0))
        ) item
        from public.player_game_stats pgs
        join public.games g on g.id=pgs.game_id
        where pgs.player_id=p_player_id
          and upper(coalesce(g.play_state,''))='FINISHED'
        union all
        select ts.session_date,2,jsonb_build_object(
          'type','TRAINING','date',ts.session_date,'team_season_id',tp.team_season_id,
          'title',coalesce(ts.title,'Entrenamiento'),
          'detail',jsonb_build_object('minutes',coalesce(tp.participated_minutes,0),'attendance',tp.attendance_status)
        )
        from public.training_participants tp
        join public.training_sessions ts on ts.id=tp.training_session_id
        where tp.player_id=p_player_id
        union all
        select ed.activity_date,3,jsonb_build_object(
          'type','TECHNIFICATION','date',ed.activity_date,'team_season_id',ed.team_season_id,
          'title',coalesce(ed.title,'Tecnificacion'),
          'detail',jsonb_build_object('minutes',coalesce(ed.duration_minutes,0),'provider',ed.provider_name)
        )
        from public.external_development_sessions ed
        where ed.player_id=p_player_id
      ) u
      order by event_date desc nulls last,sort_order
      limit 30
    ) x;
  end if;

  v_result:=jsonb_set(v_base,'{career}',v_career,true);
  v_result:=jsonb_set(v_result,'{career_totals}',v_totals,true);
  v_result:=jsonb_set(v_result,'{recent_games}',v_recent_games,true);
  v_result:=jsonb_set(v_result,'{timeline}',v_timeline,true);
  return v_result;
end
$function$;

revoke all on function public.iq_v33_family_player_passport(uuid)
  from public,anon,authenticated;
grant execute on function public.iq_v33_family_player_passport(uuid)
  to authenticated;

commit;