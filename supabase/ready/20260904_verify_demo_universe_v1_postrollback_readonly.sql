-- IQBasket Demo Universe V1 · READ ONLY post-rollback verification
\set ON_ERROR_STOP on

do $demo$
begin
  if exists(select 1 from public.clubs where id='d0000000-0000-4000-8000-000000000001'::uuid)
     or exists(select 1 from public.teams where id='d0000000-0000-4000-8000-000000000002'::uuid)
     or exists(select 1 from public.seasons where id='d0000000-0000-4000-8000-000000000003'::uuid)
     or exists(select 1 from public.season_catalog where id='d0000000-0000-4000-8000-000000000004'::uuid or code='IQB-DEMO-2026-27-V1')
     or exists(select 1 from public.team_seasons where id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.players where team_id='d0000000-0000-4000-8000-000000000002'::uuid)
     or exists(select 1 from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.training_sessions where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.player360_wellness_entries where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.player_evaluations where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.player_longitudinal_snapshots where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid)
     or exists(select 1 from public.player_ai_insights where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) then
    raise exception 'DEMO_V1_POSTROLLBACK_RESIDUE_FOUND';
  end if;

  if not exists(select 1 from public.user_profiles where lower(email)='test@test.com')
     or not exists(select 1 from public.user_profiles where lower(email)='scolado@nechigroup.com') then
    raise exception 'DEMO_V1_POSTROLLBACK_EXISTING_USERS_DAMAGED';
  end if;

  if to_regclass('public.player360_wellness_entries') is null
     or to_regclass('public.player_longitudinal_snapshots') is null
     or to_regclass('public.player_ai_insights') is null then
    raise exception 'DEMO_V1_POSTROLLBACK_FOUNDATION_DAMAGED';
  end if;
end
$demo$;

select 'DEMO_UNIVERSE_V1_POSTROLLBACK postrollback_ok' as marker;
