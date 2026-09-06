begin;

do $development_prereq$
begin
  if to_regclass('public.player_development_cycles') is not null
     or to_regclass('public.player_development_actions') is not null
     or to_regclass('public.player_development_action_evidence') is not null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_ALREADY_INSTALLED';
  end if;

  if to_regclass('public.player_objective_profiles') is null
     or to_regclass('public.player_objective_targets') is null
     or to_regclass('public.training_sessions') is null
     or to_regclass('public.training_participants') is null
     or to_regclass('public.external_development_sessions') is null
     or to_regclass('public.games') is null
     or to_regclass('public.player_game_stats') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.seasons') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('public.iq_v4_touch_updated_at()') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('iq_private.family_can_view_player(uuid,uuid)') is null
     or to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is null
     or to_regprocedure('public.iq_v4_can_manage_objective_profile(uuid)') is null
     or to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_PREREQUISITES_MISSING';
  end if;
end
$development_prereq$;

create table public.player_development_cycles (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  objective_profile_id uuid not null references public.player_objective_profiles(id) on delete restrict,
  objective_profile_key uuid not null,
  objective_revision integer not null,
  week_start date not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'ACTIVE',
  objective_title_snapshot text not null,
  focus_metric_code text not null,
  focus_metric_name text not null,
  focus_domain_code text not null,
  focus_target_score numeric null,
  focus_priority_weight numeric not null default 1,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  review_outcome text null,
  review_note text null,
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.user_profiles(id) on delete set null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_development_cycle_status_check
    check (status in ('ACTIVE','REVIEW_DUE','COMPLETED','PAUSED')),
  constraint player_development_cycle_outcome_check
    check (review_outcome is null or review_outcome in ('CONTINUE','ADAPT','ACHIEVED','PAUSE')),
  constraint player_development_cycle_dates_check
    check (starts_on between week_start and week_start + 6 and ends_on = week_start + 6),
  constraint player_development_cycle_review_check
    check (
      (status in ('COMPLETED','PAUSED') and review_outcome is not null and reviewed_at is not null)
      or (status in ('ACTIVE','REVIEW_DUE') and review_outcome is null and reviewed_at is null)
    ),
  constraint player_development_cycle_scope_uq unique (id,team_season_id,player_id)
);

create unique index player_development_cycle_player_week_uq
  on public.player_development_cycles(player_id,week_start);
create index player_development_cycle_scope_idx
  on public.player_development_cycles(team_season_id,player_id,week_start desc);
create index player_development_cycle_player_fk_idx
  on public.player_development_cycles(player_id);
create index player_development_cycle_objective_fk_idx
  on public.player_development_cycles(objective_profile_id);
create index player_development_cycle_created_by_fk_idx
  on public.player_development_cycles(created_by);
create index player_development_cycle_updated_by_fk_idx
  on public.player_development_cycles(updated_by);
create index player_development_cycle_reviewed_by_fk_idx
  on public.player_development_cycles(reviewed_by);

create table public.player_development_actions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null,
  team_season_id uuid not null,
  player_id uuid not null,
  action_order integer not null,
  action_type text not null,
  status text not null default 'PLANNED',
  focus_metric_code text not null,
  focus_metric_name text not null,
  title text not null,
  success_criterion text not null,
  state_note text null,
  completed_at timestamptz null,
  completed_by uuid null references public.user_profiles(id) on delete set null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_development_action_cycle_scope_fk
    foreign key (cycle_id,team_season_id,player_id)
    references public.player_development_cycles(id,team_season_id,player_id) on delete cascade,
  constraint player_development_action_order_check check (action_order between 1 and 3),
  constraint player_development_action_type_check
    check (action_type in ('TRAINING','TECHNIFICATION','GAME','REFLECTION','OTHER')),
  constraint player_development_action_status_check
    check (status in ('PLANNED','IN_PROGRESS','COMPLETED','SKIPPED')),
  constraint player_development_action_title_check check (length(trim(title)) between 3 and 180),
  constraint player_development_action_criterion_check check (length(trim(success_criterion)) between 5 and 600),
  constraint player_development_action_completion_check
    check (
      (status='COMPLETED' and completed_at is not null)
      or (status<>'COMPLETED' and completed_at is null)
    ),
  constraint player_development_action_cycle_order_uq unique (cycle_id,action_order),
  constraint player_development_action_scope_uq unique (id,cycle_id,team_season_id,player_id)
);

