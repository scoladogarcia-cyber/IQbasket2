-- IQBasket V30 preflight · read only
select
  to_regclass('public.family_player_link_invitations') is not null as invitations_ok,
  to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
  to_regclass('public.game_capture_delegations') is not null as delegations_ok,
  to_regprocedure('public.iq_v29_create_family_link_invitation(uuid,uuid,text,text,integer)') is null as v29_old_signature_expected,
  to_regprocedure('public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)') is not null as v29_invite_ok,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is not null as claim_ok,
  to_regprocedure('iq_v21_private.has_capability(uuid,text)') is not null as delegation_capability_ok,
  to_regprocedure('iq_v21_private.grant_delegation(uuid,text,text[],timestamptz,timestamptz,text)') is not null as delegation_grant_ok,
  to_regprocedure('public.iq_v30_create_family_link_invitation(uuid,uuid,text,text,integer)') is null as v30_invite_absent,
  to_regprocedure('public.iq_v30_family_team_snapshot(uuid,uuid)') is null as v30_snapshot_absent,
  to_regprocedure('public.iq_v30_list_team_family_links(uuid)') is null as v30_links_absent,
  to_regprocedure('public.iq_v30_revoke_family_link(uuid,uuid,text)') is null as v30_revoke_absent,
  not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='family_player_link_invitations'
      and column_name='relationship_duration_code'
  ) as duration_column_absent;
