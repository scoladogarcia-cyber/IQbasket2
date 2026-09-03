-- Core UX training edit verification · READ ONLY
select
  'CORE_UX_TRAINING_EDIT_VERIFY' as section,
  to_regprocedure('public.iq_v4_update_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)') is not null as training_update_rpc_ok,
  to_regprocedure('public.iq_v4_update_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null as external_update_rpc_ok,
  to_regprocedure('public.iq_core_ux_training_edit_capabilities()') is not null as capabilities_ok,
  position(
    'data_status' in pg_get_functiondef(to_regprocedure('public.iq_v4_can_manage_training(uuid)'))
  ) > 0 as frozen_guard_ok,
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
  (
    to_regprocedure('public.iq_v4_update_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)') is not null
    and to_regprocedure('public.iq_v4_update_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null
    and position('data_status' in pg_get_functiondef(to_regprocedure('public.iq_v4_can_manage_training(uuid)'))) > 0
  ) as all_ok;