create index player_development_action_cycle_idx
  on public.player_development_actions(cycle_id,action_order);
create index player_development_action_player_idx
  on public.player_development_actions(player_id,team_season_id);
create index player_development_action_completed_by_fk_idx
  on public.player_development_actions(completed_by);
create index player_development_action_created_by_fk_idx
  on public.player_development_actions(created_by);
create index player_development_action_updated_by_fk_idx
  on public.player_development_actions(updated_by);

create table public.player_development_action_evidence (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null,
  cycle_id uuid not null,
  team_season_id uuid not null,
  player_id uuid not null,
  evidence_type text not null,
  training_session_id uuid null references public.training_sessions(id) on delete restrict,
  external_development_session_id uuid null references public.external_development_sessions(id) on delete restrict,
  game_id uuid null references public.games(id) on delete restrict,
  evidence_date date not null,
  evidence_label_snapshot text not null,
  note text null,
  linked_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint player_development_evidence_action_scope_fk
    foreign key (action_id,cycle_id,team_season_id,player_id)
    references public.player_development_actions(id,cycle_id,team_season_id,player_id) on delete cascade,
  constraint player_development_evidence_type_check
    check (evidence_type in ('TRAINING_SESSION','EXTERNAL_DEVELOPMENT','GAME')),
  constraint player_development_evidence_reference_check
    check (
      (evidence_type='TRAINING_SESSION' and training_session_id is not null and external_development_session_id is null and game_id is null)
      or
      (evidence_type='EXTERNAL_DEVELOPMENT' and training_session_id is null and external_development_session_id is not null and game_id is null)
      or
      (evidence_type='GAME' and training_session_id is null and external_development_session_id is null and game_id is not null)
    )
);

create unique index player_development_evidence_training_uq
  on public.player_development_action_evidence(action_id,training_session_id)
  where training_session_id is not null;
create unique index player_development_evidence_external_uq
  on public.player_development_action_evidence(action_id,external_development_session_id)
  where external_development_session_id is not null;
create unique index player_development_evidence_game_uq
  on public.player_development_action_evidence(action_id,game_id)
  where game_id is not null;
create index player_development_evidence_cycle_idx
  on public.player_development_action_evidence(cycle_id,created_at);
create index player_development_evidence_training_fk_idx
  on public.player_development_action_evidence(training_session_id);
create index player_development_evidence_external_fk_idx
  on public.player_development_action_evidence(external_development_session_id);
create index player_development_evidence_game_fk_idx
  on public.player_development_action_evidence(game_id);
create index player_development_evidence_linked_by_fk_idx
  on public.player_development_action_evidence(linked_by);

create trigger player_development_cycles_touch
before update on public.player_development_cycles
for each row execute function public.iq_v4_touch_updated_at();

create trigger player_development_actions_touch
before update on public.player_development_actions
for each row execute function public.iq_v4_touch_updated_at();

alter table public.player_development_cycles enable row level security;
alter table public.player_development_actions enable row level security;
alter table public.player_development_action_evidence enable row level security;
revoke all on table public.player_development_cycles from public,anon,authenticated;
revoke all on table public.player_development_actions from public,anon,authenticated;
revoke all on table public.player_development_action_evidence from public,anon,authenticated;

create policy iq_player_development_cycles_no_direct_client_access
  on public.player_development_cycles for all to anon,authenticated
  using (false) with check (false);
create policy iq_player_development_actions_no_direct_client_access
  on public.player_development_actions for all to anon,authenticated
  using (false) with check (false);
create policy iq_player_development_evidence_no_direct_client_access
  on public.player_development_action_evidence for all to anon,authenticated
  using (false) with check (false);

create or replace function iq_private.development_cycle_is_self(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1
      from public.user_profiles up
      where up.id=auth.uid()
        and up.linked_player_id=p_player_id
        and upper(coalesce(up.global_role,up.role,''))='JUGADOR'
    );
$function$;
revoke all on function iq_private.development_cycle_is_self(uuid)
  from public,anon,authenticated;

