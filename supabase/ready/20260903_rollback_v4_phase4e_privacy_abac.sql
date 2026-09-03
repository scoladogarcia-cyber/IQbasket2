-- IQBasket Player 360 Phase 4E.1 rollback
-- Removes ONLY Phase 4E privacy/ABAC foundation objects.

begin;

drop function if exists public.iq_v4e_privacy_capabilities(uuid);
drop function if exists public.iq_v4e_revoke_sensitive_access_grant(uuid,text);
drop function if exists public.iq_v4e_grant_sensitive_access(uuid,uuid,uuid,text[],text[],text[],timestamptz,text,uuid);
drop function if exists public.iq_v4e_request_sensitive_access(uuid,uuid,text[],text[],text[],text);
drop function if exists public.iq_v4e_revoke_processing_authorization(uuid,text);
drop function if exists public.iq_v4e_record_processing_authorization(uuid,uuid,text[],text[],text,text,text,boolean,uuid,timestamptz,text);
drop function if exists public.iq_v4e_revoke_subject_relationship(uuid,uuid,text);
drop function if exists public.iq_v4e_record_subject_relationship(uuid,uuid,uuid,text,timestamptz,text);
drop function if exists public.iq_v4e_log_privacy_event(text,text,uuid,uuid,uuid,text,text,text,text,jsonb);
drop function if exists public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text);
drop function if exists public.iq_v4e_user_has_player_context(uuid,uuid,uuid);
drop function if exists public.iq_v4e_has_sensitive_grant(uuid,uuid,uuid,text,text,text);
drop function if exists public.iq_v4e_has_processing_authorization(uuid,uuid,text,text,text);
drop function if exists public.iq_v4e_subject_relation(uuid);
drop function if exists public.iq_v4e_can_request_sensitive_access(uuid);
drop function if exists public.iq_v4e_can_admin_privacy(uuid);

drop table if exists public.player360_privacy_audit_log;
drop table if exists public.player360_sensitive_access_grants;
drop table if exists public.player360_sensitive_access_requests;
drop table if exists public.player360_processing_authorizations;
drop table if exists public.player360_subject_relationships;

commit;

select
  'PLAYER360_PHASE4E_ROLLBACK' as section,
  to_regclass('public.player360_subject_relationships') is null as relationships_removed,
  to_regclass('public.player360_processing_authorizations') is null as authorizations_removed,
  to_regclass('public.player360_sensitive_access_requests') is null as requests_removed,
  to_regclass('public.player360_sensitive_access_grants') is null as grants_removed,
  to_regclass('public.player360_privacy_audit_log') is null as audit_removed,
  to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null as abac_removed;
