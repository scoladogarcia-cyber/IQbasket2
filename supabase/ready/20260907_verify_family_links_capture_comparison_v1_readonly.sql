-- IQBasket V30 verification · read only
select
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='family_player_link_invitations'
      and column_name='relationship_duration_code'
  ) as duration_column_ok,
  to_regprocedure('public.iq_v30_create_family_link_invitation(uuid,uuid,text,text,integer)') is not null as invite_rpc_ok,
  to_regprocedure('public.iq_v30_list_team_family_links(uuid)') is not null as list_links_rpc_ok,
  to_regprocedure('public.iq_v30_revoke_family_link(uuid,uuid,text)') is not null as revoke_link_rpc_ok,
  to_regprocedure('public.iq_v30_family_team_snapshot(uuid,uuid)') is not null as team_snapshot_rpc_ok,
  has_function_privilege('authenticated','public.iq_v30_create_family_link_invitation(uuid,uuid,text,text,integer)','EXECUTE') as auth_invite_ok,
  has_function_privilege('authenticated','public.iq_v30_family_team_snapshot(uuid,uuid)','EXECUTE') as auth_snapshot_ok,
  not has_function_privilege('anon','public.iq_v30_family_team_snapshot(uuid,uuid)','EXECUTE') as anon_snapshot_denied,
  exists (
    select 1 from pg_constraint
    where conrelid='public.game_capture_delegations'::regclass
      and conname='game_capture_delegation_capability_check'
      and pg_get_constraintdef(oid) ilike '%RECORD_QUICK_GAME%'
  ) as quick_capability_constraint_ok,
  pg_get_functiondef('iq_v21_private.grant_delegation(uuid,text,text[],timestamptz,timestamptz,text)'::regprocedure) ilike '%RECORD_QUICK_GAME%' as quick_grant_ok,
  pg_get_functiondef('iq_v21_private.has_capability(uuid,text)'::regprocedure) ilike '%RECORD_QUICK_GAME%' as quick_capture_bridge_ok,
  pg_get_functiondef('public.iq_v8_family_claim_link(text)'::regprocedure) ilike '%relationship_duration_code%' as claim_duration_ok,
  pg_get_functiondef('iq_v30_private.list_team_family_links(uuid)'::regprocedure) ilike '%roster_memberships%' as transfer_inheritance_ok,
  pg_get_functiondef('iq_v30_private.family_team_snapshot(uuid,uuid)'::regprocedure) ilike '%family_show_other_player_names%' as identity_mask_ok;