create or replace function iq_private.development_cycle_can_view(
  p_team_season_id uuid,
  p_player_id uuid
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1 from public.roster_memberships rm
      where rm.team_season_id=p_team_season_id and rm.player_id=p_player_id
    )
    and (
      iq_private.development_cycle_is_self(p_player_id)
      or public.iq_v4_can_view_player360_team_season(p_team_season_id)
    );
$function$;
revoke all on function iq_private.development_cycle_can_view(uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.development_cycle_can_manage(
  p_team_season_id uuid,
  p_player_id uuid
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1
      from public.team_seasons ts
      where ts.id=p_team_season_id
        and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
        and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    )
    and exists (
      select 1 from public.roster_memberships rm
      where rm.team_season_id=p_team_season_id and rm.player_id=p_player_id
    )
    and public.iq_v4_can_manage_objective_profile(p_team_season_id);
$function$;
revoke all on function iq_private.development_cycle_can_manage(uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.development_cycle_evidence_snapshot(
  p_team_season_id uuid,
  p_player_id uuid
) returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'generated_at',now(),
    'window_days',28,
    'training_sessions',(
      select count(*)
      from public.training_sessions ts
      join public.training_participants tp
        on tp.training_session_id=ts.id
       and tp.team_season_id=ts.team_season_id
      where ts.team_season_id=p_team_season_id
        and tp.player_id=p_player_id
        and ts.status<>'ARCHIVED'
        and ts.session_date between current_date-27 and current_date
    ),
    'technification_sessions',(
      select count(*)
      from public.external_development_sessions ed
      where ed.team_season_id=p_team_season_id
        and ed.player_id=p_player_id
        and ed.activity_date between current_date-27 and current_date
    ),
    'games',(
      select count(*)
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      where pgs.player_id=p_player_id
        and g.team_season_id=p_team_season_id
        and coalesce(g.game_date,g.date) between current_date-27 and current_date
    )
  );
$function$;
revoke all on function iq_private.development_cycle_evidence_snapshot(uuid,uuid)
  from public,anon,authenticated;

create or replace function public.iq_v16_development_cycle_capabilities(
  p_team_season_id uuid,
  p_player_id uuid
) returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select jsonb_build_object(
    'ready',true,
    'can_view',iq_private.development_cycle_can_view(p_team_season_id,p_player_id),
    'can_create',iq_private.development_cycle_can_manage(p_team_season_id,p_player_id),
    'can_edit_action',iq_private.development_cycle_can_manage(p_team_season_id,p_player_id),
    'can_link_evidence',iq_private.development_cycle_can_manage(p_team_season_id,p_player_id),
    'can_review',iq_private.development_cycle_can_manage(p_team_season_id,p_player_id)
  );
$function$;
revoke all on function public.iq_v16_development_cycle_capabilities(uuid,uuid)
  from public,anon;
grant execute on function public.iq_v16_development_cycle_capabilities(uuid,uuid)
  to authenticated;

create or replace function public.iq_v16_development_cycle_snapshot(
  p_team_season_id uuid,
  p_player_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_week_start date:=current_date-(extract(isodow from current_date)::integer-1);
  v_cycle_id uuid;
  v_current jsonb:=null;
  v_recent jsonb:='[]'::jsonb;
  v_available jsonb:='[]'::jsonb;
begin
  if not iq_private.development_cycle_can_view(p_team_season_id,p_player_id) then
    raise exception 'DEVELOPMENT_CYCLE_VIEW_DENIED' using errcode='42501';
  end if;

  select c.id into v_cycle_id
  from public.player_development_cycles c
  where c.player_id=p_player_id
    and c.team_season_id=p_team_season_id
    and c.week_start=v_week_start
  limit 1;

  if v_cycle_id is not null then
    select jsonb_build_object(
      'id',c.id,
      'team_season_id',c.team_season_id,
      'player_id',c.player_id,
      'objective_profile_id',c.objective_profile_id,
      'objective_profile_key',c.objective_profile_key,
      'objective_revision',c.objective_revision,
      'week_start',c.week_start,
      'starts_on',c.starts_on,
      'ends_on',c.ends_on,
      'status',c.status,
      'objective_title',c.objective_title_snapshot,
      'focus_metric_code',c.focus_metric_code,
      'focus_metric_name',c.focus_metric_name,
      'focus_domain_code',c.focus_domain_code,
      'focus_target_score',c.focus_target_score,
      'evidence_snapshot',c.evidence_snapshot,
      'review_outcome',c.review_outcome,
      'review_note',c.review_note,
      'reviewed_at',c.reviewed_at,
      'actions',coalesce(a.actions,'[]'::jsonb)
    )
    into v_current
    from public.player_development_cycles c
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id',da.id,
        'action_order',da.action_order,
        'action_type',da.action_type,
        'status',da.status,
        'focus_metric_code',da.focus_metric_code,
        'focus_metric_name',da.focus_metric_name,
        'title',da.title,
        'success_criterion',da.success_criterion,
        'state_note',da.state_note,
        'completed_at',da.completed_at,
        'evidence',coalesce(ev.evidence,'[]'::jsonb)
      ) order by da.action_order) actions
      from public.player_development_actions da
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'id',e.id,
          'evidence_type',e.evidence_type,
          'evidence_date',e.evidence_date,
          'label',e.evidence_label_snapshot,
          'note',e.note
        ) order by e.evidence_date desc,e.created_at desc) evidence
        from public.player_development_action_evidence e
        where e.action_id=da.id
      ) ev on true
      where da.cycle_id=c.id
    ) a on true
    where c.id=v_cycle_id;
  end if;

  select coalesce(jsonb_agg(item order by week_start desc),'[]'::jsonb)
  into v_recent
  from (
    select c.week_start,jsonb_build_object(
      'id',c.id,
      'week_start',c.week_start,
      'status',c.status,
      'objective_title',c.objective_title_snapshot,
      'focus_metric_name',c.focus_metric_name,
      'review_outcome',c.review_outcome
    ) item
    from public.player_development_cycles c
    where c.player_id=p_player_id
      and c.team_season_id=p_team_season_id
      and c.week_start<v_week_start
    order by c.week_start desc
    limit 8
  ) history;

  select coalesce(jsonb_agg(all_evidence.item order by all_evidence.evidence_date desc),'[]'::jsonb)
  into v_available
  from (
    select training.evidence_date,training.item
    from (
      select ts.session_date evidence_date,jsonb_build_object(
        'type','TRAINING_SESSION','id',ts.id,'date',ts.session_date,
        'label',ts.title
      ) item
      from public.training_sessions ts
      join public.training_participants tp
        on tp.training_session_id=ts.id and tp.team_season_id=ts.team_season_id
      where ts.team_season_id=p_team_season_id
        and tp.player_id=p_player_id
        and ts.status<>'ARCHIVED'
        and ts.session_date<=current_date
      order by ts.session_date desc,ts.created_at desc
      limit 6
    ) training
    union all
    select external_rows.evidence_date,external_rows.item
    from (
      select ed.activity_date evidence_date,jsonb_build_object(
        'type','EXTERNAL_DEVELOPMENT','id',ed.id,'date',ed.activity_date,
        'label',ed.title
      ) item
      from public.external_development_sessions ed
      where ed.team_season_id=p_team_season_id
        and ed.player_id=p_player_id
        and ed.activity_date<=current_date
      order by ed.activity_date desc,ed.created_at desc
      limit 6
    ) external_rows
    union all
    select game_rows.evidence_date,game_rows.item
    from (
      select coalesce(g.game_date,g.date) evidence_date,jsonb_build_object(
        'type','GAME','id',g.id,'date',coalesce(g.game_date,g.date),
        'label',case when nullif(trim(coalesce(g.opponent,'')),'') is null then 'Partido' else 'vs '||g.opponent end
      ) item
      from public.player_game_stats pgs
      join public.games g on g.id=pgs.game_id
      where pgs.player_id=p_player_id
        and g.team_season_id=p_team_season_id
      order by coalesce(g.game_date,g.date) desc nulls last,g.created_at desc
      limit 5
    ) game_rows
  ) all_evidence;

  return jsonb_build_object(
    'version','PLAYER_DEVELOPMENT_LOOP_V2',
    'team_season_id',p_team_season_id,
    'player_id',p_player_id,
    'current_cycle',v_current,
    'recent_cycles',v_recent,
    'available_evidence',v_available,
    'capabilities',public.iq_v16_development_cycle_capabilities(p_team_season_id,p_player_id)
  );
