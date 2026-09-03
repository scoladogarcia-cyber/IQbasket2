-- =============================================================================
-- IQBasket v3 · PHASE 3F POST-ROLLBACK VERIFICATION · READ ONLY
-- Date: 2026-09-03
-- =============================================================================
with defs as (
  select
    pg_get_functiondef(to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)')) as create_def,
    pg_get_functiondef(to_regprocedure('public.iq_v3_can_request_transfer(uuid)')) as request_def
)
select
  'PHASE3F_POST_ROLLBACK' as section,
  to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null as roster_helper_absent,
  position('iq_v3_can_manage_team_season(p_team_season_id)' in create_def) > 0 as roster_rpc_restored,
  position('iq_v3_can_manage_team_season(p_to_team_season_id)' in request_def) > 0 as request_helper_restored,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.roster_transfer_requests) as transfer_requests,
  (
    to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null
    and position('iq_v3_can_manage_team_season(p_team_season_id)' in create_def) > 0
    and position('iq_v3_can_manage_team_season(p_to_team_season_id)' in request_def) > 0
  ) as phase3f_rollback_clean
from defs;
