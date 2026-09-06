-- =============================================================================
-- IQBasket · Game Capture Delegation V1 (V21)
-- Resource-scoped, time-bounded delegation for live capture and BoxScore work.
-- Public RPCs are SECURITY INVOKER wrappers over an isolated private schema.
-- =============================================================================
begin;

do $prereq$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.roster_membership_stints') is null
     or to_regclass('public.player_game_stats') is null
     or to_regclass('public.game_period_scores') is null
     or to_regclass('public.game_events') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('public.iq_account_is_active_for_user(uuid)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is null
     or to_regprocedure('public.iq_v6_role_for_team_season(uuid)') is null
     or to_regprocedure('iq_private.can_mutate_game(uuid)') is null
     or to_regprocedure('iq_private.game_play_state_action_for_target(text)') is null
     or to_regprocedure('iq_private.game_play_state_actor_allowed(uuid,text)') is null then
    raise exception 'GAME_CAPTURE_DELEGATION_V1_PREREQUISITES_MISSING';
  end if;
end
$prereq$;

create table public.game_capture_delegations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  delegate_user_id uuid not null references public.user_profiles(id) on delete cascade,
  capability text not null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  granted_by uuid not null references public.user_profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  grant_note text,
  revoked_at timestamptz,
  revoked_by uuid references public.user_profiles(id) on delete set null,
  revoke_reason text,
  constraint game_capture_delegation_capability_check check (
    capability in ('RECORD_LIVE_GAME','EDIT_BOXSCORE','PREPARE_GAME','START_GAME','FINISH_GAME')
  ),
  constraint game_capture_delegation_window_check check (valid_until > valid_from),
  constraint game_capture_delegation_note_check check (
    grant_note is null or char_length(grant_note) <= 1000
  ),
  constraint game_capture_delegation_revoke_reason_check check (
    revoke_reason is null or char_length(revoke_reason) <= 1000
  )
);

create index game_capture_delegations_delegate_idx
  on public.game_capture_delegations(delegate_user_id,game_id,capability,valid_until desc);
create index game_capture_delegations_game_idx
  on public.game_capture_delegations(game_id,revoked_at,valid_until desc);
create index game_capture_delegations_granted_by_idx
  on public.game_capture_delegations(granted_by,granted_at desc);

create table public.game_capture_delegation_events (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid references public.game_capture_delegations(id) on delete set null,
  game_id uuid not null references public.games(id) on delete cascade,
  delegate_user_id uuid not null references public.user_profiles(id) on delete cascade,
  capability text not null,
  action text not null check (action in ('GRANTED','REVOKED','EXPIRED_REPLACED')),
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index game_capture_delegation_events_game_idx
  on public.game_capture_delegation_events(game_id,created_at desc);

create table public.game_capture_write_audit (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  source text not null default 'GAME_CAPTURE_V1',
  stats_count integer not null default 0,
  periods_count integer not null default 0,
  events_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index game_capture_write_audit_game_idx
  on public.game_capture_write_audit(game_id,created_at desc);

alter table public.game_capture_delegations enable row level security;
alter table public.game_capture_delegation_events enable row level security;
alter table public.game_capture_write_audit enable row level security;

revoke all on table public.game_capture_delegations from public,anon,authenticated;
revoke all on table public.game_capture_delegation_events from public,anon,authenticated;
revoke all on table public.game_capture_write_audit from public,anon,authenticated;

create policy iq_game_capture_delegations_no_direct_client_access
  on public.game_capture_delegations for all to anon,authenticated
  using(false) with check(false);
create policy iq_game_capture_delegation_events_no_direct_client_access
  on public.game_capture_delegation_events for all to anon,authenticated
  using(false) with check(false);
create policy iq_game_capture_write_audit_no_direct_client_access
  on public.game_capture_write_audit for all to anon,authenticated
  using(false) with check(false);

create schema if not exists iq_v21_private;
revoke all on schema iq_v21_private from public,anon,authenticated;
grant usage on schema iq_v21_private to authenticated;

create or replace function iq_v21_private.has_capability(
  p_game_id uuid,
  p_capability text
)
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
      from public.game_capture_delegations d
      where d.game_id=p_game_id
        and d.delegate_user_id=auth.uid()
        and d.capability=upper(trim(coalesce(p_capability,'')))
        and d.revoked_at is null
        and d.valid_from<=now()
        and d.valid_until>now()
    );
$function$;

create or replace function iq_v21_private.can_manage(p_game_id uuid)
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
      from public.games g
      where g.id=p_game_id
        and (
          public.iq_v3_is_global_superadmin()
          or upper(coalesce(public.iq_v6_role_for_team_season(g.team_season_id),'')) in (
            'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR'
          )
        )
    );
