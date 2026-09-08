-- IQBasket V43 · read-only verifier for same-user live lease recovery.
select
  to_regprocedure('public.iq_v43_recover_own_game_live_session(uuid)') is not null as public_rpc_ok,
  to_regprocedure('iq_v43_private.recover_own_game_live_session(uuid)') is not null as private_function_ok,
  has_function_privilege('authenticated','public.iq_v43_recover_own_game_live_session(uuid)','EXECUTE') as authenticated_execute_ok,
  not has_function_privilege('anon','public.iq_v43_recover_own_game_live_session(uuid)','EXECUTE') as anon_execute_denied,
  not has_function_privilege('public','public.iq_v43_recover_own_game_live_session(uuid)','EXECUTE') as public_execute_denied;
