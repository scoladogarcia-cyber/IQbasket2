-- Read-only preflight for V21 Game Capture Delegation V1.
select
  'GAME_CAPTURE_DELEGATION_V1_PREFLIGHT' as section,
  (
    to_regclass('public.games') is not null
    and to_regclass('public.user_profiles') is not null
    and to_regclass('public.roster_memberships') is not null
    and to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_account_is_active()') is not null
    and to_regprocedure('public.iq_account_is_active_for_user(uuid)') is not null
    and to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is not null
    and to_regprocedure('public.iq_v6_role_for_team_season(uuid)') is not null
    and to_regprocedure('iq_private.can_mutate_game(uuid)') is not null
    and to_regprocedure('iq_private.game_play_state_actor_allowed(uuid,text)') is not null
    and to_regclass('public.game_capture_delegations') is null
    and to_regclass('public.game_capture_delegation_events') is null
    and to_regclass('public.game_capture_write_audit') is null
    and to_regprocedure('public.iq_v21_game_capture_snapshot(uuid)') is null
    and to_regprocedure('public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is null
  ) as ready;
