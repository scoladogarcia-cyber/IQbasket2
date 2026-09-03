-- Player 360 Phase 4E.2 post-rollback verifier. READ ONLY.

select
  'PLAYER360_PHASE4E2_POST_ROLLBACK' as section,
  to_regclass('public.player360_wellness_metric_catalog') is null as metric_catalog_removed,
  to_regclass('public.player360_wellness_entries') is null as entries_removed,
  to_regclass('public.player360_wellness_observations') is null as observations_removed,
  to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null as save_removed,
  to_regclass('public.player360_processing_authorizations') is not null as phase4e_auth_preserved,
  to_regclass('public.player360_sensitive_access_grants') is not null as phase4e_grants_preserved,
  to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as phase4e_abac_preserved,
  (
    to_regclass('public.player360_wellness_metric_catalog') is null
    and to_regclass('public.player360_wellness_entries') is null
    and to_regclass('public.player360_wellness_observations') is null
    and to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null
    and to_regclass('public.player360_processing_authorizations') is not null
    and to_regclass('public.player360_sensitive_access_grants') is not null
    and to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null
  ) as phase4e2_rollback_clean;
