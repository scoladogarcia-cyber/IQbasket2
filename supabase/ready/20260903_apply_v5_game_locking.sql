-- =============================================================================
-- IQBasket V5 · Game locking lifecycle
-- Additive schema + RBAC v2 integration + defense-in-depth immutable game guards.
-- =============================================================================

begin;

-- 1) Additive game lifecycle metadata.
alter table public.games
  add column if not exists edit_state text not null default 'OPEN',
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid,
  add column if not exists lock_reason text,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid;

update public.games
set edit_state = 'OPEN'
where edit_state is null
   or upper(edit_state) not in ('OPEN','LOCKED');

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.games'::regclass
      and conname = 'games_edit_state_check'
  ) then
    alter table public.games
      add constraint games_edit_state_check
      check (upper(edit_state) in ('OPEN','LOCKED'));
  end if;
end
$constraint$;

-- 2) Request and immutable audit trail tables.
create table if not exists public.game_lock_requests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  requested_by uuid not null,
  requested_by_role text not null,
  request_reason text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  constraint game_lock_requests_status_check
    check (upper(status) in ('PENDING','APPROVED','REJECTED','CANCELLED'))
);

create unique index if not exists ux_game_lock_requests_one_pending
  on public.game_lock_requests(game_id)
  where upper(status) = 'PENDING';

create index if not exists ix_game_lock_requests_status_created
  on public.game_lock_requests(status, created_at);

create table if not exists public.game_lock_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  request_id uuid references public.game_lock_requests(id) on delete set null,
  action text not null,
  actor_id uuid,
  actor_role text,
  reason text,
  created_at timestamptz not null default now(),
  constraint game_lock_history_action_check
    check (upper(action) in (
      'REQUESTED','REQUEST_APPROVED','REQUEST_REJECTED','LOCKED','REOPENED'
    ))
);

create index if not exists ix_game_lock_history_game_created
  on public.game_lock_history(game_id, created_at desc);

-- 3) Self-contained RBAC helpers.
-- They mirror the currently used role/team scope without depending on historical
-- helper migrations that may not be installed in every environment.
create or replace function public.iq_v5_current_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.iq_v5_current_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := public.iq_v5_current_email();
  v_role text;
begin
  if v_email = 'scolado@nechigroup.com' then
    return 'SUPERADMIN';
  end if;

  select upper(coalesce(up.role, 'INVITADO'))
  into v_role
  from public.user_profiles up
  where lower(up.email) = v_email
  limit 1;

  return coalesce(v_role, 'INVITADO');
end;
$$;

create or replace function public.iq_v5_can_access_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.iq_v5_current_role() = 'SUPERADMIN'
    or exists (
      select 1
      from public.user_profiles up
      where lower(up.email) = public.iq_v5_current_email()
        and (
          up.team_id = target_team_id
          or target_team_id = any(coalesce(up.allowed_team_ids, '{}'::uuid[]))
          or (
            public.iq_v5_current_role() = 'ADMIN'
            and up.club_id is not null
            and exists (
              select 1
              from public.teams t
              where t.id = target_team_id
                and t.club_id = up.club_id
            )
          )
        )
    );
$$;

create or replace function public.iq_v5_can_manage_game_lock(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    where g.id = target_game_id
      and public.iq_v5_current_role() in ('SUPERADMIN','ADMIN')
      and public.iq_v5_can_access_team(g.team_id)
  );
$$;

create or replace function public.iq_v5_can_request_game_lock(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.games g
    where g.id = target_game_id
      and upper(coalesce(g.edit_state, 'OPEN')) = 'OPEN'
      and public.iq_v5_current_role() in ('ENTRENADOR','ANALISTA')
      and public.iq_v5_can_access_team(g.team_id)
  );
$$;

-- 4) Hard guard on the game row itself.
create or replace function public.iq_v5_guard_game_lock_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_state text := upper(coalesce(old.edit_state, 'OPEN'));
  v_new_state text := upper(coalesce(new.edit_state, 'OPEN'));
  v_non_lock_old jsonb;
  v_non_lock_new jsonb;
