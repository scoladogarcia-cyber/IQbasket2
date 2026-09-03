-- =============================================================================
-- IQBasket v4 · Phase 4B Post-Rehearsal Verification · READ ONLY
-- Date: 2026-09-03
-- =============================================================================

select
  'PLAYER360_PHASE4B_POST_ROLLBACK' as section,
  to_regclass('public.training_sessions') is null as training_sessions_absent,
  to_regclass('public.training_blocks') is null as training_blocks_absent,
  to_regclass('public.training_participants') is null as training_participants_absent,
  to_regclass('public.external_development_sessions') is null as external_development_absent,
  to_regclass('public.player360_activity_types') is null as activity_catalog_absent,
  to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null as manage_helper_absent,
  to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb)') is null as create_rpc_absent,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.roster_transfer_requests) as transfer_requests,
  (
    select count(*)
    from public.players p
    where p.first_name like 'ZZ_SMOKE%'
       or p.last_name = 'ZZ_SMOKE'
  ) as synthetic_players,
  (
    to_regclass('public.training_sessions') is null
    and to_regclass('public.training_blocks') is null
    and to_regclass('public.training_participants') is null
    and to_regclass('public.external_development_sessions') is null
    and to_regclass('public.player360_activity_types') is null
    and to_regprocedure('public.iq_v4_can_manage_training(uuid)') is null
    and to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb)') is null
  ) as phase4b_rollback_clean;