end;
$function$;
revoke all on function public.iq_v16_development_cycle_snapshot(uuid,uuid)
  from public,anon;
grant execute on function public.iq_v16_development_cycle_snapshot(uuid,uuid)
  to authenticated;

create or replace function public.iq_v16_start_development_cycle(
  p_team_season_id uuid,
  p_player_id uuid,
  p_objective_profile_id uuid,
  p_actions jsonb
) returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_week_start date:=current_date-(extract(isodow from current_date)::integer-1);
  v_objective public.player_objective_profiles%rowtype;
  v_focus public.player_objective_targets%rowtype;
  v_cycle_id uuid;
  v_action jsonb;
  v_order integer:=0;
  v_metric public.player_objective_targets%rowtype;
  v_metric_code text;
  v_action_type text;
  v_title text;
  v_criterion text;
begin
  if not iq_private.development_cycle_can_manage(p_team_season_id,p_player_id) then
    raise exception 'DEVELOPMENT_CYCLE_CREATE_DENIED' using errcode='42501';
  end if;
  if p_actions is null or jsonb_typeof(p_actions)<>'array'
     or jsonb_array_length(p_actions) not between 1 and 3 then
    raise exception 'DEVELOPMENT_CYCLE_ACTION_COUNT_INVALID';
  end if;

  select * into v_objective
  from public.player_objective_profiles op
  where op.id=p_objective_profile_id
    and op.team_season_id=p_team_season_id
    and op.player_id=p_player_id
    and op.status='ACTIVE';

  if v_objective.id is null then
    raise exception 'DEVELOPMENT_CYCLE_ACTIVE_OBJECTIVE_REQUIRED';
  end if;

  select * into v_focus
  from public.player_objective_targets ot
  where ot.profile_id=v_objective.id
  order by ot.priority_weight desc,ot.created_at,ot.id
  limit 1;

  if v_focus.id is null then
    raise exception 'DEVELOPMENT_CYCLE_OBJECTIVE_TARGET_REQUIRED';
  end if;

  if exists (
    select 1 from public.player_development_cycles c
    where c.player_id=p_player_id and c.week_start=v_week_start
  ) then
    raise exception 'DEVELOPMENT_CYCLE_WEEK_ALREADY_EXISTS';
  end if;

  insert into public.player_development_cycles(
    team_season_id,player_id,objective_profile_id,objective_profile_key,objective_revision,
    week_start,starts_on,ends_on,status,objective_title_snapshot,
    focus_metric_code,focus_metric_name,focus_domain_code,focus_target_score,
    focus_priority_weight,evidence_snapshot,created_by,updated_by
  ) values (
    p_team_season_id,p_player_id,v_objective.id,v_objective.profile_key,v_objective.revision,
    v_week_start,current_date,v_week_start+6,'ACTIVE',v_objective.title,
    v_focus.metric_code,v_focus.metric_name,v_focus.domain_code,v_focus.target_score,
    v_focus.priority_weight,
    iq_private.development_cycle_evidence_snapshot(p_team_season_id,p_player_id),
    auth.uid(),auth.uid()
  ) returning id into v_cycle_id;

  for v_action in select value from jsonb_array_elements(p_actions)
  loop
    v_order:=v_order+1;
    v_action_type:=upper(trim(coalesce(v_action->>'action_type','OTHER')));
    v_title:=trim(coalesce(v_action->>'title',''));
    v_criterion:=trim(coalesce(v_action->>'success_criterion',''));
    v_metric_code:=upper(trim(coalesce(v_action->>'metric_code',v_focus.metric_code)));

    if v_action_type not in ('TRAINING','TECHNIFICATION','GAME','REFLECTION','OTHER') then
      raise exception 'DEVELOPMENT_ACTION_TYPE_INVALID';
    end if;
    if length(v_title) not between 3 and 180 then
      raise exception 'DEVELOPMENT_ACTION_TITLE_INVALID';
    end if;
    if length(v_criterion) not between 5 and 600 then
      raise exception 'DEVELOPMENT_ACTION_CRITERION_INVALID';
    end if;

    select * into v_metric
    from public.player_objective_targets ot
    where ot.profile_id=v_objective.id and upper(ot.metric_code)=v_metric_code
    limit 1;
    if v_metric.id is null then
      raise exception 'DEVELOPMENT_ACTION_METRIC_OUTSIDE_OBJECTIVE';
    end if;

    insert into public.player_development_actions(
      cycle_id,team_season_id,player_id,action_order,action_type,status,
      focus_metric_code,focus_metric_name,title,success_criterion,
      created_by,updated_by,metadata
    ) values (
      v_cycle_id,p_team_season_id,p_player_id,v_order,v_action_type,'PLANNED',
      v_metric.metric_code,v_metric.metric_name,v_title,v_criterion,
      auth.uid(),auth.uid(),jsonb_build_object('version','PLAYER_DEVELOPMENT_LOOP_V2')
    );
  end loop;

  return v_cycle_id;