begin
  new.edit_state := v_new_state;

  -- A closed game cannot be edited in-place. Reopening is the only valid mutation.
  if v_old_state = 'LOCKED' and v_new_state = 'LOCKED' then
    raise exception 'GAME_LOCKED'
      using errcode = '42501';
  end if;

  if v_old_state is distinct from v_new_state then
    if not public.iq_v5_can_manage_game_lock(old.id) then
      raise exception 'GAME_LOCK_MANAGE_PERMISSION_REQUIRED'
        using errcode = '42501';
    end if;

    -- Opening/closing is an isolated lifecycle action, never a hidden data edit.
    v_non_lock_old := to_jsonb(old)
      - array['edit_state','locked_at','locked_by','lock_reason','reopened_at','reopened_by'];
    v_non_lock_new := to_jsonb(new)
      - array['edit_state','locked_at','locked_by','lock_reason','reopened_at','reopened_by'];

    if v_non_lock_old is distinct from v_non_lock_new then
      raise exception 'GAME_LOCK_STATE_CHANGE_MUST_BE_ISOLATED'
        using errcode = '22023';
    end if;

    if v_new_state = 'LOCKED' then
      new.locked_at := now();
      new.locked_by := auth.uid();
      new.reopened_at := null;
      new.reopened_by := null;

      insert into public.game_lock_history(
        game_id, action, actor_id, actor_role, reason
      )
      values (
        old.id, 'LOCKED', auth.uid(), public.iq_v5_current_role(), new.lock_reason
      );
    elsif v_new_state = 'OPEN' then
      new.reopened_at := now();
      new.reopened_by := auth.uid();

      insert into public.game_lock_history(
        game_id, action, actor_id, actor_role, reason
      )
      values (
        old.id, 'REOPENED', auth.uid(), public.iq_v5_current_role(), new.lock_reason
      );
    else
      raise exception 'GAME_EDIT_STATE_INVALID'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_iq_v5_guard_game_lock_transition on public.games;
create trigger trg_iq_v5_guard_game_lock_transition
before update on public.games
for each row
execute function public.iq_v5_guard_game_lock_transition();

create or replace function public.iq_v5_guard_locked_game_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if upper(coalesce(old.edit_state, 'OPEN')) = 'LOCKED' then
    raise exception 'GAME_LOCKED'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_iq_v5_guard_locked_game_delete on public.games;
create trigger trg_iq_v5_guard_locked_game_delete
before delete on public.games
for each row
execute function public.iq_v5_guard_locked_game_delete();

-- 5) Hard guards on every mutable child resource.
create or replace function public.iq_v5_guard_locked_game_child_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
begin
  if tg_op = 'DELETE' then
    v_game_id := old.game_id;
  else
    v_game_id := new.game_id;
  end if;

  if exists (
    select 1
    from public.games g
    where g.id = v_game_id
      and upper(coalesce(g.edit_state, 'OPEN')) = 'LOCKED'
  ) then
    raise exception 'GAME_LOCKED'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $child_triggers$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array[
    'player_game_stats',
    'team_game_stats',
    'game_events',
    'game_period_scores',
    'lineup_game_stats',
    'play_by_play_events'
  ]
  loop
    v_trigger := 'trg_iq_v5_lock_' || v_table;
    execute format('drop trigger if exists %I on public.%I', v_trigger, v_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I
       for each row execute function public.iq_v5_guard_locked_game_child_write()',
      v_trigger,
      v_table
    );
  end loop;
end
$child_triggers$;

-- 6) Restrictive RLS guards add an AND condition to the currently installed
-- permissive RBAC v2 policies. Triggers above remain the final authority.
drop policy if exists "v5 games open update guard" on public.games;
create policy "v5 games open update guard"
on public.games
as restrictive
for update
to authenticated
using (upper(coalesce(edit_state, 'OPEN')) = 'OPEN')
with check (upper(coalesce(edit_state, 'OPEN')) = 'OPEN');

drop policy if exists "v5 games open delete guard" on public.games;
create policy "v5 games open delete guard"
on public.games
as restrictive
for delete
to authenticated
using (upper(coalesce(edit_state, 'OPEN')) = 'OPEN');

