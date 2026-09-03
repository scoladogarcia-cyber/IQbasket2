-- Player 360 Phase 4E post-rollback verifier. READ ONLY.

select
  'PLAYER360_PHASE4E_POST_ROLLBACK' as section,
  to_regclass('public.player360_subject_relationships') is null as relationships_removed,
  to_regclass('public.player360_processing_authorizations') is null as authorizations_removed,
  to_regclass('public.player360_sensitive_access_requests') is null as requests_removed,
  to_regclass('public.player360_sensitive_access_grants') is null as grants_removed,
  to_regclass('public.player360_privacy_audit_log') is null as audit_removed,
  to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is null as admin_helper_removed,
  to_regprocedure('public.iq_v4e_can_request_sensitive_access(uuid)') is null as request_helper_removed,
  to_regprocedure('public.iq_v4e_subject_relation(uuid)') is null as relation_helper_removed,
  to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null as abac_removed,
  to_regclass('public.player_longitudinal_snapshots') is not null as phase4d_preserved,
  to_regclass('public.player_ai_insights') is not null as phase4d_ai_preserved,
  to_regclass('public.player_evaluations') is not null as phase4c_preserved,
  to_regclass('public.training_sessions') is not null as phase4b_preserved,
  (
    to_regclass('public.player360_subject_relationships') is null
    and to_regclass('public.player360_processing_authorizations') is null
    and to_regclass('public.player360_sensitive_access_requests') is null
    and to_regclass('public.player360_sensitive_access_grants') is null
    and to_regclass('public.player360_privacy_audit_log') is null
    and to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
    and to_regclass('public.player_longitudinal_snapshots') is not null
    and to_regclass('public.player_ai_insights') is not null
    and to_regclass('public.player_evaluations') is not null
    and to_regclass('public.training_sessions') is not null
  ) as phase4e_rollback_clean;
