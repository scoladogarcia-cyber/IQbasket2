-- Read-only verification for installed V21 game capture delegation boundary.
select
  'GAME_CAPTURE_DELEGATION_V1_VERIFY' as section,
  (
    to_regclass('public.game_capture_delegations') is not null
    and to_regclass('public.game_capture_delegation_events') is not null
    and to_regclass('public.game_capture_write_audit') is not null
    and to_regprocedure('public.iq_v21_my_game_capture_delegations()') is not null
    and to_regprocedure('public.iq_v21_list_game_capture_delegations(uuid)') is not null
    and to_regprocedure('public.iq_v21_grant_game_capture_delegation(uuid,text,text[],timestamptz,timestamptz,text)') is not null
    and to_regprocedure('public.iq_v21_revoke_game_capture_delegation(uuid,text)') is not null
    and to_regprocedure('public.iq_v21_game_capture_snapshot(uuid)') is not null
    and to_regprocedure('public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is not null
    and has_function_privilege('authenticated','public.iq_v21_game_capture_snapshot(uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.iq_v21_game_capture_snapshot(uuid)','EXECUTE')
    and not has_function_privilege('anon','public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)','EXECUTE')
    and not has_table_privilege('authenticated','public.game_capture_delegations','SELECT')
    and not has_table_privilege('authenticated','public.game_capture_delegations','INSERT')
    and not has_table_privilege('authenticated','public.game_capture_delegations','UPDATE')
    and not has_table_privilege('authenticated','public.game_capture_write_audit','SELECT')
    and (select relrowsecurity from pg_class where oid='public.game_capture_delegations'::regclass)
    and (select relrowsecurity from pg_class where oid='public.game_capture_delegation_events'::regclass)
    and (select relrowsecurity from pg_class where oid='public.game_capture_write_audit'::regclass)
    and not (select prosecdef from pg_proc where oid='public.iq_v21_game_capture_snapshot(uuid)'::regprocedure)
    and not (select prosecdef from pg_proc where oid='public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)'::regprocedure)
    and (select prosecdef from pg_proc where oid='iq_v21_private.snapshot(uuid)'::regprocedure)
    and position('iq_v21_private.has_capability' in pg_get_functiondef('iq_private.game_play_state_actor_allowed(uuid,text)'::regprocedure)) > 0
  ) as installed_ok;
