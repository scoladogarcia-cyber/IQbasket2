-- Read-only verification for Family Workspace Priority 1 V1.
select
  to_regclass('public.family_player_link_invitations') is not null as invitations_ok,
  to_regprocedure('public.iq_v8_family_list_players()') is not null as list_ok,
  to_regprocedure('public.iq_v8_family_create_link_invitation(uuid,uuid,text,integer)') is not null as invite_ok,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is not null as claim_ok,
  to_regprocedure('public.iq_v8_family_bootstrap_free(uuid)') is not null as bootstrap_ok,
  to_regprocedure('public.iq_v8_family_revoke_own_link(uuid,text)') is not null as revoke_ok,
  to_regprocedure('public.iq_v8_family_product_snapshot(uuid)') is not null as product_ok,
  to_regprocedure('public.iq_v8_family_player_passport(uuid)') is not null as passport_ok,
  to_regprocedure('public.iq_v8_family_player360_snapshot(uuid,uuid)') is not null as player360_ok;

select c.relrowsecurity as invitations_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='family_player_link_invitations';

select
  has_table_privilege('authenticated','public.family_player_link_invitations','SELECT') as auth_select,
  has_table_privilege('authenticated','public.family_player_link_invitations','INSERT') as auth_insert,
  has_table_privilege('authenticated','public.family_player_link_invitations','UPDATE') as auth_update,
  has_table_privilege('authenticated','public.family_player_link_invitations','DELETE') as auth_delete;

select
  has_function_privilege('authenticated','public.iq_v8_family_list_players()','EXECUTE') as list_auth,
  has_function_privilege('authenticated','public.iq_v8_family_claim_link(text)','EXECUTE') as claim_auth,
  has_function_privilege('authenticated','public.iq_v8_family_player_passport(uuid)','EXECUTE') as passport_auth,
  has_function_privilege('authenticated','public.iq_v8_family_player360_snapshot(uuid,uuid)','EXECUTE') as player360_auth,
  has_function_privilege('anon','public.iq_v8_family_list_players()','EXECUTE') as list_anon,
  has_function_privilege('anon','public.iq_v8_family_claim_link(text)','EXECUTE') as claim_anon;

select
  has_function_privilege('authenticated','iq_private.family_has_active_relation(uuid,uuid)','EXECUTE') as relation_helper_open,
  has_function_privilege('authenticated','iq_private.family_can_view_player(uuid,uuid)','EXECUTE') as access_helper_open,
  has_function_privilege('authenticated','iq_private.family_bootstrap_free_account(uuid,uuid)','EXECUTE') as bootstrap_helper_open;

select count(*) as migration_created_invitations
from public.family_player_link_invitations;
