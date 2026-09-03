-- =============================================================================
-- IQBasket V6 · TEAM-SEASON FREEZE LIFECYCLE
-- Purpose: auditable season data freeze without hiding historical seasons.
-- Scope V1: games + competitive roster integrity.
-- =============================================================================
begin;

do $$
begin
  if to_regclass('public.team_seasons') is null
     or to_regclass('public.games') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.roster_membership_stints') is null
     or to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null
     or to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null
     or to_regprocedure('public.iq_v5_set_game_edit_state(uuid,text,text)') is null
     or to_regprocedure('public.iq_v5_role_for_game(uuid)') is null then
    raise exception 'TEAM_SEASON_FREEZE_PREREQUISITES_MISSING';
  end if;

  if exists (
    select 1 from public.team_seasons
    where upper(coalesce(data_status,'ACTIVE')) not in ('ACTIVE','FROZEN')
  ) then
    raise exception 'TEAM_SEASON_DATA_STATUS_UNKNOWN';
  end if;
end $$;

-- 1. Additive lifecycle metadata. data_status already exists and remains the
-- separation between visibility (status) and editability (data_status).
alter table public.team_seasons
  add column if not exists frozen_at timestamptz,
  add column if not exists frozen_by uuid,
  add column if not exists freeze_reason text,
  add column if not exists freeze_token uuid,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.team_seasons'::regclass
      and conname='team_seasons_data_status_v6_check'
  ) then
    alter table public.team_seasons
      add constraint team_seasons_data_status_v6_check
      check (upper(coalesce(data_status,'ACTIVE')) in ('ACTIVE','FROZEN'));
  end if;
end
$constraint$;

-- 2. Requests and immutable audit history.
create table if not exists public.team_season_freeze_requests (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  requested_by uuid not null,
  requested_by_role text,
  request_reason text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  constraint team_season_freeze_requests_status_check
    check (upper(status) in ('PENDING','APPROVED','REJECTED','CANCELLED'))
);

create unique index if not exists uq_team_season_freeze_pending
  on public.team_season_freeze_requests(team_season_id)
  where upper(status)='PENDING';

create index if not exists idx_team_season_freeze_requests_scope
  on public.team_season_freeze_requests(team_season_id, created_at desc);

create table if not exists public.team_season_freeze_history (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  request_id uuid references public.team_season_freeze_requests(id) on delete set null,
  action text not null,
  actor_id uuid,
  actor_role text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint team_season_freeze_history_action_check
    check (upper(action) in (
      'REQUESTED','REQUEST_APPROVED','REQUEST_REJECTED','FROZEN','REOPENED'
    ))
);

create index if not exists idx_team_season_freeze_history_scope
  on public.team_season_freeze_history(team_season_id, created_at desc);

-- 3. Context role helper. Admin-like governance roles map to ADMIN so backend
-- remains consistent with the frontend contextual RBAC abstraction.
create or replace function public.iq_v6_role_for_team_season(
  p_team_season_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text;
begin
  if public.iq_v5_current_role() = 'SUPERADMIN' then
    return 'SUPERADMIN';
  end if;

  select upper(m.function_role)
  into v_role
  from public.team_season_memberships m
  where m.team_season_id=p_team_season_id
    and m.user_id=auth.uid()
    and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(m.function_role,'')) in (
      'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA'
    )
  order by case
    when upper(m.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO') then 1
    when upper(m.function_role)='ENTRENADOR' then 2
    when upper(m.function_role)='ANALISTA' then 3
    else 10 end
  limit 1;

  if v_role is not null then
    return v_role;
  end if;

  select upper(cm.function_role)
  into v_role
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id
  join public.club_season_memberships cm
    on cm.club_id=t.club_id and cm.season_id=ts.season_id
  where ts.id=p_team_season_id
    and cm.user_id=auth.uid()
    and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(cm.function_role,'')) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO')
  limit 1;

  return coalesce(v_role, public.iq_v5_current_role());
