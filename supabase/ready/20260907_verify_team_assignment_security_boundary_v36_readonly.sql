-- IQBasket V36 · read-only post-apply verification
-- SECURITY mode is checked via pg_proc.prosecdef; no data is modified.

select
  to_regprocedure('public.iq_v7_set_user_team_assignments(uuid,uuid[])') is not null
    as public_rpc_ok,
  to_regprocedure('iq_v35_private.set_user_team_assignments(uuid,uuid[])') is not null
    as private_rpc_ok,

  not (select p.prosecdef from pg_proc p
       where p.oid='public.iq_v7_set_user_team_assignments(uuid,uuid[])'::regprocedure)
    as public_invoker_ok,
  (select p.prosecdef from pg_proc p
   where p.oid='iq_v35_private.set_user_team_assignments(uuid,uuid[])'::regprocedure)
    as private_definer_ok,

  has_function_privilege('authenticated','public.iq_v7_set_user_team_assignments(uuid,uuid[])','EXECUTE')
    as authenticated_public_execute_ok,
  not has_function_privilege('anon','public.iq_v7_set_user_team_assignments(uuid,uuid[])','EXECUTE')
    as anon_public_execute_denied_ok,
  has_function_privilege('authenticated','iq_v35_private.set_user_team_assignments(uuid,uuid[])','EXECUTE')
    as authenticated_private_execute_ok,
  not has_function_privilege('anon','iq_v35_private.set_user_team_assignments(uuid,uuid[])','EXECUTE')
    as anon_private_execute_denied_ok,

  pg_get_functiondef('iq_v35_private.set_user_team_assignments(uuid,uuid[])'::regprocedure)
    like '%TEAM_ASSIGNMENT_ADMIN_REQUIRED%'
    and pg_get_functiondef('iq_v35_private.set_user_team_assignments(uuid,uuid[])'::regprocedure)
    like '%TEAM_ASSIGNMENT_SCOPE_DENIED%'
    and pg_get_functiondef('iq_v35_private.set_user_team_assignments(uuid,uuid[])'::regprocedure)
    like '%TEAM_ASSIGNMENT_PRIVILEGED_TARGET_DENIED%'
    and pg_get_functiondef('iq_v35_private.set_user_team_assignments(uuid,uuid[])'::regprocedure)
    like '%MASTER_IDENTITY_PROTECTED%'
    as authorization_guards_ok,

  pg_get_functiondef('iq_v35_private.set_user_team_assignments(uuid,uuid[])'::regprocedure)
    not like '%scolado@nechigroup.com%'
    as no_identity_hardcode_ok;