end;
$function$;
revoke all on function public.iq_v16_start_development_cycle(uuid,uuid,uuid,jsonb)
  from public,anon;
grant execute on function public.iq_v16_start_development_cycle(uuid,uuid,uuid,jsonb)
  to authenticated;

create or replace function public.iq_v16_set_development_action_state(
  p_action_id uuid,
  p_target_state text,
  p_note text default null
) returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_action public.player_development_actions%rowtype;
  v_cycle public.player_development_cycles%rowtype;
  v_target text:=upper(trim(coalesce(p_target_state,'')));
begin
  select * into v_action
  from public.player_development_actions da
  where da.id=p_action_id
  for update;

  if v_action.id is null then
    raise exception 'DEVELOPMENT_ACTION_NOT_FOUND';
  end if;
  if not iq_private.development_cycle_can_manage(v_action.team_season_id,v_action.player_id) then
    raise exception 'DEVELOPMENT_ACTION_EDIT_DENIED' using errcode='42501';
  end if;

  select * into v_cycle
  from public.player_development_cycles c
  where c.id=v_action.cycle_id
  for update;

  if v_cycle.status in ('COMPLETED','PAUSED') then
    raise exception 'DEVELOPMENT_CYCLE_ALREADY_REVIEWED';
  end if;
  if v_target not in ('PLANNED','IN_PROGRESS','COMPLETED','SKIPPED') then
    raise exception 'DEVELOPMENT_ACTION_STATE_INVALID';
  end if;

  update public.player_development_actions
  set status=v_target,
      state_note=nullif(trim(coalesce(p_note,'')),''),
      completed_at=case when v_target='COMPLETED' then coalesce(completed_at,now()) else null end,
      completed_by=case when v_target='COMPLETED' then auth.uid() else null end,
      updated_by=auth.uid()
  where id=v_action.id;

  if not exists (
    select 1 from public.player_development_actions da
    where da.cycle_id=v_cycle.id and da.status in ('PLANNED','IN_PROGRESS')
  ) then
    update public.player_development_cycles
    set status='REVIEW_DUE',updated_by=auth.uid()
    where id=v_cycle.id;
  elsif v_cycle.status='REVIEW_DUE' then
    update public.player_development_cycles
    set status='ACTIVE',updated_by=auth.uid()
    where id=v_cycle.id;
  end if;

  return v_action.id;
