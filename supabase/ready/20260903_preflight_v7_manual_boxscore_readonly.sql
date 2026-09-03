-- IQBasket V7 manual boxscore preflight · READ ONLY
select
  'BOXSCORE_V7_PREFLIGHT' as section,
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.player_game_stats') is not null as player_game_stats_ok,
  to_regclass('public.game_events') is not null as game_events_ok,
  to_regprocedure('public.iq_v5_role_for_game(uuid)') is not null as role_helper_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null as eligibility_helper_ok;

select
  'BOXSCORE_V7_GAME_COLUMN' as section,
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='games'
  and column_name in ('id','team_season_id','date','edit_state','starter_ids')
order by ordinal_position;

select
  'BOXSCORE_V7_STATS_COLUMNS' as section,
  column_name,
  data_type,
  udt_name
from information_schema.columns
where table_schema='public'
  and table_name='player_game_stats'
  and column_name in (
    'game_id','player_id','starter','minutes','points',
    'fg2_made','fg2_attempted','fg3_made','fg3_attempted',
    'ft_made','ft_attempted','off_reb','def_reb','assists','steals',
    'blocks','blocks_made','turnovers','fouls_committed','fouls_drawn'
  )
order by ordinal_position;

select
  'BOXSCORE_V7_UNIQUE' as section,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.player_game_stats'::regclass
  and contype in ('p','u')
order by conname;

select
  'BOXSCORE_V7_BASELINE' as section,
  count(*) as games,
  count(*) filter (where upper(coalesce(edit_state,'OPEN'))='OPEN') as open_games,
  count(*) filter (where upper(coalesce(edit_state,'OPEN'))='LOCKED') as locked_games,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events,
  count(*) filter (
    where exists(select 1 from public.game_events ge where ge.game_id=games.id)
  ) as games_with_events,
  count(*) filter (
    where upper(coalesce(edit_state,'OPEN'))='OPEN'
      and not exists(select 1 from public.game_events ge where ge.game_id=games.id)
  ) as open_games_without_events
from public.games;
