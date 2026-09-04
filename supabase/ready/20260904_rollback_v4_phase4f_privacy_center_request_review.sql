-- IQBasket v4 · Phase 4F · Privacy Center request review rollback
begin;
drop function if exists public.iq_v4f_reject_sensitive_access_request(uuid,text);
commit;
