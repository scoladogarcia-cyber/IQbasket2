-- IQBasket Core UX Completion · functional transaction · always rollback
begin;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',up.id::text,
    'email',lower(up.email),
    'role','authenticated'
  )::text,
  true
)
from public.user_profiles up
where lower(up.email)='scolado@nechigroup.com'
limit 1;

do $$
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'CORE_UX_FUNCTIONAL_SUPERADMIN_CONTEXT_FAILED';
  end if;
end $$;

create temp table core_ux_training_before on commit drop as
select
  s.id,
  s.title,
  s.session_date,
  s.objective,
  s.duration_minutes,
  s.intensity,
  s.start_time,
  s.end_time,
  s.team_season_id
from public.training_sessions s
where upper(coalesce(s.status,'PLANNED'))<>'ARCHIVED'
order by s.created_at
limit 1;

create temp table core_ux_participants_before on commit drop as
select tp.*
from public.training_participants tp
join core_ux_training_before s on s.id=tp.training_session_id;

do $$
declare
  v_session core_ux_training_before%rowtype;
  v_participants jsonb;
  v_blocks jsonb;
begin
  select * into v_session from core_ux_training_before;
  if v_session.id is null then raise exception 'CORE_UX_FUNCTIONAL_TRAINING_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(tp.player_id::text order by tp.player_id::text),'[]'::jsonb)
    into v_participants
  from core_ux_participants_before tp;

  select coalesce(jsonb_agg(jsonb_build_object(
    'activity_type_id',b.activity_type_id,
    'block_order',b.block_order,
    'activity_code',b.activity_code,
    'title',b.title,
    'objective',b.objective,
    'duration_minutes',b.duration_minutes,
    'intensity',b.intensity,
    'metadata',coalesce(b.metadata,'{}'::jsonb)
  ) order by b.block_order),'[]'::jsonb)
    into v_blocks
  from public.training_blocks b
  where b.training_session_id=v_session.id;

  perform public.iq_v4_update_training_session(
    v_session.id,
    v_session.session_date,
    v_session.title || ' · CORE UX TEST',
    v_session.objective,
    v_session.duration_minutes,
    v_session.intensity,
    v_session.start_time,
    v_session.end_time,
    v_blocks,
    v_participants
  );
end $$;

do $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from core_ux_training_before;

  if not exists (
    select 1 from public.training_sessions
    where id=v_session_id and title like '%CORE UX TEST'
  ) then
    raise exception 'CORE_UX_FUNCTIONAL_TRAINING_UPDATE_FAILED';
  end if;

  if exists (
    select 1
    from core_ux_participants_before b
    full join public.training_participants a
      on a.id=b.id and a.training_session_id=b.training_session_id
    where b.training_session_id=v_session_id
      and (
        a.id is null
        or a.attendance_status is distinct from b.attendance_status
        or a.participated_minutes is distinct from b.participated_minutes
        or a.rpe is distinct from b.rpe
        or a.notes is distinct from b.notes
      )
  ) then
    raise exception 'CORE_UX_FUNCTIONAL_ATTENDANCE_CHANGED_DURING_EDIT';
  end if;
end $$;

create temp table core_ux_external_before on commit drop as
select *
from public.external_development_sessions
order by created_at
limit 1;

do $$
declare
  v_ext core_ux_external_before%rowtype;
begin
  select * into v_ext from core_ux_external_before;
  if v_ext.id is null then raise exception 'CORE_UX_FUNCTIONAL_EXTERNAL_NOT_FOUND'; end if;

  perform public.iq_v4_update_external_development(
    v_ext.id,
    v_ext.player_id,
    v_ext.activity_date,
    v_ext.title || ' · CORE UX TEST',
    v_ext.activity_code,
    v_ext.activity_type_id,
    v_ext.provider_type,
    v_ext.provider_name,
    v_ext.objective,
    v_ext.duration_minutes,
    v_ext.intensity,
    v_ext.rpe,
    v_ext.source_type,
    v_ext.notes,
    v_ext.provenance,
    v_ext.metadata
  );

  if not exists (
    select 1 from public.external_development_sessions
    where id=v_ext.id and title like '%CORE UX TEST'
  ) then
    raise exception 'CORE_UX_FUNCTIONAL_EXTERNAL_UPDATE_FAILED';
  end if;
end $$;

-- Frozen scope guard is shared by training and external development.
do $$
declare
  v_ts uuid;
begin
  select team_season_id into v_ts from core_ux_training_before;
  update public.team_seasons set data_status='FROZEN' where id=v_ts;

  if public.iq_v4_can_manage_training(v_ts) then
    raise exception 'CORE_UX_FUNCTIONAL_FROZEN_TRAINING_STILL_EDITABLE';
  end if;

  update public.team_seasons set data_status='ACTIVE' where id=v_ts;
