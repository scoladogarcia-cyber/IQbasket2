-- =============================================================================
-- IQBasket v3 · PHASE 3E POST-APPLY SUMMARY (READ ONLY)
-- Date: 2026-09-02
-- =============================================================================

select
  'PHASE3E_POST_APPLY' as section,
  to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    as market_directory_function_ok,
  position(
    '''market_directory'', true'
    in pg_get_functiondef(
      to_regprocedure('public.iq_v3_transfer_request_capabilities()')
    )
  ) > 0 as market_capability_ok,
  position(
    '''market_profile_scope'', ''MINIMAL_SEASONAL_V1'''
    in pg_get_functiondef(
      to_regprocedure('public.iq_v3_transfer_request_capabilities()')
    )
  ) > 0 as minimal_profile_capability_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_v3_list_transfer_market(uuid)',
    'EXECUTE'
  ) as authenticated_execute_ok,
  to_regclass('public.roster_transfer_requests') is not null
    as phase3d_table_ok,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    as phase3d_request_ok,
  to_regclass('public.roster_membership_stints') is not null
    as phase3c_stints_ok,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (
    to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    and position(
      '''market_directory'', true'
      in pg_get_functiondef(
        to_regprocedure('public.iq_v3_transfer_request_capabilities()')
      )
    ) > 0
    and position(
      '''market_profile_scope'', ''MINIMAL_SEASONAL_V1'''
      in pg_get_functiondef(
        to_regprocedure('public.iq_v3_transfer_request_capabilities()')
      )
    ) > 0
    and has_function_privilege(
      'authenticated',
      'public.iq_v3_list_transfer_market(uuid)',
      'EXECUTE'
    )
    and to_regclass('public.roster_transfer_requests') is not null
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    and to_regclass('public.roster_membership_stints') is not null
  ) as phase3e_ok;
