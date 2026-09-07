-- IQBasket V35 · read-only post-apply verification
-- No data mutation. SECURITY mode is checked through pg_proc.prosecdef because
-- PostgreSQL may omit explicit SECURITY INVOKER in pg_get_functiondef().

select
  to_regprocedure('public.iq_admin_set_account_status(uuid,text,text)') is not null
    as account_public_rpc_ok,
  to_regprocedure('public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid)') is not null
    as role_context_4_public_rpc_ok,
  to_regprocedure('public.iq_v7_assign_user_role_context(uuid,text,uuid)') is not null
    as role_context_3_public_rpc_ok,
  to_regprocedure('public.iq_v7_assign_user_role(uuid,text)') is not null
    as role_public_rpc_ok,
  to_regprocedure('iq_v35_private.admin_set_account_status(uuid,text,text)') is not null
    as account_private_rpc_ok,
  to_regprocedure('iq_v35_private.assign_user_role_context(uuid,text,uuid,uuid)') is not null
    as role_private_rpc_ok,

  not (select p.prosecdef from pg_proc p
       where p.oid='public.iq_admin_set_account_status(uuid,text,text)'::regprocedure)
    as account_public_invoker_ok,
  not (select p.prosecdef from pg_proc p
       where p.oid='public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid)'::regprocedure)
    as role_context_4_public_invoker_ok,
  not (select p.prosecdef from pg_proc p
       where p.oid='public.iq_v7_assign_user_role_context(uuid,text,uuid)'::regprocedure)
    as role_context_3_public_invoker_ok,
  not (select p.prosecdef from pg_proc p
       where p.oid='public.iq_v7_assign_user_role(uuid,text)'::regprocedure)
    as role_public_invoker_ok,

  (select p.prosecdef from pg_proc p
   where p.oid='iq_v35_private.admin_set_account_status(uuid,text,text)'::regprocedure)
    as account_private_definer_ok,
  (select p.prosecdef from pg_proc p
   where p.oid='iq_v35_private.assign_user_role_context(uuid,text,uuid,uuid)'::regprocedure)
    as role_private_definer_ok,

  has_schema_privilege('authenticated','iq_v35_private','USAGE')
    as authenticated_private_schema_usage_ok,
  not has_schema_privilege('anon','iq_v35_private','USAGE')
    as anon_private_schema_denied_ok,

  has_function_privilege('authenticated','public.iq_admin_set_account_status(uuid,text,text)','EXECUTE')
    as authenticated_account_execute_ok,
  has_function_privilege('authenticated','public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid)','EXECUTE')
    as authenticated_role_execute_ok,
  not has_function_privilege('anon','public.iq_admin_set_account_status(uuid,text,text)','EXECUTE')
    as anon_account_execute_denied_ok,
  not has_function_privilege('anon','public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid)','EXECUTE')
    as anon_role_execute_denied_ok,

  pg_get_functiondef('iq_v35_private.admin_set_account_status(uuid,text,text)'::regprocedure)
    like '%ACCOUNT_STATUS_ADMIN_REQUIRED%'
    and pg_get_functiondef('iq_v35_private.admin_set_account_status(uuid,text,text)'::regprocedure)
    like '%ACCOUNT_STATUS_MASTER_PROTECTED%'
    as account_authorization_guards_ok,

  pg_get_functiondef('iq_v35_private.assign_user_role_context(uuid,text,uuid,uuid)'::regprocedure)
    like '%ROLE_ASSIGNMENT_SUPERADMIN_DENIED%'
    and pg_get_functiondef('iq_v35_private.assign_user_role_context(uuid,text,uuid,uuid)'::regprocedure)
    like '%MASTER_IDENTITY_PROTECTED%'
    and pg_get_functiondef('iq_v35_private.assign_user_role_context(uuid,text,uuid,uuid)'::regprocedure)
    like '%ROLE_ASSIGNMENT_SCOPE_DENIED%'
    and pg_get_functiondef('iq_v35_private.assign_user_role_context(uuid,text,uuid,uuid)'::regprocedure)
    like '%PLAYER_LINK_ROSTER_MEMBERSHIP_REQUIRED%'
    as role_authorization_guards_ok;