$function$;

create or replace function iq_v21_private.can_access_snapshot(p_game_id uuid)
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
      from public.games g
      where g.id=p_game_id
        and (
          public.iq_v3_can_read_team_season(g.team_season_id)
          or exists (
            select 1
            from public.game_capture_delegations d
            where d.game_id=g.id
              and d.delegate_user_id=auth.uid()
              and d.revoked_at is null
              and d.valid_from<=now()
              and d.valid_until>now()
          )
        )
    );
$function$;

create or replace function iq_v21_private.player_eligible(
  p_game_id uuid,
  p_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists (
    select 1
    from public.games g
    join public.roster_memberships rm
      on rm.team_season_id=g.team_season_id
     and rm.player_id=p_player_id
    where g.id=p_game_id
      and (
        exists (
          select 1
          from public.roster_membership_stints rs
          where rs.roster_membership_id=rm.id
            and rs.valid_from<=g.date
            and (rs.valid_until is null or rs.valid_until>=g.date)
        )
        or (
          not exists (
            select 1
            from public.roster_membership_stints rs0
            where rs0.roster_membership_id=rm.id
          )
          and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
          and (rm.joined_at is null or rm.joined_at::date<=g.date)
          and (rm.left_at is null or rm.left_at::date>=g.date)
        )
      )
  );
$function$;

create or replace function iq_v21_private.my_delegations()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when auth.uid() is null or not public.iq_account_is_active() then '[]'::jsonb
    else coalesce(jsonb_agg(item order by item->>'date',item->>'opponent'),'[]'::jsonb)
  end
  from (
    select jsonb_build_object(
      'game_id',g.id,
      'team_id',g.team_id,
      'team_season_id',g.team_season_id,
      'date',g.date,
      'time',g.time,
      'opponent',g.opponent,
      'venue',g.venue,
      'edit_state',g.edit_state,
      'play_state',g.play_state,
      'valid_until',max(d.valid_until),
      'capabilities',jsonb_agg(distinct d.capability order by d.capability)
    ) item
    from public.game_capture_delegations d
    join public.games g on g.id=d.game_id
    where d.delegate_user_id=auth.uid()
      and d.revoked_at is null
      and d.valid_from<=now()
      and d.valid_until>now()
    group by g.id,g.team_id,g.team_season_id,g.date,g.time,g.opponent,g.venue,g.edit_state,g.play_state
  ) active_delegations;
$function$;

create or replace function iq_v21_private.list_delegations(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
begin
  if not iq_v21_private.can_manage(p_game_id) then
    raise exception 'GAME_CAPTURE_DELEGATION_MANAGE_DENIED' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,
    'delegate_user_id',d.delegate_user_id,
    'email',up.email,
    'name',trim(concat_ws(' ',up.first_name,up.last_name)),
    'capability',d.capability,
    'valid_from',d.valid_from,
    'valid_until',d.valid_until,
    'granted_at',d.granted_at,
    'grant_note',d.grant_note,
    'revoked_at',d.revoked_at,
    'revoke_reason',d.revoke_reason
  ) order by d.granted_at desc),'[]'::jsonb)
  into v_result
  from public.game_capture_delegations d
  join public.user_profiles up on up.id=d.delegate_user_id
  where d.game_id=p_game_id;

  return v_result;