end $$;

create temp table core_ux_boxscore_candidate on commit drop as
select g.*
from public.games g
join public.team_seasons ts on ts.id=g.team_season_id
where upper(coalesce(g.edit_state,'OPEN'))='OPEN'
  and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  and exists (select 1 from public.player_game_stats pgs where pgs.game_id=g.id)
  and (
    select coalesce(sum(
      coalesce(pgs.fg2_made,0)*2
      + coalesce(pgs.fg3_made,0)*3
      + coalesce(pgs.ft_made,0)
    ),0)::integer
    from public.player_game_stats pgs
    where pgs.game_id=g.id
  )=coalesce(g.team_score,0)
order by g.date desc,g.id
limit 1;

do $$
declare
  v_game core_ux_boxscore_candidate%rowtype;
  v_stats jsonb;
  v_events integer;
  v_audit_before integer;
  v_audit_after integer;
begin
  select * into v_game from core_ux_boxscore_candidate;
  if v_game.id is null then
    raise exception 'CORE_UX_FUNCTIONAL_OPEN_BOXSCORE_CANDIDATE_NOT_FOUND';
  end if;

  if not public.iq_core_ux_can_edit_boxscore(v_game.id) then
    raise exception 'CORE_UX_FUNCTIONAL_OPEN_BOXSCORE_NOT_EDITABLE';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id',pgs.player_id,
    'starter',coalesce(pgs.starter,false),
    'minutes',coalesce(pgs.minutes,0),
    'fg2_made',coalesce(pgs.fg2_made,0),
    'fg2_attempted',coalesce(pgs.fg2_attempted,0),
    'fg3_made',coalesce(pgs.fg3_made,0),
    'fg3_attempted',coalesce(pgs.fg3_attempted,0),
    'ft_made',coalesce(pgs.ft_made,0),
    'ft_attempted',coalesce(pgs.ft_attempted,0),
    'off_reb',coalesce(pgs.off_reb,0),
    'def_reb',coalesce(pgs.def_reb,0),
    'assists',coalesce(pgs.assists,0),
    'steals',coalesce(pgs.steals,0),
    'blocks_made',coalesce(pgs.blocks_made,pgs.blocks,0),
    'blocks_received',coalesce(pgs.blocks_received,0),
    'turnovers',coalesce(pgs.turnovers,0),
    'fouls_committed',coalesce(pgs.fouls_committed,0),
    'fouls_drawn',coalesce(pgs.fouls_drawn,0),
    'plus_minus',coalesce(pgs.plus_minus,0),
    'evaluation',coalesce(pgs.evaluation,0)
  ) order by pgs.player_id::text),'[]'::jsonb)
  into v_stats
  from public.player_game_stats pgs
  where pgs.game_id=v_game.id;

  select count(*) into v_events from public.game_events where game_id=v_game.id;
  select count(*) into v_audit_before from public.game_boxscore_corrections where game_id=v_game.id;

  perform public.iq_core_ux_save_boxscore_correction(
    v_game.id,
    coalesce(v_game.starter_ids,'[]'::jsonb),
    v_stats,
    case when v_events>0 then 'CORE UX functional audit reason' else null end,
    case when v_events>0 then 'MANUAL_OVERRIDE' else 'PRIMARY_BOXSCORE' end,
    '[]'::jsonb
  );

  select count(*) into v_audit_after from public.game_boxscore_corrections where game_id=v_game.id;
  if v_audit_after <> v_audit_before + 1 then
    raise exception 'CORE_UX_FUNCTIONAL_BOXSCORE_AUDIT_NOT_CREATED';
  end if;
end $$;

select
  'CORE_UX_FUNCTIONAL' as section,
  exists (
    select 1 from public.training_sessions s
    join core_ux_training_before b on b.id=s.id
    where s.title=b.title || ' · CORE UX TEST'
  ) as training_update_ok,
  not exists (
    select 1
    from core_ux_participants_before b
    join public.training_participants a on a.id=b.id
    where a.attendance_status is distinct from b.attendance_status
       or a.participated_minutes is distinct from b.participated_minutes
       or a.rpe is distinct from b.rpe
       or a.notes is distinct from b.notes
  ) as attendance_preserved_ok,
  exists (
    select 1 from public.external_development_sessions e
    join core_ux_external_before b on b.id=e.id
    where e.title=b.title || ' · CORE UX TEST'
  ) as external_update_ok,
  exists (select 1 from core_ux_boxscore_candidate) as boxscore_candidate_ok,
  true as frozen_guard_ok,
  true as all_ok;

rollback;
