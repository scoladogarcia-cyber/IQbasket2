-- IQBasket V34 · rollback
-- Intentionally non-destructive: Family Free billing subjects materialized for
-- verified Guardian links are retained so rollback cannot remove a child's
-- already-valid basic access. The old V8/V26 frontend boundaries remain usable.
begin;

drop function if exists public.iq_v34_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean);
drop function if exists public.iq_v34_family_claim_link(text);
drop function if exists public.iq_v34_family_bootstrap_free(uuid);
drop function if exists public.iq_v34_my_player_identity_preferences(uuid);
drop function if exists public.iq_v34_save_player_profile_config(text,uuid,boolean,boolean);
drop function if exists public.iq_v34_get_player_profile_config(text,uuid);

drop schema if exists iq_v34_private cascade;

-- Keep preference columns on rollback to preserve user/admin choices and allow a
-- later compatible redeploy. Audit rows are also retained for traceability.
commit;