end;
$$;

create or replace function public.iq_v6_can_manage_team_season_freeze(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    auth.uid() is not null
    and public.iq_v6_role_for_team_season(p_team_season_id) in ('SUPERADMIN','ADMIN')
    and public.iq_v3_can_manage_team_season(p_team_season_id);
$$;

create or replace function public.iq_v6_can_request_team_season_freeze(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $
  select
    auth.uid() is not null
    and exists (
      select 1 from public.team_seasons ts
      where ts.id=p_team_season_id
        and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    )
    and exists (
      select 1
      from public.team_season_memberships m
      where m.team_season_id=p_team_season_id
        and m.user_id=auth.uid()
        and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
        and upper(coalesce(m.function_role,'')) in ('ENTRENADOR','ANALISTA')
    );
$;

create or replace function public.iq_v6_team_season_freeze_capabilities()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'ready', true,
    'team_season_freeze', true,
    'workflow_version', 'TEAM_SEASON_FREEZE_V1',
    'data_status_open', 'ACTIVE',
    'data_status_frozen', 'FROZEN',
    'scope', 'GAMES_AND_ROSTER'
  );
$$;

-- 4. Frozen roster is immutable even for SUPERADMIN. Reopening the season is
-- the explicit lifecycle action that re-enables roster changes.
create or replace function public.iq_v3_can_manage_roster(
  target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1 from public.team_seasons ts
      where ts.id=target_team_season_id
        and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    )
    and (
      exists (
        select 1 from public.user_profiles up
        where up.id=auth.uid()
          and upper(coalesce(up.global_role,up.role,'USER'))='SUPERADMIN'
      )
      or exists (
        select 1 from public.team_season_memberships m
        where m.user_id=auth.uid()
          and m.team_season_id=target_team_season_id
          and upper(m.status)='ACTIVE'
          and upper(m.function_role) in (
            'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE'
          )
      )
      or exists (
        select 1
        from public.team_seasons ts
        join public.teams t on t.id=ts.team_id
        join public.club_season_memberships cm
          on cm.club_id=t.club_id and cm.season_id=ts.season_id
        where ts.id=target_team_season_id
          and cm.user_id=auth.uid()
          and upper(cm.status)='ACTIVE'
          and upper(cm.function_role) in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO')
      )
    );
$$;

-- 5. Defense-in-depth: block direct game and roster writes while frozen.
create or replace function public.iq_v6_guard_frozen_team_season_game()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_old_scope uuid;
  v_new_scope uuid;
begin
  if tg_op <> 'INSERT' then v_old_scope := old.team_season_id; end if;
  if tg_op <> 'DELETE' then v_new_scope := new.team_season_id; end if;

  if exists (
    select 1 from public.team_seasons ts
    where ts.id in (v_old_scope,v_new_scope)
      and upper(coalesce(ts.data_status,'ACTIVE'))='FROZEN'
  ) then
    raise exception 'TEAM_SEASON_FROZEN'
      using errcode='42501';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_iq_v6_guard_frozen_team_season_game on public.games;
create trigger trg_iq_v6_guard_frozen_team_season_game
before insert or update or delete on public.games
for each row execute function public.iq_v6_guard_frozen_team_season_game();

create or replace function public.iq_v6_guard_frozen_roster_membership()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_scope uuid;
begin
  v_scope := case when tg_op='DELETE' then old.team_season_id else new.team_season_id end;
  if exists (
    select 1 from public.team_seasons ts
    where ts.id=v_scope
      and upper(coalesce(ts.data_status,'ACTIVE'))='FROZEN'
  ) then
    raise exception 'TEAM_SEASON_FROZEN'
      using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_iq_v6_guard_frozen_roster_membership on public.roster_memberships;
create trigger trg_iq_v6_guard_frozen_roster_membership
before insert or update or delete on public.roster_memberships
for each row execute function public.iq_v6_guard_frozen_roster_membership();

create or replace function public.iq_v6_guard_frozen_roster_stint()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_membership_id uuid;
  v_scope uuid;
begin
  v_membership_id := case
    when tg_op='DELETE' then old.roster_membership_id
    else new.roster_membership_id
  end;

  select rm.team_season_id into v_scope
  from public.roster_memberships rm
  where rm.id=v_membership_id;

  if exists (
    select 1 from public.team_seasons ts
    where ts.id=v_scope
      and upper(coalesce(ts.data_status,'ACTIVE'))='FROZEN'
  ) then
    raise exception 'TEAM_SEASON_FROZEN'
      using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_iq_v6_guard_frozen_roster_stint on public.roster_membership_stints;
create trigger trg_iq_v6_guard_frozen_roster_stint
before insert or update or delete on public.roster_membership_stints
for each row execute function public.iq_v6_guard_frozen_roster_stint();

-- Restrictive policy prevents normal authenticated game creation in frozen scopes.
drop policy if exists "v6 games unfrozen insert guard" on public.games;
create policy "v6 games unfrozen insert guard"
on public.games as restrictive for insert to authenticated
with check (
  exists (
    select 1 from public.team_seasons ts
    where ts.id=team_season_id
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  )
);

-- 6. Request workflow.
create or replace function public.iq_v6_request_team_season_freeze(
  p_team_season_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v6_can_request_team_season_freeze(p_team_season_id) then
    raise exception 'TEAM_SEASON_FREEZE_REQUEST_DENIED';
  end if;

  insert into public.team_season_freeze_requests(
    team_season_id,requested_by,requested_by_role,request_reason
  )
  values(
    p_team_season_id,auth.uid(),public.iq_v6_role_for_team_season(p_team_season_id),
    nullif(trim(p_reason),'')
  )
  returning id into v_id;

  insert into public.team_season_freeze_history(
    team_season_id,request_id,action,actor_id,actor_role,reason
  )
  values(
    p_team_season_id,v_id,'REQUESTED',auth.uid(),
    public.iq_v6_role_for_team_season(p_team_season_id),nullif(trim(p_reason),'')
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'TEAM_SEASON_FREEZE_REQUEST_ALREADY_PENDING';
end;
$$;

-- 7. Direct freeze/reopen. Games locked by this lifecycle carry a unique token.
create or replace function public.iq_v6_set_team_season_data_state(
  p_team_season_id uuid,
  p_target_state text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_target text := upper(trim(coalesce(p_target_state,'')));
  v_scope public.team_seasons%rowtype;
  v_token uuid;
  v_game record;
  v_games_changed integer := 0;
  v_pending_request uuid;
  v_reason text := nullif(trim(p_reason),'');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_target not in ('ACTIVE','FROZEN') then
    raise exception 'TEAM_SEASON_DATA_STATE_INVALID';
  end if;
  if not public.iq_v6_can_manage_team_season_freeze(p_team_season_id) then
    raise exception 'TEAM_SEASON_FREEZE_MANAGE_DENIED';
  end if;

  select * into v_scope
  from public.team_seasons
  where id=p_team_season_id
  for update;

  if v_scope.id is null then raise exception 'TEAM_SEASON_NOT_FOUND'; end if;

  if upper(coalesce(v_scope.data_status,'ACTIVE'))=v_target then
    return jsonb_build_object(
      'team_season_id',p_team_season_id,
      'data_status',v_target,
      'games_changed',0,
      'no_change',true
    );
  end if;

  if v_target='FROZEN' then
    v_token := gen_random_uuid();

    -- Games are locked while the season is still ACTIVE, so existing V5 guards
    -- allow this isolated lifecycle transition.
    for v_game in
      select id from public.games
      where team_season_id=p_team_season_id
        and upper(coalesce(edit_state,'OPEN'))='OPEN'
      order by id
    loop
      perform public.iq_v5_set_game_edit_state(
        v_game.id,
        'LOCKED',
        'TEAM_SEASON_FREEZE:' || v_token::text ||
          case when v_reason is null then '' else ':' || v_reason end
      );
      v_games_changed := v_games_changed + 1;
    end loop;

    update public.team_seasons
    set data_status='FROZEN',
        frozen_at=now(),
        frozen_by=auth.uid(),
        freeze_reason=coalesce(v_reason,'Cierre de temporada'),
        freeze_token=v_token,
        reopened_at=null,
        reopened_by=null,
        updated_at=now()
    where id=p_team_season_id;

    select id into v_pending_request
    from public.team_season_freeze_requests
    where team_season_id=p_team_season_id
      and upper(status)='PENDING'
    order by created_at
    limit 1
    for update;

    if v_pending_request is not null then
      update public.team_season_freeze_requests
      set status='APPROVED',
          resolved_at=now(),
          resolved_by=auth.uid(),
          resolution_note=coalesce(v_reason,'Cierre aprobado')
      where id=v_pending_request;

      insert into public.team_season_freeze_history(
        team_season_id,request_id,action,actor_id,actor_role,reason
      )
      values(
        p_team_season_id,v_pending_request,'REQUEST_APPROVED',auth.uid(),
        public.iq_v6_role_for_team_season(p_team_season_id),v_reason
      );
    end if;

    insert into public.team_season_freeze_history(
      team_season_id,request_id,action,actor_id,actor_role,reason,metadata
    )
    values(
      p_team_season_id,v_pending_request,'FROZEN',auth.uid(),
      public.iq_v6_role_for_team_season(p_team_season_id),
      coalesce(v_reason,'Cierre de temporada'),
      jsonb_build_object('freeze_token',v_token,'games_locked',v_games_changed)
    );
  else
    v_token := v_scope.freeze_token;

    -- Thaw scope first. Only games tagged by this exact freeze cycle are reopened.
    update public.team_seasons
    set data_status='ACTIVE',
        reopened_at=now(),
        reopened_by=auth.uid(),
        freeze_token=null,
        updated_at=now()
    where id=p_team_season_id;

    if v_token is not null then
      for v_game in
        select id from public.games
        where team_season_id=p_team_season_id
          and upper(coalesce(edit_state,'OPEN'))='LOCKED'
          and coalesce(lock_reason,'') like 'TEAM_SEASON_FREEZE:' || v_token::text || '%'
        order by id
      loop
        perform public.iq_v5_set_game_edit_state(
          v_game.id,
          'OPEN',
          'TEAM_SEASON_REOPEN:' || v_token::text ||
            case when v_reason is null then '' else ':' || v_reason end
        );
        v_games_changed := v_games_changed + 1;
      end loop;
    end if;

    insert into public.team_season_freeze_history(
      team_season_id,action,actor_id,actor_role,reason,metadata
    )
    values(
      p_team_season_id,'REOPENED',auth.uid(),
      public.iq_v6_role_for_team_season(p_team_season_id),
      coalesce(v_reason,'Reapertura de temporada'),
      jsonb_build_object('freeze_token',v_token,'games_reopened',v_games_changed)
    );
  end if;

  return jsonb_build_object(
    'team_season_id',p_team_season_id,
    'data_status',v_target,
    'games_changed',v_games_changed,
    'freeze_token',case when v_target='FROZEN' then v_token else null end,
    'no_change',false
  );
end;
$$;

create or replace function public.iq_v6_resolve_team_season_freeze_request(
  p_request_id uuid,
  p_decision text,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request public.team_season_freeze_requests%rowtype;
  v_decision text := upper(trim(coalesce(p_decision,'')));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_decision not in ('APPROVED','REJECTED') then
    raise exception 'TEAM_SEASON_FREEZE_DECISION_INVALID';
  end if;

  select * into v_request
  from public.team_season_freeze_requests
  where id=p_request_id
    and upper(status)='PENDING'
  for update;

  if v_request.id is null then
    raise exception 'TEAM_SEASON_FREEZE_REQUEST_NOT_PENDING';
  end if;

  if not public.iq_v6_can_manage_team_season_freeze(v_request.team_season_id) then
    raise exception 'TEAM_SEASON_FREEZE_MANAGE_DENIED';
  end if;

  if v_decision='APPROVED' then
    v_result := public.iq_v6_set_team_season_data_state(
      v_request.team_season_id,'FROZEN',
      coalesce(nullif(trim(p_resolution_note),''),v_request.request_reason,'Cierre aprobado')
    );
    return v_result;
  end if;

  update public.team_season_freeze_requests
  set status='REJECTED',
      resolved_at=now(),
      resolved_by=auth.uid(),
      resolution_note=nullif(trim(p_resolution_note),'')
  where id=p_request_id;

  insert into public.team_season_freeze_history(
    team_season_id,request_id,action,actor_id,actor_role,reason
  )
  values(
    v_request.team_season_id,p_request_id,'REQUEST_REJECTED',auth.uid(),
    public.iq_v6_role_for_team_season(v_request.team_season_id),
    coalesce(nullif(trim(p_resolution_note),''),v_request.request_reason)
  );

  return jsonb_build_object(
    'team_season_id',v_request.team_season_id,
    'decision','REJECTED'
  );
end;
$$;

-- 8. RLS + grants. Direct authenticated writes are never required.
alter table public.team_season_freeze_requests enable row level security;
alter table public.team_season_freeze_history enable row level security;

drop policy if exists iq_v6_team_season_freeze_requests_read
  on public.team_season_freeze_requests;
create policy iq_v6_team_season_freeze_requests_read
  on public.team_season_freeze_requests
  for select to authenticated
  using (
    requested_by=auth.uid()
    or public.iq_v6_can_manage_team_season_freeze(team_season_id)
  );

drop policy if exists iq_v6_team_season_freeze_history_read
  on public.team_season_freeze_history;
create policy iq_v6_team_season_freeze_history_read
  on public.team_season_freeze_history
  for select to authenticated
  using (
    actor_id=auth.uid()
    or public.iq_v6_can_manage_team_season_freeze(team_season_id)
  );

revoke all on table public.team_season_freeze_requests from anon;
revoke all on table public.team_season_freeze_history from anon;
revoke insert,update,delete,truncate,references,trigger
  on public.team_season_freeze_requests from authenticated;
revoke insert,update,delete,truncate,references,trigger
  on public.team_season_freeze_history from authenticated;
grant select on public.team_season_freeze_requests to authenticated;
grant select on public.team_season_freeze_history to authenticated;

revoke all on function public.iq_v6_role_for_team_season(uuid) from public,anon;
revoke all on function public.iq_v6_can_manage_team_season_freeze(uuid) from public,anon;
revoke all on function public.iq_v6_can_request_team_season_freeze(uuid) from public,anon;
revoke all on function public.iq_v6_team_season_freeze_capabilities() from public,anon;
revoke all on function public.iq_v6_request_team_season_freeze(uuid,text) from public,anon;
revoke all on function public.iq_v6_set_team_season_data_state(uuid,text,text) from public,anon;
revoke all on function public.iq_v6_resolve_team_season_freeze_request(uuid,text,text) from public,anon;

grant execute on function public.iq_v6_role_for_team_season(uuid) to authenticated;
grant execute on function public.iq_v6_can_manage_team_season_freeze(uuid) to authenticated;
grant execute on function public.iq_v6_can_request_team_season_freeze(uuid) to authenticated;
grant execute on function public.iq_v6_team_season_freeze_capabilities() to authenticated;
grant execute on function public.iq_v6_request_team_season_freeze(uuid,text) to authenticated;
grant execute on function public.iq_v6_set_team_season_data_state(uuid,text,text) to authenticated;
grant execute on function public.iq_v6_resolve_team_season_freeze_request(uuid,text,text) to authenticated;

commit;

select 'TEAM_SEASON_FREEZE_APPLY' as section, true as applied;
