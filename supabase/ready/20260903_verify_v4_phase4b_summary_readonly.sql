-- =============================================================================
-- IQBasket v4 · Phase 4B Post-Apply Verification · READ ONLY
-- Date: 2026-09-03
-- =============================================================================

with integrity as (
  select
    (
      select count(*)
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          pgs.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_stats,
    (
      select count(*)
      from public.game_events ge
      join public.games g on g.id = ge.game_id
      where ge.player_id is not null
        and g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          ge.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_events
),
rls as (
  select
    count(*) filter (where c.relrowsecurity) as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'player360_activity_types',
      'training_sessions',
      'training_blocks',
      'training_participants',
      'external_development_sessions'
    )
),
policies as (
  select count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'player360_activity_types',
      'training_sessions',
      'training_blocks',
      'training_participants',
      'external_development_sessions'
    )
)
select
  'PLAYER360_PHASE4B_POST_APPLY' as section,
  to_regclass('public.player360_activity_types') is not null as activity_catalog_ok,
  to_regclass('public.training_sessions') is not null as training_sessions_ok,
  to_regclass('public.training_blocks') is not null as training_blocks_ok,
  to_regclass('public.training_participants') is not null as training_participants_ok,
  to_regclass('public.external_development_sessions') is not null as external_development_ok,
  to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is not null as view_helper_ok,
  to_regprocedure('public.iq_v4_can_manage_training(uuid)') is not null as manage_helper_ok,
  to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb)') is not null as create_training_rpc_ok,
  to_regprocedure('public.iq_v4_set_training_participant(uuid,uuid,text,integer,numeric,text)') is not null as participant_rpc_ok,
  to_regprocedure('public.iq_v4_archive_training_session(uuid)') is not null as archive_rpc_ok,
  to_regprocedure('public.iq_v4_create_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null as external_rpc_ok,
  to_regprocedure('public.iq_v4_training_capabilities()') is not null as capabilities_ok,
  r.rls_enabled,
  p.policy_count,
  (select count(*) from public.training_sessions) as training_sessions,
  (select count(*) from public.training_blocks) as training_blocks,
  (select count(*) from public.training_participants) as training_participants,
  (select count(*) from public.external_development_sessions) as external_development_sessions,
  (select count(*) from public.player360_activity_types) as activity_types,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regclass('public.player360_activity_types') is not null
    and to_regclass('public.training_sessions') is not null
    and to_regclass('public.training_blocks') is not null
    and to_regclass('public.training_participants') is not null
    and to_regclass('public.external_development_sessions') is not null
    and to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is not null
    and to_regprocedure('public.iq_v4_can_manage_training(uuid)') is not null
    and to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb)') is not null
    and to_regprocedure('public.iq_v4_create_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null
    and r.rls_enabled = 5
    and p.policy_count >= 20
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase4b_ok
from integrity i
cross join rls r
cross join policies p;
