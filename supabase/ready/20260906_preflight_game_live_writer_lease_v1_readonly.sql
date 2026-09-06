-- IQBasket V28 · read-only preflight
select
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.user_profiles') is not null as user_profiles_ok,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regprocedure('public.iq_account_is_active()') is not null as account_guard_ok,
  to_regprocedure('iq_private.can_mutate_game(uuid)') is not null as mutate_guard_ok,
  to_regprocedure('iq_v21_private.has_capability(uuid,text)') is not null as delegation_capability_ok,
  to_regprocedure('iq_v21_private.can_manage(uuid)') is not null as delegation_manage_ok,
  to_regprocedure('iq_v21_private.can_access_snapshot(uuid)') is not null as snapshot_guard_ok,
  to_regprocedure('iq_v21_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is not null as v21_save_private_ok,
  to_regprocedure('public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is not null as v21_save_public_ok,
  to_regprocedure('extensions.digest(text,text)') is not null as digest_ok,
  to_regclass('public.game_live_sessions') is null as sessions_absent,
  to_regclass('public.game_live_session_events') is null as session_events_absent,
  to_regclass('public.game_live_handoffs') is null as handoffs_absent;
