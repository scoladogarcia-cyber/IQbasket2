-- Controlled BoxScore verification · READ ONLY
select
  'CORE_UX_BOXSCORE_VERIFY' as section,
  to_regclass('public.game_boxscore_corrections') is not null as audit_table_ok,
  to_regprocedure('public.iq_core_ux_can_edit_boxscore(uuid)') is not null as can_edit_rpc_ok,
  to_regprocedure('public.iq_core_ux_save_boxscore_correction(uuid,jsonb,jsonb,text,text,jsonb)') is not null as save_rpc_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_core_ux_save_boxscore_correction(uuid,jsonb,jsonb,text,text,jsonb)',
    'EXECUTE'
  ) as execute_ok,
  position(
    'BOXSCORE_TEAM_SCORE_MISMATCH'
    in pg_get_functiondef(to_regprocedure('public.iq_core_ux_save_boxscore_correction(uuid,jsonb,jsonb,text,text,jsonb)'))
  ) > 0 as score_guard_ok,
  position(
    'BOXSCORE_OVERRIDE_REASON_REQUIRED'
    in pg_get_functiondef(to_regprocedure('public.iq_core_ux_save_boxscore_correction(uuid,jsonb,jsonb,text,text,jsonb)'))
  ) > 0 as override_reason_guard_ok,
  (
    to_regclass('public.game_boxscore_corrections') is not null
    and to_regprocedure('public.iq_core_ux_can_edit_boxscore(uuid)') is not null
    and to_regprocedure('public.iq_core_ux_save_boxscore_correction(uuid,jsonb,jsonb,text,text,jsonb)') is not null
  ) as all_ok;
