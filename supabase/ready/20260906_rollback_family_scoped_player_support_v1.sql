-- Emergency rollback for V17 Family Scoped Player Support.
begin;

drop function if exists public.iq_v17_family_authorization_scope();

commit;

select
  'FAMILY_SCOPED_PLAYER_SUPPORT_V1_ROLLBACK' as section,
  to_regprocedure('public.iq_v17_family_authorization_scope()') is null as rpc_absent_ok;