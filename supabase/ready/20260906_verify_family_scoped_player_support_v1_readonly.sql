-- Read-only verification for V17 Family Scoped Player Support.
select
  'FAMILY_SCOPED_PLAYER_SUPPORT_V1_VERIFY' as section,
  to_regprocedure('public.iq_v17_family_authorization_scope()') is not null as rpc_ok,
  has_function_privilege(
    'authenticated','public.iq_v17_family_authorization_scope()','EXECUTE'
  ) as authenticated_execute_ok,
  not has_function_privilege(
    'anon','public.iq_v17_family_authorization_scope()','EXECUTE'
  ) as anon_blocked_ok,
  coalesce((
    select 'search_path=""' = any(coalesce(p.proconfig,'{}'::text[]))
    from pg_proc p
    where p.oid=to_regprocedure('public.iq_v17_family_authorization_scope()')
  ),false) as search_path_ok,
  (
    to_regprocedure('public.iq_v17_family_authorization_scope()') is not null
    and has_function_privilege(
      'authenticated','public.iq_v17_family_authorization_scope()','EXECUTE'
    )
    and not has_function_privilege(
      'anon','public.iq_v17_family_authorization_scope()','EXECUTE'
    )
  ) as ready;