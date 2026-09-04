-- IQBasket Demo Universe V1 · READ ONLY preflight
\set ON_ERROR_STOP on

do $demo$
begin
  if to_regclass('public.clubs') is null
     or to_regclass('public.games') is null
     or to_regclass('public.play_by_play_events') is null
     or to_regclass('public.training_sessions') is null
     or to_regclass('public.player360_wellness_entries') is null
     or to_regclass('public.player_evaluations') is null
     or to_regclass('public.player_longitudinal_snapshots') is null
     or to_regclass('public.player_ai_insights') is null then
    raise exception 'DEMO_V1_PREFLIGHT_SCHEMA_MISSING';
  end if;

  if not exists(select 1 from public.user_profiles where lower(email)='test@test.com') then
    raise exception 'DEMO_V1_PREFLIGHT_TEST_USER_MISSING';
  end if;

  if not exists(select 1 from public.user_profiles where lower(email)='scolado@nechigroup.com') then
    raise exception 'DEMO_V1_PREFLIGHT_SUPERADMIN_MISSING';
  end if;

  if not exists(
    select 1 from public.player360_wellness_metric_catalog
    where team_season_id is null and module='recovery' and code='DAILY_ENERGY' and enabled
  ) then
    raise exception 'DEMO_V1_PREFLIGHT_DAILY_ENERGY_MISSING';
  end if;

  if exists(select 1 from public.team_seasons where id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.season_catalog where code='IQB-DEMO-2026-27-V1')
     or exists(select 1 from public.teams where id='d0000000-0000-4000-8000-000000000002'::uuid) then
    raise exception 'DEMO_V1_PREFLIGHT_ALREADY_INSTALLED';
  end if;
end
$demo$;

select
  pg_database_size(current_database()) as database_bytes_before,
  (select count(*) from public.players) as players_before,
  (select count(*) from public.games) as games_before,
  (select count(*) from public.player_game_stats) as player_stats_before,
  (select count(*) from public.game_events) as game_events_before,
  (select count(*) from public.play_by_play_events) as pbp_before,
  (select count(*) from public.training_sessions) as training_before,
  (select count(*) from public.player360_wellness_entries) as wellness_before;

select 'DEMO_UNIVERSE_V1_PREFLIGHT preflight_ok' as marker;
