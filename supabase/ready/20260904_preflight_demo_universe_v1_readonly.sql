-- IQBasket Demo Universe V1 · READ ONLY preflight
\set ON_ERROR_STOP on

select
  to_regclass('public.clubs') is not null as clubs_ok,
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.training_sessions') is not null as training_ok,
  to_regclass('public.player360_wellness_entries') is not null as wellness_ok,
  to_regclass('public.player_evaluations') is not null as evaluations_ok,
  to_regclass('public.player_longitudinal_snapshots') is not null as longitudinal_ok,
  to_regclass('public.player_ai_insights') is not null as insights_ok,
  exists(select 1 from public.user_profiles where lower(email)='test@test.com') as test_user_ok,
  exists(select 1 from public.user_profiles where lower(email)='scolado@nechigroup.com') as superadmin_ok,
  exists(select 1 from public.player360_wellness_metric_catalog where team_season_id is null and module='recovery' and code='DAILY_ENERGY' and enabled) as daily_energy_ok,
  not exists(select 1 from public.team_seasons where id='d0000000-0000-4000-8000-000000000005'::uuid) as demo_absent_ok,
  pg_database_size(current_database()) as database_bytes_before;

select
  count(*) filter (where lower(email)='test@test.com') as test_user_count,
  count(*) filter (where lower(email)='scolado@nechigroup.com') as superadmin_count
from public.user_profiles;

select 'DEMO_UNIVERSE_V1_PREFLIGHT preflight_ok' as marker;
