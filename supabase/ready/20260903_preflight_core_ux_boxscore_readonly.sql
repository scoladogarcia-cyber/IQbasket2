-- Controlled BoxScore preflight · READ ONLY
select
  'CORE_UX_BOXSCORE_PREFLIGHT' as section,
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.player_game_stats') is not null as stats_ok,
  to_regclass('public.game_events') is not null as events_ok,
  to_regprocedure('public.iq_v5_role_for_game(uuid)') is not null as role_helper_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null as eligibility_ok;

select
  'CORE_UX_BOXSCORE_BASELINE' as section,
  (select count(*) from public.games) as games,
  (select count(*) from public.player_game_stats) as stats,
  (select count(*) from public.game_events) as events;