do $child_policies$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array[
    'player_game_stats',
    'team_game_stats',
    'game_events',
    'game_period_scores',
    'lineup_game_stats',
    'play_by_play_events'
  ]
  loop
    v_policy := 'v5 ' || v_table || ' open insert guard';
    execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
       with check (
         exists (
           select 1 from public.games g
           where g.id = game_id
             and upper(coalesce(g.edit_state, ''OPEN'')) = ''OPEN''
         )
       )',
      v_policy, v_table
    );

    v_policy := 'v5 ' || v_table || ' open update guard';
    execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated
       using (
         exists (
           select 1 from public.games g
           where g.id = game_id
             and upper(coalesce(g.edit_state, ''OPEN'')) = ''OPEN''
         )
       )
       with check (
         exists (
           select 1 from public.games g
           where g.id = game_id
             and upper(coalesce(g.edit_state, ''OPEN'')) = ''OPEN''
         )
       )',
      v_policy, v_table
    );

    v_policy := 'v5 ' || v_table || ' open delete guard';
    execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated
       using (
         exists (
           select 1 from public.games g
           where g.id = game_id
             and upper(coalesce(g.edit_state, ''OPEN'')) = ''OPEN''
         )
       )',
      v_policy, v_table
    );
  end loop;
end
$child_policies$;