end
$function$;

create or replace function iq_v21_private.grant_delegation(
  p_game_id uuid,
  p_delegate_email text,
  p_capabilities text[],
  p_valid_until timestamptz,
  p_valid_from timestamptz default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_delegate public.user_profiles%rowtype;
  v_game public.games%rowtype;
  v_capability text;
  v_valid_from timestamptz:=coalesce(p_valid_from,now());
  v_delegation_id uuid;
  v_replaced_id uuid;
begin
  if not iq_v21_private.can_manage(p_game_id) then
    raise exception 'GAME_CAPTURE_DELEGATION_MANAGE_DENIED' using errcode='42501';
  end if;
  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_CAPTURE_DELEGATION_GAME_LOCKED' using errcode='42501';
  end if;
  if p_valid_until is null or p_valid_until<=v_valid_from then
    raise exception 'GAME_CAPTURE_DELEGATION_WINDOW_INVALID';
  end if;
  if p_valid_until>now()+interval '31 days' then
    raise exception 'GAME_CAPTURE_DELEGATION_WINDOW_TOO_LONG';
  end if;
  if coalesce(array_length(p_capabilities,1),0)=0 then
    raise exception 'GAME_CAPTURE_DELEGATION_CAPABILITIES_REQUIRED';
  end if;
  if char_length(coalesce(p_note,''))>1000 then
    raise exception 'GAME_CAPTURE_DELEGATION_NOTE_TOO_LONG';
  end if;

  select * into v_delegate
  from public.user_profiles
  where lower(email)=lower(trim(coalesce(p_delegate_email,'')))
  limit 1;
  if v_delegate.id is null or not public.iq_account_is_active_for_user(v_delegate.id) then
    raise exception 'GAME_CAPTURE_DELEGATE_ACTIVE_ACCOUNT_REQUIRED';
  end if;
  if v_delegate.id=auth.uid() then
    raise exception 'GAME_CAPTURE_DELEGATE_SELF_NOT_ALLOWED';
  end if;

  for v_capability in
    select distinct upper(trim(capability))
    from unnest(p_capabilities) as capability
  loop
    if v_capability not in (
      'RECORD_LIVE_GAME','EDIT_BOXSCORE','PREPARE_GAME','START_GAME','FINISH_GAME'
    ) then
      raise exception 'GAME_CAPTURE_DELEGATION_CAPABILITY_INVALID';
    end if;

    for v_replaced_id in
      select id
      from public.game_capture_delegations
      where game_id=p_game_id
        and delegate_user_id=v_delegate.id
        and capability=v_capability
        and revoked_at is null
        and valid_until>now()
    loop
      update public.game_capture_delegations
      set revoked_at=now(),
          revoked_by=auth.uid(),
          revoke_reason='Replaced by a new active delegation'
      where id=v_replaced_id;

      insert into public.game_capture_delegation_events(
        delegation_id,game_id,delegate_user_id,capability,action,
        actor_user_id,reason
      ) values (
        v_replaced_id,p_game_id,v_delegate.id,v_capability,'EXPIRED_REPLACED',
        auth.uid(),'Replaced by a new active delegation'
      );
    end loop;

    insert into public.game_capture_delegations(
      game_id,delegate_user_id,capability,valid_from,valid_until,
      granted_by,grant_note
    ) values (
      p_game_id,v_delegate.id,v_capability,v_valid_from,p_valid_until,
      auth.uid(),nullif(trim(coalesce(p_note,'')),'')
    ) returning id into v_delegation_id;

    insert into public.game_capture_delegation_events(
      delegation_id,game_id,delegate_user_id,capability,action,
      actor_user_id,reason,metadata
    ) values (
      v_delegation_id,p_game_id,v_delegate.id,v_capability,'GRANTED',
      auth.uid(),nullif(trim(coalesce(p_note,'')),''),
      jsonb_build_object('valid_from',v_valid_from,'valid_until',p_valid_until)
    );
  end loop;

  return iq_v21_private.list_delegations(p_game_id);
end
$function$;

create or replace function iq_v21_private.revoke_delegation(
  p_delegation_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_row public.game_capture_delegations%rowtype;
begin
  select * into v_row
  from public.game_capture_delegations
  where id=p_delegation_id;
  if v_row.id is null then raise exception 'GAME_CAPTURE_DELEGATION_NOT_FOUND'; end if;
  if not iq_v21_private.can_manage(v_row.game_id) then
    raise exception 'GAME_CAPTURE_DELEGATION_MANAGE_DENIED' using errcode='42501';
  end if;
  if char_length(coalesce(p_reason,''))>1000 then
    raise exception 'GAME_CAPTURE_DELEGATION_REASON_TOO_LONG';
  end if;

  if v_row.revoked_at is null then
    update public.game_capture_delegations
    set revoked_at=now(),
        revoked_by=auth.uid(),
        revoke_reason=nullif(trim(coalesce(p_reason,'')),'')
    where id=p_delegation_id;

    insert into public.game_capture_delegation_events(
      delegation_id,game_id,delegate_user_id,capability,action,
      actor_user_id,reason
    ) values (
      v_row.id,v_row.game_id,v_row.delegate_user_id,v_row.capability,'REVOKED',
      auth.uid(),nullif(trim(coalesce(p_reason,'')),'')
    );
  end if;

  return iq_v21_private.list_delegations(v_row.game_id);
end
$function$;

create or replace function iq_v21_private.snapshot(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_players jsonb:='[]'::jsonb;
  v_stats jsonb:='[]'::jsonb;
  v_periods jsonb:='[]'::jsonb;
  v_events jsonb:='[]'::jsonb;
  v_caps jsonb:='[]'::jsonb;
begin
  if not iq_v21_private.can_access_snapshot(p_game_id) then
    raise exception 'GAME_CAPTURE_SNAPSHOT_DENIED' using errcode='42501';
  end if;
  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(distinct d.capability order by d.capability),'[]'::jsonb)
  into v_caps
  from public.game_capture_delegations d
  where d.game_id=p_game_id
    and d.delegate_user_id=auth.uid()
    and d.revoked_at is null
    and d.valid_from<=now()
    and d.valid_until>now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'first_name',p.first_name,
    'last_name',p.last_name,
    'jersey',coalesce(rm.jersey,p.jersey),
    'primary_position',coalesce(rm.primary_position,p.primary_position)
  ) order by coalesce(rm.jersey,p.jersey),p.last_name,p.first_name),'[]'::jsonb)
  into v_players
  from public.roster_memberships rm
  join public.players p on p.id=rm.player_id
  where rm.team_season_id=v_game.team_season_id
    and iq_v21_private.player_eligible(p_game_id,p.id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'game_id',s.game_id,'player_id',s.player_id,'starter',s.starter,
    'minutes',s.minutes,'points',s.points,'fg2_made',s.fg2_made,
    'fg2_attempted',s.fg2_attempted,'fg3_made',s.fg3_made,
    'fg3_attempted',s.fg3_attempted,'ft_made',s.ft_made,
    'ft_attempted',s.ft_attempted,'off_reb',s.off_reb,'def_reb',s.def_reb,
    'assists',s.assists,'steals',s.steals,'blocks',s.blocks,
    'blocks_made',s.blocks_made,'blocks_received',s.blocks_received,
    'turnovers',s.turnovers,'fouls_committed',s.fouls_committed,
    'fouls_drawn',s.fouls_drawn,'plus_minus',s.plus_minus
  )),'[]'::jsonb)
  into v_stats
  from public.player_game_stats s
  where s.game_id=p_game_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ps.id,'game_id',ps.game_id,'period_type',ps.period_type,
    'period_number',ps.period_number,'team_score',ps.team_score,
    'opponent_score',ps.opponent_score,'is_overtime',ps.is_overtime
  ) order by ps.period_number),'[]'::jsonb)
  into v_periods
  from public.game_period_scores ps
  where ps.game_id=p_game_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'game_id',e.game_id,'player_id',e.player_id,
    'period',e.period,'game_clock',e.game_clock,'action_type',e.action_type,
    'points',e.points,'made',e.made,'coord_x',e.coord_x,'coord_y',e.coord_y
  ) order by e.created_at,e.id),'[]'::jsonb)
  into v_events
  from public.game_events e
  where e.game_id=p_game_id;

  return jsonb_build_object(
    'game',jsonb_build_object(
      'id',v_game.id,'team_id',v_game.team_id,'season_id',v_game.season_id,
      'team_season_id',v_game.team_season_id,'date',v_game.date,'time',v_game.time,
      'opponent',v_game.opponent,'competition',v_game.competition,'round',v_game.round,
      'venue',v_game.venue,'venue_name',v_game.venue_name,
      'periods_count',v_game.periods_count,'period_minutes',v_game.period_minutes,
      'team_score',v_game.team_score,'opponent_score',v_game.opponent_score,
      'starter_ids',v_game.starter_ids,'edit_state',v_game.edit_state,
      'play_state',v_game.play_state
    ),
    'players',v_players,
    'stats',v_stats,
    'periods',v_periods,
    'events',v_events,
    'delegated_capabilities',v_caps,
    'can_manage_delegations',iq_v21_private.can_manage(p_game_id),
    'can_record_live',(
      iq_private.can_mutate_game(p_game_id)
      or iq_v21_private.has_capability(p_game_id,'RECORD_LIVE_GAME')
    ),
    'can_edit_boxscore',(
      iq_private.can_mutate_game(p_game_id)
      or iq_v21_private.has_capability(p_game_id,'EDIT_BOXSCORE')
    )
  );
