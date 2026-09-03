-- =============================================================================
-- IQBasket V7 · Controlled manual boxscore correction
-- Manual boxscore is allowed only when no Play-by-Play events exist.
-- =============================================================================
begin;

do $preflight$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.player_game_stats') is null
     or to_regclass('public.game_events') is null
     or to_regprocedure('public.iq_v5_role_for_game(uuid)') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null then
    raise exception 'BOXSCORE_CORRECTION_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

create or replace function public.iq_v7_save_manual_boxscore(
  p_game_id uuid,
  p_starter_ids uuid[] default '{}'::uuid[],
  p_stats jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game public.games%rowtype;
  v_role text;
  v_item jsonb;
  v_player_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_stats,'[]'::jsonb))<>'array' then
    raise exception 'BOXSCORE_STATS_MUST_BE_ARRAY';
  end if;

  select * into v_game
  from public.games
  where id=p_game_id
  for update;

  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_LOCKED';
  end if;

  v_role:=public.iq_v5_role_for_game(p_game_id);
  if coalesce(v_role,'') not in ('SUPERADMIN','ADMIN','ENTRENADOR','ANALISTA') then
    raise exception 'BOXSCORE_EDIT_DENIED';
  end if;

  if exists (
    select 1 from public.game_events ge where ge.game_id=p_game_id
  ) then
    raise exception 'BOXSCORE_DERIVED_FROM_PLAY_BY_PLAY';
  end if;

  foreach v_player_id in array coalesce(p_starter_ids,'{}'::uuid[])
  loop
    if not public.iq_v3_player_eligible_on_date(
      v_player_id,v_game.team_season_id,v_game.date
    ) then
      raise exception 'PLAYER_NOT_ELIGIBLE_ON_GAME_DATE';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_stats,'[]'::jsonb))
  loop
    v_player_id:=nullif(v_item->>'player_id','')::uuid;
    if v_player_id is null then raise exception 'BOXSCORE_PLAYER_REQUIRED'; end if;

    if not public.iq_v3_player_eligible_on_date(
      v_player_id,v_game.team_season_id,v_game.date
    ) then
      raise exception 'PLAYER_NOT_ELIGIBLE_ON_GAME_DATE';
    end if;

    insert into public.player_game_stats(
      game_id,player_id,starter,minutes,points,
      fg2_made,fg2_attempted,fg3_made,fg3_attempted,
      ft_made,ft_attempted,off_reb,def_reb,assists,steals,
      blocks,blocks_made,turnovers,fouls_committed,fouls_drawn
    )
    values(
      p_game_id,
      v_player_id,
      coalesce((v_item->>'starter')::boolean,false),
      coalesce(nullif(v_item->>'minutes','')::integer,0),
      coalesce(nullif(v_item->>'points','')::integer,0),
      coalesce(nullif(v_item->>'fg2_made','')::integer,0),
      coalesce(nullif(v_item->>'fg2_attempted','')::integer,0),
      coalesce(nullif(v_item->>'fg3_made','')::integer,0),
      coalesce(nullif(v_item->>'fg3_attempted','')::integer,0),
      coalesce(nullif(v_item->>'ft_made','')::integer,0),
      coalesce(nullif(v_item->>'ft_attempted','')::integer,0),
      coalesce(nullif(v_item->>'off_reb','')::integer,0),
      coalesce(nullif(v_item->>'def_reb','')::integer,0),
      coalesce(nullif(v_item->>'assists','')::integer,0),
      coalesce(nullif(v_item->>'steals','')::integer,0),
      coalesce(nullif(v_item->>'blocks','')::integer,0),
      coalesce(nullif(v_item->>'blocks','')::integer,0),
      coalesce(nullif(v_item->>'turnovers','')::integer,0),
      coalesce(nullif(v_item->>'fouls_committed','')::integer,0),
      coalesce(nullif(v_item->>'fouls_drawn','')::integer,0)
    )
    on conflict (game_id,player_id)
    do update set
      starter=excluded.starter,
      minutes=excluded.minutes,
      points=excluded.points,
      fg2_made=excluded.fg2_made,
      fg2_attempted=excluded.fg2_attempted,
      fg3_made=excluded.fg3_made,
      fg3_attempted=excluded.fg3_attempted,
      ft_made=excluded.ft_made,
      ft_attempted=excluded.ft_attempted,
      off_reb=excluded.off_reb,
      def_reb=excluded.def_reb,
      assists=excluded.assists,
      steals=excluded.steals,
      blocks=excluded.blocks,
      blocks_made=excluded.blocks_made,
      turnovers=excluded.turnovers,
      fouls_committed=excluded.fouls_committed,
      fouls_drawn=excluded.fouls_drawn;

    v_count:=v_count+1;
  end loop;

  update public.games
  set starter_ids=to_jsonb(coalesce(p_starter_ids,'{}'::uuid[]))
  where id=p_game_id;

  return jsonb_build_object(
    'game_id',p_game_id,
    'updated_players',v_count,
    'source','MANUAL_BOXSCORE'
  );
end;
$$;

revoke all on function public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)
  from public,anon;
grant execute on function public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)
  to authenticated;

commit;
