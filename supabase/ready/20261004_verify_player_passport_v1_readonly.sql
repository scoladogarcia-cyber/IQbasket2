-- Player Passport V1 verify (read-only)
select
  (select count(*) from public.player360_evaluation_metrics where team_season_id is null and code ~ '^(TEC|TAC|DEF|MEN|COL)-') as passport_metric_count,
  (select count(*) from public.player360_evaluation_rubrics r join public.player360_evaluation_metrics m on m.id=r.metric_definition_id where m.code ~ '^(TEC|TAC|DEF|MEN|COL)-' and r.rubric_version='1.0') as rubric_count,
  (select count(*) from public.player360_evaluation_rubric_anchors a join public.player360_evaluation_rubrics r on r.id=a.rubric_id join public.player360_evaluation_metrics m on m.id=r.metric_definition_id where m.code ~ '^(TEC|TAC|DEF|MEN|COL)-' and r.rubric_version='1.0') as anchor_count,
  exists(select 1 from public.saas_entitlement_catalog where code='PLAYER_PASSPORT' and is_active) as entitlement_ok,
  to_regprocedure('public.iq_v4_can_access_player_passport(uuid,uuid)') is not null as access_guard_ok,
  to_regprocedure('public.iq_v4_player_passport_snapshot(uuid,uuid)') is not null as snapshot_rpc_ok,
  to_regprocedure('public.iq_v4_save_player_passport_evaluation(uuid,uuid,date,text,text,jsonb,text,text,text,uuid)') is not null as save_rpc_ok,
  to_regclass('public.player360_measurements') is not null as measurements_ok;