end
$function$;

create or replace function iq_v21_private.save_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_item jsonb;
  v_player_id uuid;
  v_can_capture boolean;
  v_can_boxscore boolean;
  v_stats_count integer:=0;
  v_periods_count integer:=0;
  v_events_count integer:=0;
  v_period_number integer;
  v_is_overtime boolean;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_CAPTURE_GAME_LOCKED' using errcode='42501';
  end if;
  if exists (
    select 1
    from public.team_seasons ts
    where ts.id=v_game.team_season_id
      and upper(coalesce(ts.data_status,'ACTIVE'))<>'ACTIVE'
  ) then
    raise exception 'GAME_CAPTURE_SEASON_FROZEN' using errcode='42501';
  end if;

  v_can_capture:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'RECORD_LIVE_GAME');
  v_can_boxscore:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'EDIT_BOXSCORE');

  if not v_can_capture and not v_can_boxscore then
    raise exception 'GAME_CAPTURE_WRITE_DENIED' using errcode='42501';
  end if;
  if (p_team_score is not null or p_opponent_score is not null
      or p_periods is not null or p_events is not null)
     and not v_can_capture then
    raise exception 'GAME_CAPTURE_LIVE_PERMISSION_REQUIRED' using errcode='42501';
  end if;

  if p_starter_ids is not null then
    if cardinality(p_starter_ids)>5 then
      raise exception 'GAME_CAPTURE_STARTERS_LIMIT_EXCEEDED';
    end if;
    foreach v_player_id in array p_starter_ids loop
      if not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE';
      end if;
    end loop;
  end if;

  update public.games
  set team_score=coalesce(p_team_score,team_score),
      opponent_score=coalesce(p_opponent_score,opponent_score),
      starter_ids=case when p_starter_ids is null then starter_ids else to_jsonb(p_starter_ids) end
  where id=p_game_id;

  if p_stats is not null then
    if jsonb_typeof(p_stats)<>'array' then
      raise exception 'GAME_CAPTURE_STATS_ARRAY_REQUIRED';
    end if;
    for v_item in select value from jsonb_array_elements(p_stats) loop
      v_player_id:=nullif(v_item->>'player_id','')::uuid;
      if v_player_id is null
         or not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE';
      end if;

      insert into public.player_game_stats(
        game_id,player_id,starter,minutes,points,
        fg2_made,fg2_attempted,fg3_made,fg3_attempted,
        ft_made,ft_attempted,off_reb,def_reb,assists,steals,
        blocks,blocks_made,blocks_received,turnovers,
        fouls_committed,fouls_drawn,plus_minus
      ) values (
        p_game_id,v_player_id,coalesce((v_item->>'starter')::boolean,false),
        greatest(coalesce((v_item->>'minutes')::integer,0),0),
        greatest(coalesce((v_item->>'points')::integer,0),0),
        greatest(coalesce((v_item->>'fg2_made')::integer,0),0),
        greatest(coalesce((v_item->>'fg2_attempted')::integer,0),0),
        greatest(coalesce((v_item->>'fg3_made')::integer,0),0),
        greatest(coalesce((v_item->>'fg3_attempted')::integer,0),0),
        greatest(coalesce((v_item->>'ft_made')::integer,0),0),
        greatest(coalesce((v_item->>'ft_attempted')::integer,0),0),
        greatest(coalesce((v_item->>'off_reb')::integer,0),0),
        greatest(coalesce((v_item->>'def_reb')::integer,0),0),
        greatest(coalesce((v_item->>'assists')::integer,0),0),
        greatest(coalesce((v_item->>'steals')::integer,0),0),
        greatest(coalesce((v_item->>'blocks')::integer,0),0),
        greatest(coalesce((v_item->>'blocks_made')::integer,0),0),
        greatest(coalesce((v_item->>'blocks_received')::integer,0),0),
        greatest(coalesce((v_item->>'turnovers')::integer,0),0),
        greatest(coalesce((v_item->>'fouls_committed')::integer,0),0),
        greatest(coalesce((v_item->>'fouls_drawn')::integer,0),0),
        coalesce((v_item->>'plus_minus')::integer,0)
      )
      on conflict (game_id,player_id) do update set
        starter=excluded.starter,
        minutes=excluded.minutes,
        points=excluded.points,
        fg2_made=excluded.fg2_made,
        fg2_attempted=excluded.fg2_attempted,
        fg3_made=excluded.fg3_made,
        fg3_attempted=excluded.fg3_attempted,
        ft_made=excluded.ft_made,
        ft_attempted=excluded.ft_attempted,
        off_reb=excluded.off_reb,
        def_reb=excluded.def_reb,
        assists=excluded.assists,
        steals=excluded.steals,
        blocks=excluded.blocks,
        blocks_made=excluded.blocks_made,
        blocks_received=excluded.blocks_received,
        turnovers=excluded.turnovers,
        fouls_committed=excluded.fouls_committed,
        fouls_drawn=excluded.fouls_drawn,
        plus_minus=excluded.plus_minus;
      v_stats_count:=v_stats_count+1;
    end loop;
  end if;

  if p_periods is not null then
    if jsonb_typeof(p_periods)<>'array' then
      raise exception 'GAME_CAPTURE_PERIODS_ARRAY_REQUIRED';
    end if;
    delete from public.game_period_scores where game_id=p_game_id;
    for v_item in select value from jsonb_array_elements(p_periods) loop
      v_is_overtime:=coalesce((v_item->>'is_overtime')::boolean,false);
      v_period_number:=greatest(coalesce((v_item->>'period_number')::integer,1),1);
      if v_is_overtime and v_period_number<=v_game.periods_count then
        v_period_number:=v_game.periods_count+v_period_number;
      end if;

      insert into public.game_period_scores(
        game_id,period_type,period_number,team_score,opponent_score,is_overtime
      ) values (
        p_game_id,
        case when v_is_overtime then 'overtime'
          else coalesce(nullif(v_item->>'period_type',''),'quarter') end,
        v_period_number,
        greatest(coalesce((v_item->>'team_score')::integer,0),0),
        greatest(coalesce((v_item->>'opponent_score')::integer,0),0),
        v_is_overtime
      );
      v_periods_count:=v_periods_count+1;
    end loop;
    update public.games
    set periods=p_periods,
        has_overtime=exists(
          select 1 from public.game_period_scores ps
          where ps.game_id=p_game_id and ps.is_overtime
        ),
        overtime_count=(
          select count(*) from public.game_period_scores ps
          where ps.game_id=p_game_id and ps.is_overtime
        )
    where id=p_game_id;
  end if;

  if p_events is not null then
    if jsonb_typeof(p_events)<>'array' then
      raise exception 'GAME_CAPTURE_EVENTS_ARRAY_REQUIRED';
    end if;
    delete from public.game_events where game_id=p_game_id;
    for v_item in select value from jsonb_array_elements(p_events) loop
      v_player_id:=nullif(v_item->>'player_id','')::uuid;
      if v_player_id is not null
         and not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE';
      end if;
      if nullif(trim(coalesce(v_item->>'action_type','')),'') is null then
        raise exception 'GAME_CAPTURE_ACTION_TYPE_REQUIRED';
      end if;

      insert into public.game_events(
        id,game_id,player_id,team_id,period,game_clock,action_type,
        points,made,coord_x,coord_y,created_by
      ) values (
        gen_random_uuid(),p_game_id,v_player_id,v_game.team_id,
        greatest(coalesce((v_item->>'period')::integer,1),1),
        coalesce(nullif(v_item->>'game_clock',''),'10:00'),
        trim(v_item->>'action_type'),
        greatest(coalesce((v_item->>'points')::integer,0),0),
        coalesce((v_item->>'made')::boolean,false),
        case when v_item ? 'coord_x' and v_item->>'coord_x'<>'' then (v_item->>'coord_x')::numeric else null end,
        case when v_item ? 'coord_y' and v_item->>'coord_y'<>'' then (v_item->>'coord_y')::numeric else null end,
        auth.uid()
      );
      v_events_count:=v_events_count+1;
    end loop;
  end if;

  insert into public.game_capture_write_audit(
    game_id,actor_user_id,stats_count,periods_count,events_count
  ) values (
    p_game_id,auth.uid(),v_stats_count,v_periods_count,v_events_count
  );

  return iq_v21_private.snapshot(p_game_id);