end;
$function$;
revoke all on function public.iq_v16_set_development_action_state(uuid,text,text)
  from public,anon;
grant execute on function public.iq_v16_set_development_action_state(uuid,text,text)
  to authenticated;

create or replace function public.iq_v16_link_development_evidence(
  p_action_id uuid,
  p_evidence_type text,
  p_evidence_id uuid,
  p_note text default null
) returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_action public.player_development_actions%rowtype;
  v_cycle_status text;
  v_type text:=upper(trim(coalesce(p_evidence_type,'')));
  v_date date;
  v_label text;
  v_id uuid;
begin
  select * into v_action
  from public.player_development_actions da
  where da.id=p_action_id;

  if v_action.id is null then raise exception 'DEVELOPMENT_ACTION_NOT_FOUND'; end if;
  if not iq_private.development_cycle_can_manage(v_action.team_season_id,v_action.player_id) then
    raise exception 'DEVELOPMENT_EVIDENCE_LINK_DENIED' using errcode='42501';
  end if;

  select c.status into v_cycle_status
  from public.player_development_cycles c
  where c.id=v_action.cycle_id
  for update;
  if v_cycle_status in ('COMPLETED','PAUSED') then
    raise exception 'DEVELOPMENT_CYCLE_ALREADY_REVIEWED';
  end if;

  if v_type='TRAINING_SESSION' then
    select ts.session_date,ts.title into v_date,v_label
    from public.training_sessions ts
    where ts.id=p_evidence_id
      and ts.team_season_id=v_action.team_season_id
      and ts.status<>'ARCHIVED'
      and exists (
        select 1 from public.training_participants tp
        where tp.training_session_id=ts.id
          and tp.team_season_id=v_action.team_season_id
          and tp.player_id=v_action.player_id
      );
  elsif v_type='EXTERNAL_DEVELOPMENT' then
    select ed.activity_date,ed.title into v_date,v_label
    from public.external_development_sessions ed
    where ed.id=p_evidence_id
      and ed.team_season_id=v_action.team_season_id
      and ed.player_id=v_action.player_id;
  elsif v_type='GAME' then
    select coalesce(g.game_date,g.date),
           case when nullif(trim(coalesce(g.opponent,'')),'') is null then 'Partido' else 'vs '||g.opponent end
      into v_date,v_label
    from public.games g
    where g.id=p_evidence_id
      and g.team_season_id=v_action.team_season_id
      and exists (
        select 1 from public.player_game_stats pgs
        where pgs.game_id=g.id and pgs.player_id=v_action.player_id
      );
  else
    raise exception 'DEVELOPMENT_EVIDENCE_TYPE_INVALID';
  end if;

  if v_date is null or v_label is null then
    raise exception 'DEVELOPMENT_EVIDENCE_SCOPE_INVALID';
  end if;

  insert into public.player_development_action_evidence(
    action_id,cycle_id,team_season_id,player_id,evidence_type,
    training_session_id,external_development_session_id,game_id,
    evidence_date,evidence_label_snapshot,note,linked_by
  ) values (
    v_action.id,v_action.cycle_id,v_action.team_season_id,v_action.player_id,v_type,
    case when v_type='TRAINING_SESSION' then p_evidence_id end,
    case when v_type='EXTERNAL_DEVELOPMENT' then p_evidence_id end,
    case when v_type='GAME' then p_evidence_id end,
    v_date,v_label,nullif(trim(coalesce(p_note,'')),''),auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.iq_v16_link_development_evidence(uuid,text,uuid,text)
  from public,anon;
grant execute on function public.iq_v16_link_development_evidence(uuid,text,uuid,text)
  to authenticated;

create or replace function public.iq_v16_review_development_cycle(
  p_cycle_id uuid,
  p_outcome text,
  p_note text default null
) returns uuid
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_cycle public.player_development_cycles%rowtype;
  v_outcome text:=upper(trim(coalesce(p_outcome,'')));
begin
  select * into v_cycle
  from public.player_development_cycles c
  where c.id=p_cycle_id
  for update;

  if v_cycle.id is null then raise exception 'DEVELOPMENT_CYCLE_NOT_FOUND'; end if;
  if not iq_private.development_cycle_can_manage(v_cycle.team_season_id,v_cycle.player_id) then
    raise exception 'DEVELOPMENT_CYCLE_REVIEW_DENIED' using errcode='42501';
  end if;
  if v_cycle.status in ('COMPLETED','PAUSED') then
    raise exception 'DEVELOPMENT_CYCLE_ALREADY_REVIEWED';
  end if;
  if v_outcome not in ('CONTINUE','ADAPT','ACHIEVED','PAUSE') then
    raise exception 'DEVELOPMENT_CYCLE_OUTCOME_INVALID';
  end if;
  if exists (
    select 1 from public.player_development_actions da
    where da.cycle_id=v_cycle.id and da.status in ('PLANNED','IN_PROGRESS')
  ) then
    raise exception 'DEVELOPMENT_CYCLE_ACTIONS_NOT_FINISHED';
  end if;

  update public.player_development_cycles
  set status=case when v_outcome='PAUSE' then 'PAUSED' else 'COMPLETED' end,
      review_outcome=v_outcome,
      review_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_at=now(),
      reviewed_by=auth.uid(),
      updated_by=auth.uid()
  where id=v_cycle.id;

  return v_cycle.id;
end;
$function$;
revoke all on function public.iq_v16_review_development_cycle(uuid,text,text)
  from public,anon;
grant execute on function public.iq_v16_review_development_cycle(uuid,text,text)
  to authenticated;

create or replace function public.iq_v16_family_development_cycle(
  p_player_id uuid,
  p_team_season_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_team_season_id uuid:=p_team_season_id;
  v_week_start date:=current_date-(extract(isodow from current_date)::integer-1);
  v_internal_preview boolean:=false;
  v_gate jsonb;
  v_cycle jsonb:=null;
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
      'player_id',p_player_id,'team_season_id',null,'current_cycle',null
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
      'allowed',false,
      'reason_code',coalesce(v_gate->>'reason_code','DEVELOPMENT_PLAN_NOT_INCLUDED'),
      'player_id',p_player_id,'team_season_id',v_team_season_id,'current_cycle',null
    );
  end if;

  select jsonb_build_object(
    'id',c.id,
    'week_start',c.week_start,
    'ends_on',c.ends_on,
    'status',c.status,
    'objective_title',c.objective_title_snapshot,
    'focus_metric_name',c.focus_metric_name,
    'review_outcome',c.review_outcome,
    'actions',coalesce(a.actions,'[]'::jsonb)
  ) into v_cycle
  from public.player_development_cycles c
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',da.id,
      'action_order',da.action_order,
      'action_type',da.action_type,
      'status',da.status,
      'title',da.title,
      'success_criterion',da.success_criterion,
      'evidence',coalesce(ev.evidence,'[]'::jsonb)
    ) order by da.action_order) actions
    from public.player_development_actions da
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'evidence_type',e.evidence_type,
        'evidence_date',e.evidence_date,
        'label',e.evidence_label_snapshot
      ) order by e.evidence_date desc) evidence
      from public.player_development_action_evidence e
      where e.action_id=da.id
    ) ev on true
    where da.cycle_id=c.id
  ) a on true
  where c.player_id=p_player_id
    and c.team_season_id=v_team_season_id
    and c.week_start=v_week_start
  limit 1;

  return jsonb_build_object(
    'allowed',true,
    'reason_code',case when v_internal_preview then 'INTERNAL_PREVIEW' else 'ENTITLED' end,
    'version','PLAYER_DEVELOPMENT_LOOP_V2',
    'player_id',p_player_id,
    'team_season_id',v_team_season_id,
    'current_cycle',v_cycle
  );
