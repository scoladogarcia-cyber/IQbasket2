-- IQBasket V33 · read-only preflight for Family played history.
select
  to_regprocedure('public.iq_v32_family_player_passport(uuid)') is not null as v32_passport_ok,
  to_regclass('public.player_game_stats') is not null as player_game_stats_ok,
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.season_catalog') is not null as season_catalog_ok,
  count(*) filter (where upper(coalesce(g.play_state,''))='FINISHED') as finished_player_stat_rows,
  count(*) filter (where upper(coalesce(g.play_state,''))<>'FINISHED') as non_finished_player_stat_rows,
  count(*) filter (
    where upper(coalesce(g.play_state,''))='SCHEDULED'
      and coalesce(pgs.minutes,0)=0
      and coalesce(pgs.points,0)=0
  ) as scheduled_zero_stat_rows
from public.player_game_stats pgs
join public.games g on g.id=pgs.game_id;