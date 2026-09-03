-- =============================================================================
-- IQBasket v4 · Phase 4C Installed Functional Smoke · FORCED ROLLBACK
-- Date: 2026-09-03
-- Uses installed Phase 4C objects and leaves no synthetic rows.
-- =============================================================================

begin;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', coalesce(up.email, ''),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $$
declare
  v_team_season_id uuid;
  v_player_id uuid;
  v_eval_date date;
  v_eval_1 uuid;
  v_eval_2 uuid;
  v_eval_key_1 uuid;
  v_eval_key_2 uuid;
  v_profile_1 uuid;
  v_profile_2 uuid;
  v_profile_key_1 uuid;
  v_profile_key_2 uuid;
  v_metric_count integer;
  v_score_count integer;
  v_target_count integer;
  v_gap_shoot numeric;
  v_gap_decision numeric;
  v_custom_metric uuid;
  v_old_status text;
  v_new_revision integer;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PHASE4C_REHEARSAL_AUTH_FAILED';
  end if;

  select
    rm.team_season_id,
    rm.player_id,
    greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
  into
    v_team_season_id,
    v_player_id,
    v_eval_date
  from public.roster_memberships rm
  join public.roster_membership_stints rs
    on rs.roster_membership_id = rm.id
  join public.team_seasons ts
    on ts.id = rm.team_season_id
  join public.season_catalog sc
    on sc.id = ts.season_id
  where rs.valid_until is null
    and greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
      <= coalesce(
        sc.end_date,
        greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
      )
  order by rs.valid_from desc, rm.id
  limit 1;

  if v_team_season_id is null or v_player_id is null or v_eval_date is null then
    raise exception 'PHASE4C_REHEARSAL_NO_ELIGIBLE_PLAYER';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_eval_date
  ) then
    raise exception 'PHASE4C_REHEARSAL_SELECTED_PLAYER_NOT_ELIGIBLE';
  end if;

  select count(*)
    into v_metric_count
  from public.iq_v4_list_evaluation_metrics(v_team_season_id);

  if v_metric_count < 15 then
    raise exception 'ASSERT_DEFAULT_METRICS_MISSING:%', v_metric_count;
  end if;

  v_custom_metric := public.iq_v4_upsert_evaluation_metric(
    v_team_season_id,
    'COMMUNICATION',
    'TACTICAL',
    'Comunicación',
    'Comunicación funcional en ataque y defensa.',
    0, 10, 0.5, true,
    'PRIVATE_SPORTING',
    true,
    160
  );

  if v_custom_metric is null then
    raise exception 'ASSERT_CUSTOM_METRIC_NOT_CREATED';
  end if;

  v_eval_1 := public.iq_v4_save_player_evaluation(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    'ZZ Phase4C rehearsal evaluation',
    'GENERAL',
    'CLUB_COACH',
    null,
    'Evaluación sintética de ensayo.',
    'Toma de decisiones.',
    'Mejorar consistencia de tiro.',
    true,
    false,
    jsonb_build_array(
      jsonb_build_object(
        'metric_code','SHOOTING',
        'score',6.5,
        'confidence',0.9,
        'notes','Rehearsal'
      ),
      jsonb_build_object(
        'metric_code','DECISION_MAKING',
        'score',7,
        'confidence',0.85
      ),
      jsonb_build_object(
        'metric_code','COMMUNICATION',
        'score',6
      )
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL'),
    '{}'::jsonb,
    null
  );

  select evaluation_key, revision
    into v_eval_key_1, v_new_revision
  from public.player_evaluations
  where id = v_eval_1;

  if v_eval_key_1 is null or v_new_revision <> 1 then
    raise exception 'ASSERT_EVALUATION_REVISION_1_FAILED';
  end if;

  select count(*)
    into v_score_count
  from public.player_evaluation_scores
  where evaluation_id = v_eval_1;

  if v_score_count <> 3 then
    raise exception 'ASSERT_EVALUATION_SCORE_COUNT:%', v_score_count;
  end if;

  v_eval_2 := public.iq_v4_save_player_evaluation(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    'ZZ Phase4C rehearsal evaluation revised',
    'GENERAL',
    'CLUB_COACH',
    null,
    'Segunda revisión sintética.',
    'Lectura del juego.',
    'Consolidar tiro y comunicación.',
    true,
    false,
    jsonb_build_array(
      jsonb_build_object('metric_code','SHOOTING','score',7),
      jsonb_build_object('metric_code','DECISION_MAKING','score',7.5),
      jsonb_build_object('metric_code','COMMUNICATION','score',6.5)
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL_REVISION'),
    '{}'::jsonb,
    v_eval_1
  );

  select status into v_old_status
  from public.player_evaluations
  where id = v_eval_1;

  select evaluation_key, revision
    into v_eval_key_2, v_new_revision
  from public.player_evaluations
  where id = v_eval_2;

  if v_old_status <> 'SUPERSEDED'
     or v_eval_key_2 <> v_eval_key_1
     or v_new_revision <> 2 then
    raise exception 'ASSERT_EVALUATION_REVISION_HISTORY_FAILED';
  end if;

  v_profile_1 := public.iq_v4_save_objective_profile(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    null,
    'ZZ Phase4C objective rehearsal',
    'Perfil sintético.',
    jsonb_build_array(
      jsonb_build_object('metric_code','SHOOTING','target_score',8.5,'priority_weight',2),
      jsonb_build_object('metric_code','DECISION_MAKING','target_score',8,'priority_weight',1.5),
      jsonb_build_object('metric_code','COMMUNICATION','target_score',7.5,'priority_weight',1)
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL'),
    '{}'::jsonb,
    null
  );

  select profile_key, revision
    into v_profile_key_1, v_new_revision
  from public.player_objective_profiles
  where id = v_profile_1;

  if v_profile_key_1 is null or v_new_revision <> 1 then
    raise exception 'ASSERT_OBJECTIVE_PROFILE_REVISION_1_FAILED';
  end if;

  select count(*)
    into v_target_count
  from public.player_objective_targets
  where profile_id = v_profile_1;

  if v_target_count <> 3 then
    raise exception 'ASSERT_OBJECTIVE_TARGET_COUNT:%', v_target_count;
  end if;

  select gap_to_target
    into v_gap_shoot
  from public.iq_v4_get_player_objective_gap(v_profile_1)
  where metric_code = 'SHOOTING';

  select gap_to_target
    into v_gap_decision
  from public.iq_v4_get_player_objective_gap(v_profile_1)
  where metric_code = 'DECISION_MAKING';

  if v_gap_shoot is distinct from 1.5
     or v_gap_decision is distinct from 0.5 then
    raise exception 'ASSERT_OBJECTIVE_GAP_FAILED: shooting=%, decision=%',
      v_gap_shoot, v_gap_decision;
  end if;

  v_profile_2 := public.iq_v4_save_objective_profile(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    null,
    'ZZ Phase4C objective rehearsal revised',
    'Segunda revisión sintética.',
    jsonb_build_array(
      jsonb_build_object('metric_code','SHOOTING','target_score',9,'priority_weight',2),
      jsonb_build_object('metric_code','DECISION_MAKING','target_score',8.5,'priority_weight',1.5),
      jsonb_build_object('metric_code','COMMUNICATION','target_score',8,'priority_weight',1)
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL_REVISION'),
    '{}'::jsonb,
    v_profile_1
  );

  select status into v_old_status
  from public.player_objective_profiles
  where id = v_profile_1;

  select profile_key, revision
    into v_profile_key_2, v_new_revision
  from public.player_objective_profiles
  where id = v_profile_2;

  if v_old_status <> 'SUPERSEDED'
     or v_profile_key_2 <> v_profile_key_1
     or v_new_revision <> 2 then
    raise exception 'ASSERT_OBJECTIVE_REVISION_HISTORY_FAILED';
  end if;

  begin
    insert into public.player_evaluations (
      team_season_id,
      player_id,
      evaluation_date,
      title,
      evaluation_type,
      source_type
    )
    values (
      v_team_season_id,
      v_player_id,
      v_eval_date,
      'ZZ SHOULD NOT INSERT',
      'GENERAL',
      'CLUB_COACH'
    );

    raise exception 'ASSERT_DIRECT_EVALUATION_WRITE_NOT_BLOCKED';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice
    'PLAYER360_PHASE4C_REHEARSAL_OK team_season=% player=% date=% eval_revision=% profile_revision=%',
    v_team_season_id,
    v_player_id,
    v_eval_date,
    v_eval_2,
    v_profile_2;
end $$;



reset role;
rollback;
