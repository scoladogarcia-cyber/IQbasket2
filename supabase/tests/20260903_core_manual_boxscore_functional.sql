-- Core corrections · functional manual boxscore · inside transaction
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',up.id::text,
    'email',lower(up.email),
    'role','authenticated'
  )::text,
  true
)
from public.user_profiles up
where lower(up.email)='scolado@nechigroup.com'
limit 1;

create temp table core_manual_game on commit drop as
select g.*
from public.games g
where not exists(select 1 from public.game_events ge where ge.game_id=g.id)
  and exists(select 1 from public.player_game_stats pgs where pgs.game_id=g.id)
order by g.date,g.id
limit 1;

create temp table core_pbp_game on commit drop as
select g.*
from public.games g
where exists(select 1 from public.game_events ge where ge.game_id=g.id)
order by g.date,g.id
limit 1;

do $$
declare
  v_game core_manual_game%rowtype;
  v_stat public.player_game_stats%rowtype;
  v_stats jsonb;
  v_starters uuid[];
  v_before_minutes integer;
begin
  select * into v_game from core_manual_game;
  if v_game.id is null then raise exception 'CORE_MANUAL_BOXSCORE_GAME_MISSING'; end if;

  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    perform public.iq_v5_set_game_edit_state(
      v_game.id,'OPEN','CORE_FUNCTIONAL_TEMP_OPEN'
    );
  end if;

  select * into v_stat
  from public.player_game_stats
  where game_id=v_game.id
  order by player_id
  limit 1;
  v_before_minutes:=coalesce(v_stat.minutes,0);

  select coalesce(
    array_agg(value::uuid order by value),
    '{}'::uuid[]
  )
  into v_starters
  from jsonb_array_elements_text(coalesce(v_game.starter_ids,'[]'::jsonb));

  v_stats:=jsonb_build_array(jsonb_build_object(
    'player_id',v_stat.player_id,
    'starter',v_stat.starter,
    'minutes',v_before_minutes+1,
    'points',v_stat.points,
    'fg2_made',v_stat.fg2_made,
    'fg2_attempted',v_stat.fg2_attempted,
    'fg3_made',v_stat.fg3_made,
    'fg3_attempted',v_stat.fg3_attempted,
    'ft_made',v_stat.ft_made,
    'ft_attempted',v_stat.ft_attempted,
    'off_reb',v_stat.off_reb,
    'def_reb',v_stat.def_reb,
    'assists',v_stat.assists,
    'steals',v_stat.steals,
    'blocks',v_stat.blocks,
    'turnovers',v_stat.turnovers,
    'fouls_committed',v_stat.fouls_committed,
    'fouls_drawn',v_stat.fouls_drawn
  ));

  perform public.iq_v7_save_manual_boxscore(v_game.id,v_starters,v_stats);

  if not exists(
    select 1 from public.player_game_stats
    where game_id=v_game.id
      and player_id=v_stat.player_id
      and minutes=v_before_minutes+1
  ) then
    raise exception 'CORE_MANUAL_BOXSCORE_UPDATE_NOT_APPLIED';
  end if;
end $$;

do $$
declare
  v_game core_pbp_game%rowtype;
  v_blocked boolean:=false;
begin
  select * into v_game from core_pbp_game;
  if v_game.id is null then raise exception 'CORE_PBP_GAME_MISSING'; end if;

  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    perform public.iq_v5_set_game_edit_state(
      v_game.id,'OPEN','CORE_FUNCTIONAL_PBP_TEMP_OPEN'
    );
  end if;

  begin
    perform public.iq_v7_save_manual_boxscore(v_game.id,'{}'::uuid[],'[]'::jsonb);
  exception
    when others then
      if sqlerrm='BOXSCORE_DERIVED_FROM_PLAY_BY_PLAY' then
        v_blocked:=true;
      else
        raise;
      end if;
  end;

  if not v_blocked then
    raise exception 'CORE_PBP_BOXSCORE_WAS_NOT_BLOCKED';
  end if;
end $$;

select
  'CORE_BOXSCORE_FUNCTIONAL' as section,
  true as manual_update_ok,
  true as pbp_guard_ok,
  true as all_ok;
