-- Read-only preflight: family-first SaaS entitlement foundation.
select
  to_regclass('public.user_profiles') is not null as user_profiles_ok,
  to_regclass('public.players') is not null as players_ok,
  to_regclass('public.teams') is not null as teams_ok,
  to_regclass('public.clubs') is not null as clubs_ok,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regclass('public.user_player_links') is not null as user_player_links_ok,
  to_regclass('public.player360_subject_relationships') is not null as subject_relationships_ok,
  to_regclass('public.user_account_controls') is not null as account_controls_ok,
  to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_helper_ok,
  to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is not null as participation_helper_ok,
  to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is not null as player360_helper_ok,
  to_regprocedure('public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])') is not null as action_role_helper_ok,
  to_regprocedure('public.iq_v5_can_access_team(uuid)') is not null as team_access_helper_ok,
  to_regprocedure('public.iq_account_is_active()') is not null as account_public_helper_ok,
  to_regprocedure('iq_private.account_is_active(uuid)') is not null as account_private_helper_ok;
