-- =============================================================================
-- IQBasket v4 · Phase 4C Post-Apply Verification · READ ONLY
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
      'player360_evaluation_metrics',
      'player_evaluations',
      'player_evaluation_scores',
      'player_objective_profiles',
      'player_objective_targets'
    )
),
policies as (
  select count(*) as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'player360_evaluation_metrics',
      'player_evaluations',
      'player_evaluation_scores',
      'player_objective_profiles',
      'player_objective_targets'
    )
)
select
  'PLAYER360_PHASE4C_POST_APPLY' as section,
  to_regclass('public.player360_evaluation_metrics') is not null as metrics_ok,
  to_regclass('public.player_evaluations') is not null as evaluations_ok,
  to_regclass('public.player_evaluation_scores') is not null as scores_ok,
  to_regclass('public.player_objective_profiles') is not null as profiles_ok,
  to_regclass('public.player_objective_targets') is not null as targets_ok,
  to_regprocedure('public.iq_v4_can_manage_evaluation(uuid)') is not null as manage_eval_ok,
  to_regprocedure('public.iq_v4_can_view_private_evaluation(uuid)') is not null as private_eval_ok,
  to_regprocedure('public.iq_v4_can_manage_objective_profile(uuid)') is not null as manage_objective_ok,
  to_regprocedure('public.iq_v4_list_evaluation_metrics(uuid)') is not null as list_metrics_ok,
  to_regprocedure('public.iq_v4_save_player_evaluation(uuid,uuid,date,text,text,text,text,text,text,text,boolean,boolean,jsonb,jsonb,jsonb,uuid)') is not null as save_eval_ok,
  to_regprocedure('public.iq_v4_save_objective_profile(uuid,uuid,date,date,text,text,jsonb,jsonb,jsonb,uuid)') is not null as save_objective_ok,
  to_regprocedure('public.iq_v4_get_player_objective_gap(uuid)') is not null as gap_ok,
  to_regprocedure('public.iq_v4_evaluation_capabilities()') is not null as capabilities_ok,
  r.rls_enabled,
  p.policy_count,
  not has_table_privilege('authenticated','public.player_evaluations','INSERT') as direct_eval_insert_blocked,
  not has_table_privilege('authenticated','public.player_objective_profiles','UPDATE') as direct_objective_update_blocked,
  (select count(*) from public.player360_evaluation_metrics) as metric_rows,
  (select count(*) from public.player_evaluations) as evaluation_rows,
  (select count(*) from public.player_evaluation_scores) as score_rows,
  (select count(*) from public.player_objective_profiles) as profile_rows,
  (select count(*) from public.player_objective_targets) as target_rows,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  i.invalid_stats,
  i.invalid_events,
  (
    to_regclass('public.player360_evaluation_metrics') is not null
    and to_regclass('public.player_evaluations') is not null
    and to_regclass('public.player_evaluation_scores') is not null
    and to_regclass('public.player_objective_profiles') is not null
    and to_regclass('public.player_objective_targets') is not null
    and to_regprocedure('public.iq_v4_save_player_evaluation(uuid,uuid,date,text,text,text,text,text,text,text,boolean,boolean,jsonb,jsonb,jsonb,uuid)') is not null
    and to_regprocedure('public.iq_v4_save_objective_profile(uuid,uuid,date,date,text,text,jsonb,jsonb,jsonb,uuid)') is not null
    and to_regprocedure('public.iq_v4_get_player_objective_gap(uuid)') is not null
    and r.rls_enabled = 5
    and p.policy_count >= 5
    and not has_table_privilege('authenticated','public.player_evaluations','INSERT')
    and not has_table_privilege('authenticated','public.player_objective_profiles','UPDATE')
    and (select count(*) from public.player360_evaluation_metrics) = 15
    and (select count(*) from public.player_evaluations) = 0
    and (select count(*) from public.player_evaluation_scores) = 0
    and (select count(*) from public.player_objective_profiles) = 0
    and (select count(*) from public.player_objective_targets) = 0
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as phase4c_ok
from integrity i
cross join rls r
cross join policies p;
