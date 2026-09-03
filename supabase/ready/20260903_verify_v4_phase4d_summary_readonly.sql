-- =============================================================================
-- IQBasket v4 · Phase 4D Post-Apply Verification · READ ONLY
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
  select count(*) filter (where c.relrowsecurity) as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'player_longitudinal_snapshots',
      'player_ai_insights'
    )
),
policies as (
  select count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'player_longitudinal_snapshots',
      'player_ai_insights'
    )
)
select
  'PLAYER360_PHASE4D_POST_APPLY' as section,
  to_regclass('public.player_longitudinal_snapshots') is not null as snapshots_ok,
  to_regclass('public.player_ai_insights') is not null as insights_ok,
  to_regprocedure('public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])') is not null as action_role_helper_ok,
  to_regprocedure('public.iq_v4_can_view_longitudinal_analytics(uuid)') is not null as view_longitudinal_ok,
  to_regprocedure('public.iq_v4_can_generate_longitudinal_analytics(uuid)') is not null as generate_longitudinal_ok,
  to_regprocedure('public.iq_v4_can_view_ai_insights(uuid)') is not null as view_ai_ok,
  to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is not null as generate_ai_ok,
  to_regprocedure('public.iq_v4_can_review_ai_insights(uuid)') is not null as review_ai_ok,
  to_regprocedure('public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)') is not null as save_snapshot_ok,
  to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is not null as save_ai_ok,
  to_regprocedure('public.iq_v4_review_ai_insight(uuid,text,text)') is not null as review_ai_rpc_ok,
  to_regprocedure('public.iq_v4_longitudinal_capabilities()') is not null as capabilities_ok,
  r.rls_enabled,
  p.policy_count,
  has_table_privilege('authenticated','public.player_longitudinal_snapshots','SELECT') as snapshot_select_granted,
  has_table_privilege('authenticated','public.player_ai_insights','SELECT') as insight_select_granted,
  not has_table_privilege('authenticated','public.player_longitudinal_snapshots','INSERT') as direct_snapshot_insert_blocked,
  not has_table_privilege('authenticated','public.player_ai_insights','UPDATE') as direct_insight_update_blocked,
  not has_function_privilege(
    'authenticated',
    'public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])',
    'EXECUTE'
  ) as generic_action_helper_private,
  not has_function_privilege(
    'anon',
    'public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])',
    'EXECUTE'
  ) as generic_action_helper_anon_blocked,
  not has_function_privilege(
    'anon',
    'public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)',
    'EXECUTE'
  ) as anon_save_snapshot_blocked,
  not has_function_privilege(
    'anon',
    'public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)',
    'EXECUTE'
  ) as anon_save_ai_blocked,
  not has_function_privilege(
    'anon',
    'public.iq_v4_review_ai_insight(uuid,text,text)',
    'EXECUTE'
  ) as anon_review_ai_blocked,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_can_view_longitudinal_analytics(uuid)',
    'EXECUTE'
  ) as view_longitudinal_guard_executable,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_can_generate_longitudinal_analytics(uuid)',
    'EXECUTE'
  ) as generate_longitudinal_guard_executable,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_can_view_ai_insights(uuid)',
    'EXECUTE'
  ) as view_ai_guard_executable,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_can_generate_ai_insights(uuid)',
    'EXECUTE'
  ) as generate_ai_guard_executable,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_can_review_ai_insights(uuid)',
    'EXECUTE'
  ) as review_ai_guard_executable,
  (select count(*) from public.player_longitudinal_snapshots) as snapshot_rows,
  (select count(*) from public.player_ai_insights) as insight_rows,
  (select count(*) from public.player_evaluations) as evaluation_rows,
  (select count(*) from public.player360_evaluation_metrics) as evaluation_metric_rows,
  (select count(*) from public.training_sessions) as training_rows,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regclass('public.player_longitudinal_snapshots') is not null
    and to_regclass('public.player_ai_insights') is not null
    and to_regprocedure('public.iq_v4_can_view_longitudinal_analytics(uuid)') is not null
    and to_regprocedure('public.iq_v4_can_generate_longitudinal_analytics(uuid)') is not null
    and to_regprocedure('public.iq_v4_can_view_ai_insights(uuid)') is not null
    and to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is not null
    and to_regprocedure('public.iq_v4_can_review_ai_insights(uuid)') is not null
    and to_regprocedure('public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)') is not null
    and to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is not null
    and to_regprocedure('public.iq_v4_review_ai_insight(uuid,text,text)') is not null
    and r.rls_enabled = 2
    and p.policy_count >= 2
    and has_table_privilege('authenticated','public.player_longitudinal_snapshots','SELECT')
    and has_table_privilege('authenticated','public.player_ai_insights','SELECT')
    and not has_table_privilege('authenticated','public.player_longitudinal_snapshots','INSERT')
    and not has_table_privilege('authenticated','public.player_ai_insights','UPDATE')
    and not has_function_privilege(
      'authenticated',
      'public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.iq_v4_save_longitudinal_snapshot(uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.iq_v4_review_ai_insight(uuid,text,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.iq_v4_can_generate_longitudinal_analytics(uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.iq_v4_can_generate_ai_insights(uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.iq_v4_can_review_ai_insights(uuid)',
      'EXECUTE'
    )
    and (select count(*) from public.player_longitudinal_snapshots) = 0
    and (select count(*) from public.player_ai_insights) = 0
    and to_regclass('public.player_evaluations') is not null
    and to_regclass('public.training_sessions') is not null
    and to_regclass('public.roster_membership_stints') is not null
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase4d_ok
from integrity i
cross join rls r
cross join policies p;
