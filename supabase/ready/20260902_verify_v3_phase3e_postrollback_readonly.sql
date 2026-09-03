-- =============================================================================
-- IQBasket v3 · PHASE 3E POST-ROLLBACK VERIFICATION (READ ONLY)
-- Date: 2026-09-02
-- =============================================================================

select
  'PHASE3E_POST_ROLLBACK' as section,
  to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is null
    as market_directory_function_absent,
  position(
    '''market_directory'', true'
    in pg_get_functiondef(
      to_regprocedure('public.iq_v3_transfer_request_capabilities()')
    )
  ) = 0 as market_capability_absent,
  to_regclass('public.roster_transfer_requests') is not null
    as phase3d_table_present,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    as phase3d_request_present,
  to_regclass('public.roster_membership_stints') is not null
    as phase3c_stints_present,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (
    to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is null
    and position(
      '''market_directory'', true'
      in pg_get_functiondef(
        to_regprocedure('public.iq_v3_transfer_request_capabilities()')
      )
    ) = 0
    and to_regclass('public.roster_transfer_requests') is not null
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    and to_regclass('public.roster_membership_stints') is not null
  ) as phase3e_rollback_clean;