end
$function$;

-- Public Data API boundary: invoker wrappers only.
create or replace function public.iq_v21_my_game_capture_delegations()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v21_private.my_delegations();
$function$;

create or replace function public.iq_v21_list_game_capture_delegations(p_game_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v21_private.list_delegations(p_game_id);
$function$;

create or replace function public.iq_v21_grant_game_capture_delegation(
  p_game_id uuid,
  p_delegate_email text,
  p_capabilities text[],
  p_valid_until timestamptz,
  p_valid_from timestamptz default null,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v21_private.grant_delegation(
    p_game_id,p_delegate_email,p_capabilities,p_valid_until,p_valid_from,p_note
  );
$function$;

create or replace function public.iq_v21_revoke_game_capture_delegation(
  p_delegation_id uuid,
  p_reason text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v21_private.revoke_delegation(p_delegation_id,p_reason);
$function$;

create or replace function public.iq_v21_game_capture_snapshot(p_game_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v21_private.snapshot(p_game_id);
$function$;

create or replace function public.iq_v21_save_game_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v21_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,p_stats,p_periods,p_events
  );
$function$;

-- Private functions are callable only as the implementation detail of the public wrappers.
revoke all on all functions in schema iq_v21_private from public,anon,authenticated;
grant execute on function iq_v21_private.my_delegations() to authenticated;
grant execute on function iq_v21_private.list_delegations(uuid) to authenticated;
grant execute on function iq_v21_private.grant_delegation(uuid,text,text[],timestamptz,timestamptz,text) to authenticated;
grant execute on function iq_v21_private.revoke_delegation(uuid,text) to authenticated;
grant execute on function iq_v21_private.snapshot(uuid) to authenticated;
grant execute on function iq_v21_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb) to authenticated;
-- Helpers are reached only by the private functions or existing lifecycle definer.

revoke all on function public.iq_v21_my_game_capture_delegations() from public,anon,authenticated;
revoke all on function public.iq_v21_list_game_capture_delegations(uuid) from public,anon,authenticated;
revoke all on function public.iq_v21_grant_game_capture_delegation(uuid,text,text[],timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.iq_v21_revoke_game_capture_delegation(uuid,text) from public,anon,authenticated;
revoke all on function public.iq_v21_game_capture_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb) from public,anon,authenticated;

grant execute on function public.iq_v21_my_game_capture_delegations() to authenticated;
grant execute on function public.iq_v21_list_game_capture_delegations(uuid) to authenticated;
grant execute on function public.iq_v21_grant_game_capture_delegation(uuid,text,text[],timestamptz,timestamptz,text) to authenticated;
grant execute on function public.iq_v21_revoke_game_capture_delegation(uuid,text) to authenticated;
grant execute on function public.iq_v21_game_capture_snapshot(uuid) to authenticated;
grant execute on function public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb) to authenticated;

-- Extend existing sporting lifecycle authorization without delegating CANCEL_GAME.
create or replace function iq_private.game_play_state_actor_allowed(
  p_game_id uuid,
  p_target text
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  with game_scope as (
    select g.id,g.team_id,g.team_season_id,ts.season_id,t.club_id
    from public.games g
    left join public.team_seasons ts on ts.id=g.team_season_id
    left join public.teams t on t.id=g.team_id
    where g.id=p_game_id
  ), membership_roles as (
    select upper(m.function_role) role
    from game_scope gs
    join public.team_season_memberships m on m.team_season_id=gs.team_season_id
    where m.user_id=auth.uid()
      and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
      and (m.valid_from is null or m.valid_from<=now())
      and (m.valid_until is null or m.valid_until>now())
    union all
    select upper(cm.function_role) role
    from game_scope gs
    join public.club_season_memberships cm
      on cm.club_id=gs.club_id and cm.season_id=gs.season_id
    where cm.user_id=auth.uid()
      and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
      and (cm.valid_from is null or cm.valid_from<=now())
      and (cm.valid_until is null or cm.valid_until>now())
  )
  select auth.uid() is not null
    and public.iq_account_is_active()
    and (
      public.iq_v3_is_global_superadmin()
      or exists (
        select 1
        from membership_roles mr
        where case iq_private.game_play_state_action_for_target(p_target)
          when 'CANCEL_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR')
          when 'PREPARE_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          when 'START_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          when 'FINISH_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          else false
        end
      )
      or case iq_private.game_play_state_action_for_target(p_target)
        when 'PREPARE_GAME' then iq_v21_private.has_capability(p_game_id,'PREPARE_GAME')
        when 'START_GAME' then iq_v21_private.has_capability(p_game_id,'START_GAME')
        when 'FINISH_GAME' then iq_v21_private.has_capability(p_game_id,'FINISH_GAME')
        else false
      end
    );
$function$;
revoke all on function iq_private.game_play_state_actor_allowed(uuid,text) from public,anon,authenticated;

comment on table public.game_capture_delegations is
  'V21: time-bounded per-game capabilities for delegated capture operators.';
comment on function public.iq_v21_game_capture_snapshot(uuid) is
  'V21: minimal invoker RPC for authorized staff or a delegated operator.';
comment on function public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb) is
  'V21: scoped sporting save boundary; never changes administrative game metadata.';

commit;
