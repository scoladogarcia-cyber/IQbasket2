-- IQBasket V29 · read-only preflight
select
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regclass('public.roster_memberships') is not null as roster_memberships_ok,
  to_regclass('public.family_player_link_invitations') is not null as family_invitations_ok,
  to_regclass('public.user_profiles') is not null as user_profiles_ok,
  to_regprocedure('public.iq_account_is_active()') is not null as account_guard_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_guard_ok,
  to_regprocedure('public.iq_v6_role_for_team_season(uuid)') is not null as team_season_role_ok,
  to_regprocedure('iq_private.v26_can_manage_family_profile(uuid)') is not null as v26_admin_guard_ok,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is not null as claim_link_ok,
  to_regprocedure('public.iq_v4e_log_privacy_event(text,text,uuid,uuid,uuid,text,text,text,text,jsonb)') is not null as privacy_audit_ok,
  to_regprocedure('extensions.digest(text,text)') is not null as digest_ok,
  to_regprocedure('iq_private.game_legacy_status_for_play_state(text)') is not null as legacy_status_bridge_ok,
  to_regprocedure('public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)') is null as v29_invite_absent,
  to_regprocedure('public.iq_v29_find_family_profile(uuid,text)') is null as v29_lookup_absent;
