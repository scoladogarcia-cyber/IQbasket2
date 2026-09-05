-- IQBasket Family Workspace Priority 1 V1 rollback.
-- Refuses to remove the feature after real invitation data exists.
begin;

do $v8$
begin
  if to_regclass('public.family_player_link_invitations') is not null
     and exists(select 1 from public.family_player_link_invitations) then
    raise exception 'FAMILY_WORKSPACE_V1_ROLLBACK_REFUSED_INVITATION_DATA_EXISTS';
  end if;
end
$v8$;

drop function if exists public.iq_v8_family_player360_snapshot(uuid,uuid);
drop function if exists public.iq_v8_family_player_passport(uuid);
drop function if exists public.iq_v8_family_product_snapshot(uuid);
drop function if exists public.iq_v8_family_revoke_own_link(uuid,text);
drop function if exists public.iq_v8_family_bootstrap_free(uuid);
drop function if exists public.iq_v8_family_claim_link(text);
drop function if exists public.iq_v8_family_create_link_invitation(uuid,uuid,text,integer);
drop function if exists public.iq_v8_family_list_players();

drop function if exists iq_private.family_bootstrap_free_account(uuid,uuid);
drop function if exists iq_private.family_can_view_player(uuid,uuid);
drop function if exists iq_private.family_has_active_relation(uuid,uuid);

drop table if exists public.family_player_link_invitations cascade;
drop index if exists public.saas_family_active_owner_uq;

commit;
