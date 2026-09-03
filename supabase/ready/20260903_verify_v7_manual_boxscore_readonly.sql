select
  'BOXSCORE_CORRECTION_VERIFY' as section,
  to_regprocedure('public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)') is not null as rpc_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)',
    'EXECUTE'
  ) as execute_ok,
  position(
    'BOXSCORE_DERIVED_FROM_PLAY_BY_PLAY'
    in pg_get_functiondef('public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)'::regprocedure)
  )>0 as source_guard_ok,
  position(
    'PLAYER_NOT_ELIGIBLE_ON_GAME_DATE'
    in pg_get_functiondef('public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)'::regprocedure)
  )>0 as eligibility_guard_ok,
  position(
    '''SUPERADMIN'',''ADMIN'',''ENTRENADOR'',''ANALISTA'''
    in replace(pg_get_functiondef('public.iq_v7_save_manual_boxscore(uuid,uuid[],jsonb)'::regprocedure),' ','')
  )>0 as contextual_roles_ok;
