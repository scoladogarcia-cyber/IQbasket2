-- =============================================================================
-- IQBasket Demo Universe V1 · read-only verification
-- =============================================================================
\set ON_ERROR_STOP on

do $demo$
begin
  if not exists(select 1 from public.season_catalog where id='d0000000-0000-4000-8000-000000000004'::uuid and is_test=true) then
    raise exception 'DEMO_V1_VERIFY_SEASON_MISSING';
  end if;

  if (select count(*) from public.players where team_id='d0000000-0000-4000-8000-000000000002'::uuid) <> 12
     or (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 12 then
    raise exception 'DEMO_V1_VERIFY_CORE_COUNTS_FAILED';
  end if;

  if (select count(*) from public.player_game_stats pgs join public.games g on g.id=pgs.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 144 then
    raise exception 'DEMO_V1_VERIFY_PLAYER_STATS_COUNT_FAILED';
  end if;

  if exists(
    select 1
    from public.games g
    where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and g.team_score <> (
        select coalesce(sum(pgs.points),0)::int
        from public.player_game_stats pgs
        where pgs.game_id=g.id
      )
  ) then
    raise exception 'DEMO_V1_VERIFY_BOXSCORE_SCORE_MISMATCH';
  end if;

  if (select count(*) from public.game_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) < 100
     or (select count(*) from public.play_by_play_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) < 100 then
    raise exception 'DEMO_V1_VERIFY_PBP_TOO_SMALL';
  end if;

  if (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and upper(coalesce(edit_state,'OPEN'))='LOCKED') <> 10
     or (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and upper(coalesce(edit_state,'OPEN'))='OPEN') <> 2
     or (select count(*) from public.game_lock_history h join public.games g on g.id=h.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and upper(h.action)='LOCKED') <> 10 then
    raise exception 'DEMO_V1_VERIFY_LOCK_STATE_FAILED';
  end if;

  if (select count(*) from public.training_sessions where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 24
     or (select count(*) from public.training_blocks b join public.training_sessions s on s.id=b.training_session_id where s.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 72
     or (select count(*) from public.training_participants p join public.training_sessions s on s.id=p.training_session_id where s.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 288 then
    raise exception 'DEMO_V1_VERIFY_TRAINING_COUNTS_FAILED';
  end if;

  if (select count(*) from public.external_development_sessions where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 24 then
    raise exception 'DEMO_V1_VERIFY_EXTERNAL_DEVELOPMENT_FAILED';
  end if;

  if (select count(*) from public.player_evaluations where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 12
     or (select count(*) from public.player_evaluation_scores s join public.player_evaluations e on e.id=s.evaluation_id where e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 60
     or (select count(*) from public.player_objective_profiles where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 12
     or (select count(*) from public.player_objective_targets t join public.player_objective_profiles p on p.id=t.profile_id where p.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 36 then
    raise exception 'DEMO_V1_VERIFY_EVALUATION_COUNTS_FAILED';
  end if;

  if (select count(*) from public.player360_processing_authorizations where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 12
     or (select count(*) from public.player360_sensitive_access_grants where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 24 then
    raise exception 'DEMO_V1_VERIFY_PRIVACY_COUNTS_FAILED';
  end if;

  if (select count(*) from public.player360_wellness_entries where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 672
     or (select count(*) from public.player360_wellness_observations o join public.player360_wellness_entries e on e.id=o.entry_id where e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) <> 3360 then
    raise exception 'DEMO_V1_VERIFY_WELLNESS_COUNTS_FAILED';
  end if;

  if (select count(*) from public.player_longitudinal_snapshots where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and calculation_version='DEMO_V1') <> 12
     or (select count(*) from public.player_ai_insights where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid and provider='SYNTHETIC_DEMO' and model_name='NO_LLM_CALLED' and status='DRAFT') <> 12 then
    raise exception 'DEMO_V1_VERIFY_AI_FIXTURE_FAILED';
  end if;

  if not exists(
    select 1 from public.team_season_memberships m
    join public.user_profiles u on u.id=m.user_id
    where lower(u.email)='test@test.com'
      and m.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(m.function_role)='ANALISTA'
      and upper(m.status)='ACTIVE'
  ) then
    raise exception 'DEMO_V1_VERIFY_TEST_SCOPE_FAILED';
  end if;

  -- V3 separates the global security role from the legacy/application role.
  -- The demo may add contextual ANALISTA scope, but it must never escalate either
  -- identity layer: the test account remains global USER + application INVITADO.
  if exists(
    select 1 from public.user_profiles u
    where lower(u.email)='test@test.com'
      and (
        upper(coalesce(u.global_role,'USER')) <> 'USER'
        or upper(coalesce(u.role,'INVITADO')) <> 'INVITADO'
      )
  ) then
    raise exception 'DEMO_V1_VERIFY_TEST_GLOBAL_ROLE_CHANGED';
  end if;
end
$demo$;

select
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  (select count(*) from public.players where team_id='d0000000-0000-4000-8000-000000000002'::uuid) as demo_players,
  (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as demo_games,
  (select count(*) from public.game_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as demo_game_events,
  (select count(*) from public.play_by_play_events e join public.games g on g.id=e.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as demo_pbp,
  (select count(*) from public.training_sessions where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as demo_training_sessions,
  (select count(*) from public.player360_wellness_entries where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as demo_wellness_entries;

select 'DEMO_UNIVERSE_V1_VERIFY verify_ok' as marker;
