-- =============================================================================
-- IQBasket Demo Universe V1 · rollback
-- Deletes ONLY rows belonging to the deterministic synthetic demo universe.
-- =============================================================================
\set ON_ERROR_STOP on
begin;

-- Reopen only demo games through the normal V5 lifecycle before deleting child
-- rows. This keeps the immutable lock guard active even during emergency rollback.
do $demo_reopen_context$
declare
  v_admin_id uuid;
  v_claims text;
begin
  if exists (
    select 1 from public.games
    where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(coalesce(edit_state,'OPEN'))='LOCKED'
  ) then
    select id into v_admin_id
    from public.user_profiles
    where lower(email)='scolado@nechigroup.com'
    limit 1;

    if v_admin_id is null then
      raise exception 'DEMO_V1_ROLLBACK_SUPERADMIN_PROFILE_MISSING';
    end if;

    v_claims := jsonb_build_object(
      'sub', v_admin_id::text,
      'email', 'scolado@nechigroup.com',
      'role', 'authenticated'
    )::text;

    perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
    perform set_config('request.jwt.claim.email', 'scolado@nechigroup.com', true);
    perform set_config('request.jwt.claim', v_claims, true);
    perform set_config('request.jwt.claims', v_claims, true);

    update public.games
    set edit_state='OPEN',
        lock_reason='Demo Universe V1 rollback'
    where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(coalesce(edit_state,'OPEN'))='LOCKED';

    perform set_config('request.jwt.claim.sub','',true);
    perform set_config('request.jwt.claim.email','',true);
    perform set_config('request.jwt.claim','',true);
    perform set_config('request.jwt.claims','',true);
  end if;
end
$demo_reopen_context$;

-- Player 360 / AI
DELETE FROM public.player_ai_insights
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player_longitudinal_snapshots
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player360_wellness_observations o
USING public.player360_wellness_entries e
WHERE o.entry_id=e.id
  AND e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player360_wellness_entries
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player360_sensitive_access_grants
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player360_processing_authorizations
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player_objective_targets t
USING public.player_objective_profiles p
WHERE t.profile_id=p.id
  AND p.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player_objective_profiles
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player_evaluation_scores s
USING public.player_evaluations e
WHERE s.evaluation_id=e.id
  AND e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player_evaluations
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- Training / external development
DELETE FROM public.external_development_sessions
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.training_participants
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.training_blocks b
USING public.training_sessions s
WHERE b.training_session_id=s.id
  AND s.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.training_sessions
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player360_activity_types
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- Access scope created only for the synthetic team-season
DELETE FROM public.team_season_memberships
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- Sporting data
DELETE FROM public.play_by_play_events p
USING public.games g
WHERE p.game_id=g.id
  AND g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.game_events e
USING public.games g
WHERE e.game_id=g.id
  AND g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.lineup_game_stats l
USING public.games g
WHERE l.game_id=g.id
  AND g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.game_period_scores s
USING public.games g
WHERE s.game_id=g.id
  AND g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.team_game_stats s
USING public.games g
WHERE s.game_id=g.id
  AND g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.player_game_stats s
USING public.games g
WHERE s.game_id=g.id
  AND g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.games
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.roster_membership_stints st
USING public.roster_memberships rm
WHERE st.roster_membership_id=rm.id
  AND rm.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.roster_memberships
WHERE team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.players
WHERE team_id='d0000000-0000-4000-8000-000000000002'::uuid;

DELETE FROM public.team_seasons
WHERE id='d0000000-0000-4000-8000-000000000005'::uuid;

DELETE FROM public.season_catalog
WHERE id='d0000000-0000-4000-8000-000000000004'::uuid
   OR code='IQB-DEMO-2026-27-V1';

DELETE FROM public.seasons
WHERE id='d0000000-0000-4000-8000-000000000003'::uuid;

DELETE FROM public.teams
WHERE id='d0000000-0000-4000-8000-000000000002'::uuid;

DELETE FROM public.clubs
WHERE id='d0000000-0000-4000-8000-000000000001'::uuid;

commit;

select 'DEMO_UNIVERSE_V1_ROLLBACK rollback_ok' as marker;
