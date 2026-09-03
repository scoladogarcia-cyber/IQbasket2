-- Player 360 Phase 4E Privacy/ABAC preflight
-- READ ONLY. Safe to run repeatedly.

with prerequisites as (
  select
    to_regclass('public.user_profiles') is not null as user_profiles_ok,
    to_regclass('public.players') is not null as players_ok,
    to_regclass('public.team_seasons') is not null as team_seasons_ok,
    to_regclass('public.roster_memberships') is not null as roster_memberships_ok,
    to_regclass('public.team_season_memberships') is not null as team_memberships_ok,
    to_regclass('public.club_season_memberships') is not null as club_memberships_ok,
    to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_helper_ok,
    to_regprocedure('public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])') is not null as action_role_helper_ok,
    to_regprocedure('public.iq_v4_touch_updated_at()') is not null as touch_helper_ok,
    exists (
      select 1
      from information_schema.columns
      where table_schema='public'
        and table_name='user_profiles'
        and column_name='linked_player_id'
    ) as linked_player_column_ok
),
future_objects as (
  select
    to_regclass('public.player360_subject_relationships') is not null as relationships_exists,
    to_regclass('public.player360_processing_authorizations') is not null as authorizations_exists,
    to_regclass('public.player360_sensitive_access_requests') is not null as requests_exists,
    to_regclass('public.player360_sensitive_access_grants') is not null as grants_exists,
    to_regclass('public.player360_privacy_audit_log') is not null as audit_exists,
    to_regprocedure('public.iq_v4e_can_admin_privacy(uuid)') is not null as admin_helper_exists,
    to_regprocedure('public.iq_v4e_can_request_sensitive_access(uuid)') is not null as request_helper_exists,
    to_regprocedure('public.iq_v4e_subject_relation(uuid)') is not null as relation_helper_exists,
    to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as abac_helper_exists
)
select
  'PLAYER360_PHASE4E_PREFLIGHT' as section,
  p.*,
  f.*,
  (
    p.user_profiles_ok
    and p.players_ok
    and p.team_seasons_ok
    and p.roster_memberships_ok
    and p.team_memberships_ok
    and p.club_memberships_ok
    and p.superadmin_helper_ok
    and p.action_role_helper_ok
    and p.touch_helper_ok
    and p.linked_player_column_ok
    and not f.relationships_exists
    and not f.authorizations_exists
    and not f.requests_exists
    and not f.grants_exists
    and not f.audit_exists
    and not f.admin_helper_exists
    and not f.request_helper_exists
    and not f.relation_helper_exists
    and not f.abac_helper_exists
  ) as phase4e_preflight_ok
from prerequisites p cross join future_objects f;
