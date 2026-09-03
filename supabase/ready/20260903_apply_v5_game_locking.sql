-- =============================================================================
-- IQBasket V5 · Game locking lifecycle
-- Additive schema + backend enforcement for immutable closed games.
-- =============================================================================

begin;

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

create or replace function public.iq_v5_can_manage_game_lock(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.iq_v3_is_superadmin()
    or exists (
      select 1
      from public.games g
      where g.id = target_game_id
        and g.team_season_id is not null
        and public.iq_v3_has_team_season_role(
          g.team_season_id,
          array['ADMIN']::text[]
        )
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
      and g.team_season_id is not null
      and upper(coalesce(g.edit_state, 'OPEN')) = 'OPEN'
      and public.iq_v3_has_team_season_role(
        g.team_season_id,
        array['ENTRENADOR','ANALISTA']::text[]
      )
  );
$$;

-- Existing game/stat RLS helpers now include the immutable-state rule.
create or replace function public.iq_v3_can_edit_game(target_game_id uuid)
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
      and g.team_season_id is not null
      and upper(coalesce(g.edit_state, 'OPEN')) = 'OPEN'
      and public.iq_v3_has_team_season_role(
        g.team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
      )
  );
$$;

create or replace function public.iq_v3_can_delete_game(target_game_id uuid)
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
      and g.team_season_id is not null
      and upper(coalesce(g.edit_state, 'OPEN')) = 'OPEN'
      and public.iq_v3_has_team_season_role(
        g.team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
      )
  );
$$;

create or replace function public.iq_v5_guard_game_lock_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_state text := upper(coalesce(old.edit_state, 'OPEN'));
  v_new_state text := upper(coalesce(new.edit_state, 'OPEN'));
  v_role text := 'UNKNOWN';
  v_non_lock_old jsonb;
  v_non_lock_new jsonb;
