-- IQBasket Player 360 · Training edit V1 verify · READ ONLY
select
  'TRAINING_EDIT_VERIFY' as section,
  to_regprocedure('public.iq_v4_update_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)') is not null as training_update_rpc_ok,
  to_regprocedure('public.iq_v4_update_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null as external_update_rpc_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_update_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)',
    'EXECUTE'
  ) as training_execute_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_update_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)',
    'EXECUTE'
  ) as external_execute_ok,
  position(
    '''training_edit'', true'
    in pg_get_functiondef('public.iq_v4_training_capabilities()'::regprocedure)
  )>0 as capabilities_training_edit_ok,
  position(
    'TRAINING_CONFIRMED_PARTICIPANT_CANNOT_BE_REMOVED'
    in pg_get_functiondef(
      'public.iq_v4_update_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
    )
  )>0 as confirmed_attendance_guard_ok,
  position(
    'PLAYER_NOT_ELIGIBLE_ON_TRAINING_DATE'
    in pg_get_functiondef(
      'public.iq_v4_update_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
    )
  )>0 as temporal_roster_guard_ok;
