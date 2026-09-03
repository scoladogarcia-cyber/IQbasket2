-- Player 360 Phase 4E.2 Nutrition/Recovery preflight
-- READ ONLY. Expects Phase 4E.1 privacy/ABAC already installed.

with prerequisites as (
  select
    to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
    to_regclass('public.player360_processing_authorizations') is not null as authorizations_ok,
    to_regclass('public.player360_sensitive_access_grants') is not null as grants_ok,
    to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as abac_ok,
    to_regprocedure('public.iq_v4e_subject_relation(uuid)') is not null as relation_ok,
    to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null as eligibility_ok,
    to_regprocedure('public.iq_v4_touch_updated_at()') is not null as touch_ok,
    to_regclass('public.user_profiles') is not null as users_ok,
    to_regclass('public.players') is not null as players_ok,
    to_regclass('public.team_seasons') is not null as team_seasons_ok
),
future_objects as (
  select
    to_regclass('public.player360_wellness_metric_catalog') is not null as metric_catalog_exists,
    to_regclass('public.player360_wellness_entries') is not null as entries_exists,
    to_regclass('public.player360_wellness_observations') is not null as observations_exists,
    to_regprocedure('public.iq_v4e2_wellness_capabilities(uuid,uuid,text,text)') is not null as capabilities_exists,
    to_regprocedure('public.iq_v4e2_list_wellness_metric_catalog(uuid,text)') is not null as metric_list_exists,
    to_regprocedure('public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,timestamptz,timestamptz,integer)') is not null as entry_list_exists,
    to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,timestamptz,text,jsonb)') is not null as save_exists,
    to_regprocedure('public.iq_v4e2_archive_wellness_entry(uuid,text)') is not null as archive_exists
)
select
  'PLAYER360_PHASE4E2_PREFLIGHT' as section,
  p.*,
  f.*,
  (
    p.relationships_ok
    and p.authorizations_ok
    and p.grants_ok
    and p.abac_ok
    and p.relation_ok
    and p.eligibility_ok
    and p.touch_ok
    and p.users_ok
    and p.players_ok
    and p.team_seasons_ok
    and not f.metric_catalog_exists
    and not f.entries_exists
    and not f.observations_exists
    and not f.capabilities_exists
    and not f.metric_list_exists
    and not f.entry_list_exists
    and not f.save_exists
    and not f.archive_exists
  ) as phase4e2_preflight_ok
from prerequisites p cross join future_objects f;
