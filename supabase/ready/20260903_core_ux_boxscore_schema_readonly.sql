-- Core UX BoxScore schema diagnostic · READ ONLY
select
  'CORE_UX_BOXSCORE_SCHEMA' as section,
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name
from information_schema.columns c
where c.table_schema='public'
  and (
    (c.table_name='games' and c.column_name in ('id','team_id','team_season_id','date','team_score','edit_state','starter_ids'))
    or
    (c.table_name='player_game_stats' and c.column_name in (
      'game_id','player_id','starter','minutes','fg2_made','fg2_attempted',
      'fg3_made','fg3_attempted','ft_made','ft_attempted','off_reb','def_reb',
      'assists','steals','blocks','blocks_made','blocks_received','turnovers',
      'fouls_committed','fouls_drawn','plus_minus','evaluation','points'
    ))
  )
order by c.table_name,c.ordinal_position;

select
  'CORE_UX_BOXSCORE_CONSTRAINT' as section,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.player_game_stats'::regclass
  and contype in ('p','u')
order by conname;
