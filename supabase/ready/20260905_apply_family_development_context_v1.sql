-- IQBasket Family Development Context V1
-- Safe family projection for deterministic weekly development plans.
begin;

insert into public.product_event_catalog(code,category,description)
values ('FAMILY_WEEKLY_PLAN_VIEWED','DEVELOPMENT','Deterministic family weekly development plan viewed')
on conflict (code) do update
set category=excluded.category,description=excluded.description,is_active=true;

create or replace function public.iq_v10_family_development_context(
  p_player_id uuid,
  p_team_season_id uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare
  v_team_season_id uuid:=p_team_season_id;
  v_internal_preview boolean:=false;
  v_gate jsonb;
  v_objective jsonb;
  v_training jsonb:='[]'::jsonb;
  v_external jsonb:='[]'::jsonb;
  v_games jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.family_can_view_player(auth.uid(),p_player_id) then
    raise exception 'FAMILY_PLAYER_ACCESS_DENIED' using errcode='42501';
  end if;
  v_internal_preview:=public.iq_v3_is_global_superadmin();

  if v_team_season_id is null then
    select rm.team_season_id into v_team_season_id
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    join public.seasons s on s.id=ts.season_id
    where rm.player_id=p_player_id
    order by coalesce(s.end_date,s.start_date) desc,rm.updated_at desc
    limit 1;
  end if;

  if v_team_season_id is null then
    return jsonb_build_object(
      'allowed',false,'reason_code','DEVELOPMENT_NO_SEASON_DATA',
      'player_id',p_player_id,'team_season_id',null,
      'objective',null,'recent_training','[]'::jsonb,
      'recent_external_development','[]'::jsonb,'recent_games','[]'::jsonb
    );
  end if;

  if not exists (
    select 1 from public.roster_memberships rm
    where rm.player_id=p_player_id and rm.team_season_id=v_team_season_id
  ) then
    raise exception 'FAMILY_DEVELOPMENT_SCOPE_INVALID' using errcode='42501';
  end if;

  v_gate:=public.iq_saas_entitlement_check(
    'PLAYER',p_player_id,v_team_season_id,'DEVELOPMENT_PLAN',1
  );
  if not v_internal_preview and not coalesce((v_gate->>'allowed')::boolean,false) then
    return jsonb_build_object(
      'allowed',false,'reason_code',coalesce(v_gate->>'reason_code','DEVELOPMENT_PLAN_NOT_INCLUDED'),
      'player_id',p_player_id,'team_season_id',v_team_season_id
    );
  end if;

  select jsonb_build_object(
    'id',op.id,'title',op.title,'effective_date',op.effective_date,
    'target_date',op.target_date,
    'targets',coalesce(tg.targets,'[]'::jsonb)
  ) into v_objective
  from public.player_objective_profiles op
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'metric_code',ot.metric_code,'domain_code',ot.domain_code,
      'metric_name',ot.metric_name,'target_score',ot.target_score,
      'priority_weight',ot.priority_weight,'higher_is_better',ot.higher_is_better
    ) order by ot.priority_weight desc,ot.metric_name) targets
    from public.player_objective_targets ot
    where ot.profile_id=op.id
  ) tg on true
  where op.player_id=p_player_id
    and op.team_season_id=v_team_season_id
    and op.status='ACTIVE'
  order by op.effective_date desc,op.created_at desc
  limit 1;

  select coalesce(jsonb_agg(x.item order by x.session_date desc),'[]'::jsonb)
    into v_training
  from (
    select ts.session_date,jsonb_build_object(
      'session_id',ts.id,'date',ts.session_date,'title',ts.title,
      'objective',ts.objective,'duration_minutes',ts.duration_minutes,
      'attendance_status',tp.attendance_status,
      'participated_minutes',tp.participated_minutes
    ) item
    from public.training_sessions ts
    join public.training_participants tp
      on tp.training_session_id=ts.id and tp.team_season_id=ts.team_season_id
    where ts.team_season_id=v_team_season_id
      and tp.player_id=p_player_id
      and ts.status<>'ARCHIVED'
      and ts.session_date<=current_date
    order by ts.session_date desc,ts.created_at desc
    limit 8
  ) x;

  select coalesce(jsonb_agg(x.item order by x.activity_date desc),'[]'::jsonb)
    into v_external
  from (
    select ed.activity_date,jsonb_build_object(
      'session_id',ed.id,'date',ed.activity_date,'title',ed.title,
      'activity_code',ed.activity_code,'provider_type',ed.provider_type,
      'objective',ed.objective,'duration_minutes',ed.duration_minutes
    ) item
    from public.external_development_sessions ed
    where ed.team_season_id=v_team_season_id
      and ed.player_id=p_player_id
      and ed.activity_date<=current_date
    order by ed.activity_date desc,ed.created_at desc
    limit 8
  ) x;

  select coalesce(jsonb_agg(x.item order by x.game_date desc),'[]'::jsonb)
    into v_games
  from (
    select coalesce(g.game_date,g.date) game_date,jsonb_build_object(
      'game_id',g.id,'date',coalesce(g.game_date,g.date),'opponent',g.opponent,
      'minutes',coalesce(pgs.minutes,0),'points',coalesce(pgs.points,0),
      'rebounds',coalesce(pgs.off_reb,pgs.rebounds_offensive,0)+coalesce(pgs.def_reb,pgs.rebounds_defensive,0),
      'assists',coalesce(pgs.assists,0),'steals',coalesce(pgs.steals,0),
      'turnovers',coalesce(pgs.turnovers,0)
    ) item
    from public.player_game_stats pgs
    join public.games g on g.id=pgs.game_id
    where pgs.player_id=p_player_id
      and g.team_season_id=v_team_season_id
    order by coalesce(g.game_date,g.date) desc nulls last,g.created_at desc
    limit 5
  ) x;

  return jsonb_build_object(
    'allowed',true,
    'reason_code',case when v_internal_preview then 'INTERNAL_PREVIEW' else 'ENTITLED' end,
    'player_id',p_player_id,'team_season_id',v_team_season_id,
    'objective',v_objective,
    'recent_training',v_training,
    'recent_external_development',v_external,
    'recent_games',v_games,
    'privacy',jsonb_build_object(
      'excluded_fields',jsonb_build_array('rpe','internal_load','notes','provenance','metadata'),
      'excluded_modules',jsonb_build_array('nutrition','recovery','neuro_cognitive')
    )
  );
end;
$function$;

revoke all on function public.iq_v10_family_development_context(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.iq_v10_family_development_context(uuid,uuid)
  to authenticated;

do $v10$
begin
  if has_function_privilege(
    'anon','public.iq_v10_family_development_context(uuid,uuid)','EXECUTE'
  ) then raise exception 'FAMILY_DEVELOPMENT_V1_ANON_RPC_OPEN'; end if;

  if not has_function_privilege(
    'authenticated','public.iq_v10_family_development_context(uuid,uuid)','EXECUTE'
  ) then raise exception 'FAMILY_DEVELOPMENT_V1_AUTH_RPC_CLOSED'; end if;

  if not exists (
    select 1 from public.product_event_catalog
    where code='FAMILY_WEEKLY_PLAN_VIEWED' and is_active
  ) then raise exception 'FAMILY_DEVELOPMENT_V1_EVENT_MISSING'; end if;
end
$v10$;

commit;

select
  'FAMILY_DEVELOPMENT_CONTEXT_V1_APPLY' as section,
  to_regprocedure('public.iq_v10_family_development_context(uuid,uuid)') is not null as context_ok,
  exists(select 1 from public.product_event_catalog where code='FAMILY_WEEKLY_PLAN_VIEWED') as event_ok;
