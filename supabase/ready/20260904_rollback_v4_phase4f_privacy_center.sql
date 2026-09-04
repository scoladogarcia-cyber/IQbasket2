-- IQBasket v4 · Phase 4F · Privacy Center rollback
begin;

drop function if exists public.iq_v4f_list_privacy_audit(uuid,uuid,integer);
drop function if exists public.iq_v4f_list_sensitive_access(uuid,uuid);
drop function if exists public.iq_v4f_list_privacy_authorizations(uuid,uuid);
drop function if exists public.iq_v4f_privacy_center_snapshot(uuid,uuid);

commit;
