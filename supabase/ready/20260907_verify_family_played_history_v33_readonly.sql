-- IQBasket V33 · read-only verification after migration.
select
  to_regprocedure('public.iq_v33_family_player_passport(uuid)') is not null as v33_passport_ok,
  position(
    'FINISHED' in upper(pg_get_functiondef('public.iq_v33_family_player_passport(uuid)'::regprocedure))
  ) > 0 as finished_filter_present,
  has_function_privilege('authenticated','public.iq_v33_family_player_passport(uuid)','EXECUTE') as authenticated_execute_ok,
  not has_function_privilege('anon','public.iq_v33_family_player_passport(uuid)','EXECUTE') as anon_execute_denied;