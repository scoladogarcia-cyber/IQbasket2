-- Player 360 Phase 4E post-apply verifier. READ ONLY.

with objects as (
  select
    to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
    to_regclass('public.player360_processing_authorizations') is not null as authorizations_ok,
    to_regclass('public.player360_sensitive_access_requests') is not null as requests_ok,
    to_regclass('public.player360_sensitive_access_grants') is not null as grants_ok,
    to_regclass('public.player360_privacy_audit_log') is not null as audit_ok,
    to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is not null as admin_helper_ok,
    to_regprocedure('public.iq_v4e_can_request_sensitive_access(uuid)') is not null as request_helper_ok,
    to_regprocedure('public.iq_v4e_subject_relation(uuid)') is not null as relation_helper_ok,
    to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as abac_helper_ok,
    to_regprocedure('public.iq_v4e_privacy_capabilities(uuid)') is not null as capabilities_ok
),
rls as (
  select count(*) = 5 as rls_ok
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'player360_subject_relationships',
      'player360_processing_authorizations',
      'player360_sensitive_access_requests',
      'player360_sensitive_access_grants',
      'player360_privacy_audit_log'
    )
    and c.relrowsecurity
),
privileges as (
  select
    not has_table_privilege('authenticated','public.player360_subject_relationships','SELECT') as relationships_private,
    not has_table_privilege('authenticated','public.player360_processing_authorizations','SELECT') as authorizations_private,
    not has_table_privilege('authenticated','public.player360_sensitive_access_requests','SELECT') as requests_private,
    not has_table_privilege('authenticated','public.player360_sensitive_access_grants','SELECT') as grants_private,
    not has_table_privilege('authenticated','public.player360_privacy_audit_log','SELECT') as audit_private,
    not has_function_privilege(
      'authenticated',
      'public.iq_v4e_has_processing_authorization(uuid,uuid,text,text,text)',
      'EXECUTE'
    ) as processing_helper_private,
    not has_function_privilege(
      'authenticated',
      'public.iq_v4e_has_sensitive_grant(uuid,uuid,uuid,text,text,text)',
      'EXECUTE'
    ) as grant_helper_private,
    not has_function_privilege(
      'authenticated',
      'public.iq_v4e_log_privacy_event(text,text,uuid,uuid,uuid,text,text,text,text,jsonb)',
      'EXECUTE'
    ) as audit_writer_private,
    has_function_privilege(
      'authenticated',
      'public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)',
      'EXECUTE'
    ) as abac_callable,
    not has_function_privilege(
      'anon',
      'public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)',
      'EXECUTE'
    ) as anon_abac_blocked
),
rows as (
  select
    (select count(*) from public.player360_subject_relationships)=0 as relationships_empty,
    (select count(*) from public.player360_processing_authorizations)=0 as authorizations_empty,
    (select count(*) from public.player360_sensitive_access_requests)=0 as requests_empty,
    (select count(*) from public.player360_sensitive_access_grants)=0 as grants_empty,
    (select count(*) from public.player360_privacy_audit_log)=0 as audit_empty
),
legacy as (
  select
    to_regclass('public.player_longitudinal_snapshots') is not null as phase4d_snapshots_ok,
    to_regclass('public.player_ai_insights') is not null as phase4d_ai_ok,
    to_regclass('public.player_evaluations') is not null as phase4c_evaluations_ok,
    to_regclass('public.training_sessions') is not null as phase4b_training_ok,
    to_regclass('public.roster_membership_stints') is not null as v3_stints_ok
)
select
  'PLAYER360_PHASE4E_POST_APPLY' as section,
  o.*, r.rls_ok, p.*, x.*, l.*,
  (
    o.relationships_ok and o.authorizations_ok and o.requests_ok
    and o.grants_ok and o.audit_ok and o.admin_helper_ok and o.request_helper_ok
    and o.relation_helper_ok and o.abac_helper_ok and o.capabilities_ok
    and r.rls_ok
    and p.relationships_private and p.authorizations_private and p.requests_private
    and p.grants_private and p.audit_private
    and p.processing_helper_private and p.grant_helper_private and p.audit_writer_private
    and p.abac_callable and p.anon_abac_blocked
    and x.relationships_empty and x.authorizations_empty and x.requests_empty
    and x.grants_empty and x.audit_empty
    and l.phase4d_snapshots_ok and l.phase4d_ai_ok
    and l.phase4c_evaluations_ok and l.phase4b_training_ok and l.v3_stints_ok
  ) as phase4e_ok
from objects o cross join rls r cross join privileges p cross join rows x cross join legacy l;