-- 7) Workflow RPCs.
create or replace function public.iq_v5_request_game_lock(
  p_game_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED'
      using errcode = '42501';
  end if;

  if not public.iq_v5_can_request_game_lock(p_game_id) then
    raise exception 'GAME_LOCK_REQUEST_PERMISSION_REQUIRED'
      using errcode = '42501';
  end if;

  select r.id
  into v_request_id
  from public.game_lock_requests r
  where r.game_id = p_game_id
    and upper(r.status) = 'PENDING'
  limit 1;

  if v_request_id is not null then
    return v_request_id;
  end if;

  insert into public.game_lock_requests(
    game_id, requested_by, requested_by_role, request_reason
  )
  values (
    p_game_id,
    auth.uid(),
    public.iq_v5_current_role(),
    nullif(trim(p_reason), '')
  )
  returning id into v_request_id;

  insert into public.game_lock_history(
    game_id, request_id, action, actor_id, actor_role, reason
  )
  values (
    p_game_id,
    v_request_id,
    'REQUESTED',
    auth.uid(),
    public.iq_v5_current_role(),
    nullif(trim(p_reason), '')
  );

  return v_request_id;
end;
$$;

create or replace function public.iq_v5_set_game_edit_state(
  p_game_id uuid,
  p_target_state text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text := upper(coalesce(p_target_state, ''));
  v_pending_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED'
      using errcode = '42501';
  end if;

  if v_target not in ('OPEN','LOCKED') then
    raise exception 'GAME_EDIT_STATE_INVALID'
      using errcode = '22023';
  end if;

  if not public.iq_v5_can_manage_game_lock(p_game_id) then
    raise exception 'GAME_LOCK_MANAGE_PERMISSION_REQUIRED'
      using errcode = '42501';
  end if;

  if v_target = 'LOCKED' then
    select r.id
    into v_pending_request_id
    from public.game_lock_requests r
    where r.game_id = p_game_id
      and upper(r.status) = 'PENDING'
    order by r.created_at
    limit 1;
  end if;

  update public.games
  set
    edit_state = v_target,
    lock_reason = case
      when v_target = 'LOCKED'
        then coalesce(nullif(trim(p_reason), ''), lock_reason, 'Cierre manual')
      else coalesce(nullif(trim(p_reason), ''), lock_reason)
    end
  where id = p_game_id
    and upper(coalesce(edit_state, 'OPEN')) is distinct from v_target;

  if not found and not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'GAME_NOT_FOUND'
      using errcode = '22023';
  end if;

  if v_target = 'LOCKED' and v_pending_request_id is not null then
    update public.game_lock_requests
    set
      status = 'APPROVED',
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_note = coalesce(
        nullif(trim(p_reason), ''),
        resolution_note,
        'Aprobada mediante cierre directo'
      )
    where id = v_pending_request_id
      and upper(status) = 'PENDING';

    insert into public.game_lock_history(
      game_id, request_id, action, actor_id, actor_role, reason
    )
    values (
      p_game_id,
      v_pending_request_id,
      'REQUEST_APPROVED',
      auth.uid(),
      public.iq_v5_current_role(),
      nullif(trim(p_reason), '')
    );
  end if;
end;
$$;

create or replace function public.iq_v5_resolve_game_lock_request(
  p_request_id uuid,
  p_decision text,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.game_lock_requests%rowtype;
  v_decision text := upper(coalesce(p_decision, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED'
      using errcode = '42501';
  end if;

  if v_decision not in ('APPROVED','REJECTED') then
    raise exception 'GAME_LOCK_REQUEST_DECISION_INVALID'
      using errcode = '22023';
  end if;

  select *
  into v_request
  from public.game_lock_requests
  where id = p_request_id
    and upper(status) = 'PENDING'
  for update;

  if not found then
    raise exception 'GAME_LOCK_REQUEST_NOT_PENDING'
      using errcode = '22023';
  end if;

  if not public.iq_v5_can_manage_game_lock(v_request.game_id) then
    raise exception 'GAME_LOCK_MANAGE_PERMISSION_REQUIRED'
      using errcode = '42501';
  end if;

  if v_decision = 'APPROVED' then
    update public.games
    set
      edit_state = 'LOCKED',
      lock_reason = coalesce(
        nullif(trim(p_resolution_note), ''),
        v_request.request_reason,
        'Cierre aprobado'
      )
    where id = v_request.game_id
      and upper(coalesce(edit_state, 'OPEN')) = 'OPEN';
  end if;

  update public.game_lock_requests
  set
    status = v_decision,
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = nullif(trim(p_resolution_note), '')
  where id = p_request_id;

  insert into public.game_lock_history(
    game_id, request_id, action, actor_id, actor_role, reason
  )
  values (
    v_request.game_id,
    p_request_id,
    case
      when v_decision = 'APPROVED' then 'REQUEST_APPROVED'
      else 'REQUEST_REJECTED'
    end,
    auth.uid(),
    public.iq_v5_current_role(),
    coalesce(nullif(trim(p_resolution_note), ''), v_request.request_reason)
  );
end;
$$;

-- 8) Request/audit visibility and grants.
alter table public.game_lock_requests enable row level security;
alter table public.game_lock_history enable row level security;

drop policy if exists "v5 game lock requests scoped read" on public.game_lock_requests;
create policy "v5 game lock requests scoped read"
on public.game_lock_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or public.iq_v5_can_manage_game_lock(game_id)
);

drop policy if exists "v5 game lock history manager read" on public.game_lock_history;
create policy "v5 game lock history manager read"
on public.game_lock_history
for select
to authenticated
using (public.iq_v5_can_manage_game_lock(game_id));

revoke all on function public.iq_v5_current_email() from public, anon;
revoke all on function public.iq_v5_current_role() from public, anon;
revoke all on function public.iq_v5_can_access_team(uuid) from public, anon;
revoke all on function public.iq_v5_can_manage_game_lock(uuid) from public, anon;
revoke all on function public.iq_v5_can_request_game_lock(uuid) from public, anon;
revoke all on function public.iq_v5_request_game_lock(uuid,text) from public, anon;
revoke all on function public.iq_v5_set_game_edit_state(uuid,text,text) from public, anon;
revoke all on function public.iq_v5_resolve_game_lock_request(uuid,text,text) from public, anon;

grant execute on function public.iq_v5_current_email() to authenticated;
grant execute on function public.iq_v5_current_role() to authenticated;
grant execute on function public.iq_v5_can_access_team(uuid) to authenticated;
grant execute on function public.iq_v5_can_manage_game_lock(uuid) to authenticated;
grant execute on function public.iq_v5_can_request_game_lock(uuid) to authenticated;
grant execute on function public.iq_v5_request_game_lock(uuid,text) to authenticated;
grant execute on function public.iq_v5_set_game_edit_state(uuid,text,text) to authenticated;
grant execute on function public.iq_v5_resolve_game_lock_request(uuid,text,text) to authenticated;

grant select on public.game_lock_requests to authenticated;
grant select on public.game_lock_history to authenticated;

commit;
