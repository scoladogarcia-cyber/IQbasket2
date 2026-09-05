-- Read-only verification for Family Development Context V1.
select
  to_regprocedure('public.iq_v10_family_development_context(uuid,uuid)') is not null as context_ok,
  exists(select 1 from public.product_event_catalog where code='FAMILY_WEEKLY_PLAN_VIEWED' and is_active) as event_ok;

select
  has_function_privilege(
    'authenticated','public.iq_v10_family_development_context(uuid,uuid)','EXECUTE'
  ) as auth_execute,
  has_function_privilege(
    'anon','public.iq_v10_family_development_context(uuid,uuid)','EXECUTE'
  ) as anon_execute;

select
  pg_get_functiondef('public.iq_v10_family_development_context(uuid,uuid)'::regprocedure)
    ~* 'DEVELOPMENT_PLAN' as entitlement_gate_present,
  pg_get_functiondef('public.iq_v10_family_development_context(uuid,uuid)'::regprocedure)
    ~* 'family_can_view_player' as family_access_gate_present;
