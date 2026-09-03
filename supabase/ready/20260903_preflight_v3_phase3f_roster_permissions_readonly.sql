-- =============================================================================
-- IQBasket v3 · PHASE 3F PREFLIGHT · ROSTER ACTION PERMISSIONS · READ ONLY
-- Date: 2026-09-03
-- =============================================================================

with defs as (
  select
    pg_get_functiondef(to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)')) as seed_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)')) as set_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)')) as remove_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)')) as create_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_can_request_transfer(uuid)')) as request_def
)
select
  'PHASE3F_PREFLIGHT' as section,
  to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null as general_manage_helper_ok,
  to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null as roster_helper_absent,
  position('iq_v3_can_manage_team_season(p_team_season_id)' in seed_def) > 0 as seed_uses_general_helper,
  position('iq_v3_can_manage_team_season(p_team_season_id)' in set_def) > 0 as set_uses_general_helper,
  position('iq_v3_can_manage_team_season(p_team_season_id)' in remove_def) > 0 as remove_uses_general_helper,
  position('iq_v3_can_manage_team_season(p_team_season_id)' in create_def) > 0 as create_uses_general_helper,
  position('iq_v3_can_manage_team_season(p_to_team_season_id)' in request_def) > 0 as request_uses_general_helper,
  (select count(*) from public.user_profiles
   where upper(coalesce(global_role, role, 'USER')) <> 'SUPERADMIN') as non_superadmin_profiles,
  (select count(*) from public.team_seasons) as team_seasons,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (
    to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null
    and to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null
    and position('iq_v3_can_manage_team_season(p_team_season_id)' in seed_def) > 0
    and position('iq_v3_can_manage_team_season(p_team_season_id)' in set_def) > 0
    and position('iq_v3_can_manage_team_season(p_team_season_id)' in remove_def) > 0
    and position('iq_v3_can_manage_team_season(p_team_season_id)' in create_def) > 0
    and position('iq_v3_can_manage_team_season(p_to_team_season_id)' in request_def) > 0
    and (select count(*) from public.user_profiles
         where upper(coalesce(global_role, role, 'USER')) <> 'SUPERADMIN') > 0
    and (select count(*) from public.team_seasons) > 0
  ) as safe_to_rehearse_phase3f
from defs;
