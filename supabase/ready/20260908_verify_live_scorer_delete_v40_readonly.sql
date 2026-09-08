-- IQBasket V40 · read-only verifier for the safe game deletion boundary.
-- This script does not delete or mutate any game.
select
  to_regprocedure('public.iq_v40_delete_game(uuid,text)') is not null as public_rpc_exists,
  to_regprocedure('iq_v40_private.delete_game(uuid,text)') is not null as private_impl_exists,
  (select prosecdef = false
     from pg_proc
    where oid='public.iq_v40_delete_game(uuid,text)'::regprocedure) as public_is_security_invoker,
  (select prosecdef = true
     from pg_proc
    where oid='iq_v40_private.delete_game(uuid,text)'::regprocedure) as private_is_security_definer,
  has_function_privilege(
    'authenticated',
    'public.iq_v40_delete_game(uuid,text)',
    'EXECUTE'
  ) as authenticated_public_execute_ok,
  (select relrowsecurity
     from pg_class
    where oid='public.game_deletion_audit'::regclass) as deletion_audit_rls_enabled,
  not has_table_privilege(
    'authenticated',
    'public.game_deletion_audit',
    'SELECT'
  ) as deletion_audit_direct_select_denied;