end;
$function$;
revoke all on function public.iq_v16_family_development_cycle(uuid,uuid)
  from public,anon;
grant execute on function public.iq_v16_family_development_cycle(uuid,uuid)
  to authenticated;

do $development_verify$
begin
  if not (select relrowsecurity from pg_class where oid='public.player_development_cycles'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.player_development_actions'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.player_development_action_evidence'::regclass) then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_RLS_REQUIRED';
  end if;

  if has_table_privilege('authenticated','public.player_development_cycles','SELECT')
     or has_table_privilege('authenticated','public.player_development_cycles','INSERT')
     or has_table_privilege('authenticated','public.player_development_actions','UPDATE')
     or has_table_privilege('authenticated','public.player_development_action_evidence','INSERT') then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_DIRECT_CLIENT_ACCESS_OPEN';
  end if;

  if has_function_privilege('authenticated','iq_private.development_cycle_is_self(uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.development_cycle_can_view(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.development_cycle_can_manage(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.development_cycle_evidence_snapshot(uuid,uuid)','EXECUTE') then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_PRIVATE_HELPER_EXPOSED';
  end if;
end
$development_verify$;

commit;

select
  'PLAYER_DEVELOPMENT_LOOP_V2' section,
  to_regclass('public.player_development_cycles') is not null cycles_ok,
  to_regclass('public.player_development_actions') is not null actions_ok,
  to_regclass('public.player_development_action_evidence') is not null evidence_ok,
  to_regprocedure('public.iq_v16_development_cycle_snapshot(uuid,uuid)') is not null snapshot_ok;
