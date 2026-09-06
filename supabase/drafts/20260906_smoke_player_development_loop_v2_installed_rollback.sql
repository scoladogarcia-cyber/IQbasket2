-- IQBasket · Player Development Loop V2 · installed smoke · forced rollback
begin;

select set_config('iqbasket.smoke.team_season_id', q.team_season_id::text, true),
       set_config('iqbasket.smoke.player_id', q.player_id::text, true),
       set_config('iqbasket.smoke.objective_id', q.objective_id::text, true),
       set_config('iqbasket.smoke.metric_code', q.metric_code, true),
       set_config('iqbasket.smoke.game_id', q.game_id::text, true)
from (
  select op.team_season_id, op.player_id, op.id objective_id,
         ot.metric_code, g.id game_id
  from public.player_objective_profiles op
  join public.team_seasons ts on ts.id=op.team_season_id
  join public.player_objective_targets ot on ot.profile_id=op.id
  join public.player_game_stats pgs on pgs.player_id=op.player_id
  join public.games g on g.id=pgs.game_id and g.team_season_id=op.team_season_id
  where op.status='ACTIVE'
    and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    and exists(select 1 from public.roster_memberships rm where rm.team_season_id=op.team_season_id and rm.player_id=op.player_id)
  order by ot.priority_weight desc, coalesce(g.game_date,g.date) desc nulls last
  limit 1
) q;

do $v2_context$
begin
  if current_setting('iqbasket.smoke.team_season_id', true) is null
     or current_setting('iqbasket.smoke.player_id', true) is null
     or current_setting('iqbasket.smoke.objective_id', true) is null
     or current_setting('iqbasket.smoke.metric_code', true) is null
     or current_setting('iqbasket.smoke.game_id', true) is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_NO_CONTEXT';
  end if;
end
$v2_context$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', coalesce(up.email,''),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role,up.role,'USER'))='SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $v2_smoke$
declare
  v_team_season_id uuid:=current_setting('iqbasket.smoke.team_season_id')::uuid;
  v_player_id uuid:=current_setting('iqbasket.smoke.player_id')::uuid;
  v_objective_id uuid:=current_setting('iqbasket.smoke.objective_id')::uuid;
  v_metric_code text:=current_setting('iqbasket.smoke.metric_code');
  v_game_id uuid:=current_setting('iqbasket.smoke.game_id')::uuid;
  v_cycle_id uuid;
  v_action_id uuid;
  v_snapshot jsonb;
  v_evidence_id uuid;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_AUTH_FAILED';
  end if;

  v_cycle_id:=public.iq_v16_start_development_cycle(
    v_team_season_id,v_player_id,v_objective_id,
    jsonb_build_array(jsonb_build_object(
      'action_type','GAME','metric_code',v_metric_code,
      'title','ZZ V2 smoke · observar foco en partido',
      'success_criterion','Vincular una evidencia real y cerrar la revisión semanal.'
    ))
  );

  v_snapshot:=public.iq_v16_development_cycle_snapshot(v_team_season_id,v_player_id);
  if v_snapshot->'current_cycle'->>'id' is distinct from v_cycle_id::text then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_CYCLE_NOT_VISIBLE';
  end if;
  if (v_snapshot->'current_cycle'->>'objective_profile_id')::uuid is distinct from v_objective_id then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_OBJECTIVE_NOT_FROZEN';
  end if;

  v_action_id:=(v_snapshot->'current_cycle'->'actions'->0->>'id')::uuid;
  if v_action_id is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_ACTION_MISSING';
  end if;

  v_evidence_id:=public.iq_v16_link_development_evidence(
    v_action_id,'GAME',v_game_id,'ZZ V2 smoke evidence'
  );
  if v_evidence_id is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_EVIDENCE_NOT_LINKED';
  end if;

  perform public.iq_v16_set_development_action_state(
    v_action_id,'COMPLETED','ZZ V2 smoke completed'
  );

  v_snapshot:=public.iq_v16_development_cycle_snapshot(v_team_season_id,v_player_id);
  if v_snapshot->'current_cycle'->>'status' is distinct from 'REVIEW_DUE' then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_REVIEW_NOT_DUE';
  end if;
  if jsonb_array_length(v_snapshot->'current_cycle'->'actions'->0->'evidence') <> 1 then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_EVIDENCE_COUNT_INVALID';
  end if;

  perform public.iq_v16_review_development_cycle(
    v_cycle_id,'CONTINUE','ZZ V2 smoke review'
  );
  v_snapshot:=public.iq_v16_development_cycle_snapshot(v_team_season_id,v_player_id);
  if v_snapshot->'current_cycle'->>'status' is distinct from 'COMPLETED'
     or v_snapshot->'current_cycle'->>'review_outcome' is distinct from 'CONTINUE' then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_SMOKE_REVIEW_INVALID';
  end if;

  begin
    perform count(*) from public.player_development_cycles;
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_DIRECT_READ_NOT_BLOCKED';
  exception
    when insufficient_privilege then null;
  end;

  raise notice 'PLAYER_DEVELOPMENT_LOOP_V2_INSTALLED_SMOKE_OK cycle=% action=% evidence=%',
    v_cycle_id,v_action_id,v_evidence_id;
end
$v2_smoke$;

reset role;
rollback;

select
  'PLAYER_DEVELOPMENT_LOOP_V2_INSTALLED_SMOKE_ROLLBACK' as section,
  to_regclass('public.player_development_cycles') is not null as installed_ok,
  true as phase_ok;