begin
  new.edit_state := v_new_state;

  if v_old_state = 'LOCKED' and v_new_state = 'LOCKED' then
    raise exception 'GAME_LOCKED'
      using errcode = '42501';
  end if;

  if v_old_state is distinct from v_new_state then
    if not public.iq_v5_can_manage_game_lock(old.id) then
      raise exception 'GAME_LOCK_MANAGE_PERMISSION_REQUIRED'
        using errcode = '42501';
    end if;

    v_non_lock_old := to_jsonb(old)
      - array['edit_state','locked_at','locked_by','lock_reason','reopened_at','reopened_by'];
    v_non_lock_new := to_jsonb(new)
      - array['edit_state','locked_at','locked_by','lock_reason','reopened_at','reopened_by'];

    if v_non_lock_old is distinct from v_non_lock_new then
      raise exception 'GAME_LOCK_STATE_CHANGE_MUST_BE_ISOLATED'
        using errcode = '22023';
    end if;

    select coalesce(
      (
        select upper(m.function_role)
        from public.team_season_memberships m
        where m.user_id = auth.uid()
          and m.team_season_id = old.team_season_id
          and upper(m.status) = 'ACTIVE'
        order by case when upper(m.function_role)='ADMIN' then 0 else 1 end
        limit 1
      ),
      case when public.iq_v3_is_superadmin() then 'SUPERADMIN' else 'UNKNOWN' end
    )
    into v_role;

    if v_new_state = 'LOCKED' then
      new.locked_at := now();
      new.locked_by := auth.uid();
      new.reopened_at := null;
      new.reopened_by := null;

      insert into public.game_lock_history(
        game_id, action, actor_id, actor_role, reason
      )
      values (
        old.id, 'LOCKED', auth.uid(), v_role, new.lock_reason
      );
    elsif v_new_state = 'OPEN' then
      new.reopened_at := now();
      new.reopened_by := auth.uid();

      insert into public.game_lock_history(
        game_id, action, actor_id, actor_role, reason
      )
      values (
        old.id, 'REOPENED', auth.uid(), v_role, new.lock_reason
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
  v_team_season_id uuid;
  v_role text;
begin
  select g.team_season_id
  into v_team_season_id
  from public.games g
  where g.id = p_game_id
    and upper(coalesce(g.edit_state, 'OPEN')) = 'OPEN';

  if v_team_season_id is null then
    raise exception 'GAME_NOT_OPEN_OR_NOT_FOUND'
      using errcode = '22023';
  end if;

  if not public.iq_v5_can_request_game_lock(p_game_id) then
    raise exception 'GAME_LOCK_REQUEST_PERMISSION_REQUIRED'
      using errcode = '42501';
  end if;

  select upper(m.function_role)
  into v_role
  from public.team_season_memberships m
  where m.user_id = auth.uid()
    and m.team_season_id = v_team_season_id
    and upper(m.status) = 'ACTIVE'
    and upper(m.function_role) in ('ENTRENADOR','ANALISTA')
  order by case when upper(m.function_role)='ENTRENADOR' then 0 else 1 end
  limit 1;

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
    p_game_id, auth.uid(), coalesce(v_role, 'UNKNOWN'), nullif(trim(p_reason), '')
  )
  returning id into v_request_id;

  insert into public.game_lock_history(
    game_id, request_id, action, actor_id, actor_role, reason
  )
  values (
    p_game_id, v_request_id, 'REQUESTED', auth.uid(), coalesce(v_role, 'UNKNOWN'),
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
begin
  if v_target not in ('OPEN','LOCKED') then
    raise exception 'GAME_EDIT_STATE_INVALID'
      using errcode = '22023';
  end if;

  if not public.iq_v5_can_manage_game_lock(p_game_id) then
    raise exception 'GAME_LOCK_MANAGE_PERMISSION_REQUIRED'
      using errcode = '42501';
  end if;

  update public.games
  set
    edit_state = v_target,
    lock_reason = case
      when v_target = 'LOCKED' then coalesce(nullif(trim(p_reason), ''), lock_reason, 'Cierre manual')
      else coalesce(nullif(trim(p_reason), ''), lock_reason)
    end
  where id = p_game_id
    and upper(coalesce(edit_state, 'OPEN')) is distinct from v_target;

  if not found then
    if not exists (select 1 from public.games where id = p_game_id) then
      raise exception 'GAME_NOT_FOUND'
        using errcode = '22023';
    end if;
  end if;

  if v_target = 'LOCKED' then
    update public.game_lock_requests
    set status = 'APPROVED',
        resolved_at = now(),
        resolved_by = auth.uid(),
        resolution_note = coalesce(nullif(trim(p_reason), ''), resolution_note, 'Aprobada mediante cierre directo')
    where game_id = p_game_id
      and upper(status) = 'PENDING';
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
  v_actor_role text := 'ADMIN';
begin
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

  if public.iq_v3_is_superadmin() then
    v_actor_role := 'SUPERADMIN';
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
  set status = v_decision,
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
    case when v_decision='APPROVED' then 'REQUEST_APPROVED' else 'REQUEST_REJECTED' end,
    auth.uid(),
    v_actor_role,
    coalesce(nullif(trim(p_resolution_note), ''), v_request.request_reason)
  );
end;
$$;

alter table public.game_lock_requests enable row level security;
alter table public.game_lock_history enable row level security;

drop policy if exists "v5 game lock requests scoped read" on public.game_lock_requests;
create policy "v5 game lock requests scoped read"
on public.game_lock_requests for select
to authenticated
using (
  requested_by = auth.uid()
  or public.iq_v5_can_manage_game_lock(game_id)
);

drop policy if exists "v5 game lock history manager read" on public.game_lock_history;
create policy "v5 game lock history manager read"
on public.game_lock_history for select
to authenticated
using (public.iq_v5_can_manage_game_lock(game_id));

revoke all on function public.iq_v5_can_manage_game_lock(uuid) from public, anon;
revoke all on function public.iq_v5_can_request_game_lock(uuid) from public, anon;
revoke all on function public.iq_v5_request_game_lock(uuid,text) from public, anon;
revoke all on function public.iq_v5_set_game_edit_state(uuid,text,text) from public, anon;
revoke all on function public.iq_v5_resolve_game_lock_request(uuid,text,text) from public, anon;

grant execute on function public.iq_v5_can_manage_game_lock(uuid) to authenticated;
grant execute on function public.iq_v5_can_request_game_lock(uuid) to authenticated;
grant execute on function public.iq_v5_request_game_lock(uuid,text) to authenticated;
grant execute on function public.iq_v5_set_game_edit_state(uuid,text,text) to authenticated;
grant execute on function public.iq_v5_resolve_game_lock_request(uuid,text,text) to authenticated;

grant select on public.game_lock_requests to authenticated;
grant select on public.game_lock_history to authenticated;

commit;
