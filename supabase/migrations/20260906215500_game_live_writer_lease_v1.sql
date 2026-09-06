-- =============================================================================
-- IQBasket · Game Live Writer Lease V1 (V28)
-- Single-writer lease for LIVE games, with heartbeat and secure handoff.
-- Keeps V21 permission delegation and historical edit locking independent.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- Preconditions
-- -----------------------------------------------------------------------------
do $prereq$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.team_seasons') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('iq_private.can_mutate_game(uuid)') is null
     or to_regprocedure('iq_v21_private.has_capability(uuid,text)') is null
     or to_regprocedure('iq_v21_private.can_manage(uuid)') is null
     or to_regprocedure('iq_v21_private.can_access_snapshot(uuid)') is null
     or to_regprocedure('iq_v21_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is null
     or to_regprocedure('public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'GAME_LIVE_WRITER_LEASE_V1_PREREQUISITES_MISSING';
  end if;
end
$prereq$;

-- -----------------------------------------------------------------------------
-- Current lease. One row per game; history lives in game_live_session_events.
-- -----------------------------------------------------------------------------
create table if not exists public.game_live_sessions (
  game_id uuid primary key references public.games(id) on delete cascade,
  writer_user_id uuid not null references public.user_profiles(id) on delete cascade,
  lease_token_hash text not null,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  lease_expires_at timestamptz not null,
  released_at timestamptz,
  release_reason text,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint game_live_sessions_hash_check check (char_length(lease_token_hash)=64),
  constraint game_live_sessions_expiry_check check (lease_expires_at>acquired_at),
  constraint game_live_sessions_reason_check check (
    release_reason is null or char_length(release_reason)<=500
  )
);

create index if not exists game_live_sessions_writer_idx
  on public.game_live_sessions(writer_user_id,lease_expires_at desc);

create table if not exists public.game_live_session_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  writer_user_id uuid not null references public.user_profiles(id) on delete restrict,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  action text not null check (
    action in (
      'ACQUIRED','EXPIRED_TAKEOVER','FORCED_TAKEOVER',
      'RELEASED','HANDOFF_CREATED','HANDED_OFF'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_live_session_events_game_idx
  on public.game_live_session_events(game_id,created_at desc);

create table if not exists public.game_live_handoffs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  from_user_id uuid not null references public.user_profiles(id) on delete restrict,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid references public.user_profiles(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.user_profiles(id) on delete set null,
  constraint game_live_handoffs_hash_check check (char_length(token_hash)=64),
  constraint game_live_handoffs_expiry_check check (expires_at>created_at)
);

create index if not exists game_live_handoffs_lookup_idx
  on public.game_live_handoffs(game_id,expires_at desc)
  where consumed_at is null and cancelled_at is null;

alter table public.game_live_sessions enable row level security;
alter table public.game_live_session_events enable row level security;
alter table public.game_live_handoffs enable row level security;

revoke all on table public.game_live_sessions from public,anon,authenticated;
revoke all on table public.game_live_session_events from public,anon,authenticated;
revoke all on table public.game_live_handoffs from public,anon,authenticated;

create policy iq_game_live_sessions_no_direct_client_access
  on public.game_live_sessions for all to anon,authenticated
  using(false) with check(false);
create policy iq_game_live_session_events_no_direct_client_access
  on public.game_live_session_events for all to anon,authenticated
  using(false) with check(false);
create policy iq_game_live_handoffs_no_direct_client_access
  on public.game_live_handoffs for all to anon,authenticated
  using(false) with check(false);

-- -----------------------------------------------------------------------------
-- Private implementation boundary
-- -----------------------------------------------------------------------------
create schema if not exists iq_v28_private;
revoke all on schema iq_v28_private from public,anon,authenticated;
grant usage on schema iq_v28_private to authenticated;

create or replace function iq_v28_private.token_hash(p_token text)
returns text
language sql
immutable
security definer
set search_path=''
as $function$
  select encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
$function$;

create or replace function iq_v28_private.can_record(p_game_id uuid)
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
        and upper(coalesce(g.edit_state,'OPEN'))='OPEN'
        and not exists (
          select 1
          from public.team_seasons ts
          where ts.id=g.team_season_id
            and upper(coalesce(ts.data_status,'ACTIVE'))<>'ACTIVE'
        )
        and (
          iq_private.can_mutate_game(p_game_id)
          or iq_v21_private.has_capability(p_game_id,'RECORD_LIVE_GAME')
        )
    );
$function$;

create or replace function iq_v28_private.status(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_session public.game_live_sessions%rowtype;
  v_name text;
  v_active boolean:=false;
begin
  if not iq_v21_private.can_access_snapshot(p_game_id) then
    raise exception 'GAME_LIVE_SESSION_STATUS_DENIED' using errcode='42501';
  end if;

  select * into v_session
  from public.game_live_sessions
  where game_id=p_game_id;

  if v_session.game_id is not null
     and v_session.released_at is null
     and v_session.lease_expires_at>now() then
    v_active:=true;
    select nullif(trim(concat_ws(' ',up.first_name,up.last_name)),'')
      into v_name
    from public.user_profiles up
    where up.id=v_session.writer_user_id;
  end if;

  return jsonb_build_object(
    'game_id',p_game_id,
    'active',v_active,
    'writer_user_id',case when v_active then v_session.writer_user_id else null end,
    'writer_name',case when v_active then coalesce(v_name,'Usuario autorizado') else null end,
    'is_mine',v_active and v_session.writer_user_id=auth.uid(),
    'acquired_at',case when v_active then v_session.acquired_at else null end,
    'heartbeat_at',case when v_active then v_session.heartbeat_at else null end,
    'lease_expires_at',case when v_active then v_session.lease_expires_at else null end,
    'version',case when v_active then v_session.version else null end
  );
end
$function$;

create or replace function iq_v28_private.acquire(
  p_game_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_current public.game_live_sessions%rowtype;
  v_token text;
  v_hash text;
  v_expiry timestamptz:=now()+interval '90 seconds';
  v_action text:='ACQUIRED';
begin
  if not iq_v28_private.can_record(p_game_id) then
    raise exception 'GAME_LIVE_LEASE_ACQUIRE_DENIED' using errcode='42501';
  end if;

  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.play_state,'SCHEDULED')) not in ('READY','LIVE') then
    raise exception 'GAME_LIVE_LEASE_STATE_INVALID';
  end if;

  -- Serialize all lease ownership changes for a game.
  perform pg_advisory_xact_lock(hashtext(p_game_id::text));

  select * into v_current
  from public.game_live_sessions
  where game_id=p_game_id
  for update;

  if v_current.game_id is not null
     and v_current.released_at is null
     and v_current.lease_expires_at>now() then
    if not coalesce(p_force,false) then
      raise exception 'GAME_LIVE_LEASE_HELD' using errcode='55P03';
    end if;
    if not iq_v21_private.can_manage(p_game_id) then
      raise exception 'GAME_LIVE_LEASE_FORCE_DENIED' using errcode='42501';
    end if;
    v_action:='FORCED_TAKEOVER';
    insert into public.game_live_session_events(
      game_id,writer_user_id,actor_user_id,action,metadata
    ) values (
      p_game_id,v_current.writer_user_id,auth.uid(),'FORCED_TAKEOVER',
      jsonb_build_object('previous_expires_at',v_current.lease_expires_at)
    );
  elsif v_current.game_id is not null
        and v_current.released_at is null
        and v_current.lease_expires_at<=now() then
    v_action:='EXPIRED_TAKEOVER';
    insert into public.game_live_session_events(
      game_id,writer_user_id,actor_user_id,action,metadata
    ) values (
      p_game_id,v_current.writer_user_id,auth.uid(),'EXPIRED_TAKEOVER',
      jsonb_build_object('previous_expires_at',v_current.lease_expires_at)
    );
  end if;

  v_token:=gen_random_uuid()::text;
  v_hash:=iq_v28_private.token_hash(v_token);

  insert into public.game_live_sessions(
    game_id,writer_user_id,lease_token_hash,acquired_at,heartbeat_at,
    lease_expires_at,released_at,release_reason,version,updated_at
  ) values (
    p_game_id,auth.uid(),v_hash,now(),now(),v_expiry,null,null,1,now()
  )
  on conflict (game_id) do update set
    writer_user_id=excluded.writer_user_id,
    lease_token_hash=excluded.lease_token_hash,
    acquired_at=excluded.acquired_at,
    heartbeat_at=excluded.heartbeat_at,
    lease_expires_at=excluded.lease_expires_at,
    released_at=null,
    release_reason=null,
    version=public.game_live_sessions.version+1,
    updated_at=now();

  insert into public.game_live_session_events(
    game_id,writer_user_id,actor_user_id,action,metadata
  ) values (
    p_game_id,auth.uid(),auth.uid(),'ACQUIRED',
    jsonb_build_object('lease_expires_at',v_expiry,'acquire_mode',v_action)
  );

  return jsonb_build_object(
    'game_id',p_game_id,
    'active',true,
    'is_mine',true,
    'lease_token',v_token,
    'lease_expires_at',v_expiry,
    'heartbeat_interval_seconds',30,
    'lease_ttl_seconds',90
  );
end
$function$;

create or replace function iq_v28_private.heartbeat(
  p_game_id uuid,
  p_lease_token text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_expiry timestamptz:=now()+interval '90 seconds';
  v_count integer;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  if char_length(coalesce(p_lease_token,''))>200 or nullif(trim(coalesce(p_lease_token,'')),'') is null then
    raise exception 'GAME_LIVE_LEASE_TOKEN_INVALID';
  end if;

  update public.game_live_sessions
  set heartbeat_at=now(),lease_expires_at=v_expiry,updated_at=now()
  where game_id=p_game_id
    and writer_user_id=auth.uid()
    and lease_token_hash=iq_v28_private.token_hash(trim(p_lease_token))
    and released_at is null
    and lease_expires_at>now();
  get diagnostics v_count=row_count;

  if v_count<>1 then
    raise exception 'GAME_LIVE_LEASE_NOT_HELD' using errcode='42501';
  end if;

  return jsonb_build_object(
    'game_id',p_game_id,
    'active',true,
    'is_mine',true,
    'lease_expires_at',v_expiry,
    'heartbeat_interval_seconds',30,
    'lease_ttl_seconds',90
  );
end
$function$;

create or replace function iq_v28_private.release(
  p_game_id uuid,
  p_lease_token text,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_session public.game_live_sessions%rowtype;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  if char_length(coalesce(p_reason,''))>500 then
    raise exception 'GAME_LIVE_LEASE_RELEASE_REASON_TOO_LONG';
  end if;

  select * into v_session
  from public.game_live_sessions
  where game_id=p_game_id
  for update;

  if v_session.game_id is null
     or v_session.writer_user_id<>auth.uid()
     or v_session.lease_token_hash<>iq_v28_private.token_hash(trim(coalesce(p_lease_token,'')))
     or v_session.released_at is not null then
    raise exception 'GAME_LIVE_LEASE_NOT_HELD' using errcode='42501';
  end if;

  update public.game_live_sessions
  set released_at=now(),
      release_reason=nullif(trim(coalesce(p_reason,'')),''),
      updated_at=now()
  where game_id=p_game_id;

  update public.game_live_handoffs
  set cancelled_at=now(),cancelled_by=auth.uid()
  where game_id=p_game_id
    and consumed_at is null
    and cancelled_at is null;

  insert into public.game_live_session_events(
    game_id,writer_user_id,actor_user_id,action,metadata
  ) values (
    p_game_id,auth.uid(),auth.uid(),'RELEASED',
    jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),''))
  );

  return jsonb_build_object('game_id',p_game_id,'active',false,'released',true);
end
$function$;

create or replace function iq_v28_private.create_handoff(
  p_game_id uuid,
  p_lease_token text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_session public.game_live_sessions%rowtype;
  v_token text;
  v_hash text;
  v_expiry timestamptz:=now()+interval '2 minutes';
begin
  perform pg_advisory_xact_lock(hashtext(p_game_id::text));

  select * into v_session
  from public.game_live_sessions
  where game_id=p_game_id
  for update;

  if v_session.game_id is null
     or v_session.writer_user_id<>auth.uid()
     or v_session.lease_token_hash<>iq_v28_private.token_hash(trim(coalesce(p_lease_token,'')))
     or v_session.released_at is not null
     or v_session.lease_expires_at<=now() then
    raise exception 'GAME_LIVE_LEASE_NOT_HELD' using errcode='42501';
  end if;

  update public.game_live_handoffs
  set cancelled_at=now(),cancelled_by=auth.uid()
  where game_id=p_game_id
    and consumed_at is null
    and cancelled_at is null;

  v_token:=gen_random_uuid()::text;
  v_hash:=iq_v28_private.token_hash(v_token);

  insert into public.game_live_handoffs(
    game_id,from_user_id,token_hash,expires_at
  ) values (
    p_game_id,auth.uid(),v_hash,v_expiry
  );

  insert into public.game_live_session_events(
    game_id,writer_user_id,actor_user_id,action,metadata
  ) values (
    p_game_id,auth.uid(),auth.uid(),'HANDOFF_CREATED',
    jsonb_build_object('expires_at',v_expiry)
  );

  return jsonb_build_object(
    'game_id',p_game_id,
    'handoff_token',v_token,
    'expires_at',v_expiry
  );
end
$function$;

create or replace function iq_v28_private.accept_handoff(
  p_game_id uuid,
  p_handoff_token text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_handoff public.game_live_handoffs%rowtype;
  v_session public.game_live_sessions%rowtype;
  v_token text;
  v_hash text;
  v_expiry timestamptz:=now()+interval '90 seconds';
begin
  if not iq_v28_private.can_record(p_game_id) then
    raise exception 'GAME_LIVE_HANDOFF_ACCEPT_DENIED' using errcode='42501';
  end if;
  if char_length(coalesce(p_handoff_token,''))>200 or nullif(trim(coalesce(p_handoff_token,'')),'') is null then
    raise exception 'GAME_LIVE_HANDOFF_TOKEN_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_game_id::text));

  select * into v_handoff
  from public.game_live_handoffs
  where game_id=p_game_id
    and token_hash=iq_v28_private.token_hash(trim(p_handoff_token))
    and consumed_at is null
    and cancelled_at is null
    and expires_at>now()
  order by created_at desc
  limit 1
  for update;

  if v_handoff.id is null then
    raise exception 'GAME_LIVE_HANDOFF_INVALID_OR_EXPIRED' using errcode='42501';
  end if;
  if v_handoff.from_user_id=auth.uid() then
    raise exception 'GAME_LIVE_HANDOFF_SELF_NOT_ALLOWED';
  end if;

  select * into v_session
  from public.game_live_sessions
  where game_id=p_game_id
  for update;

  if v_session.game_id is null
     or v_session.writer_user_id<>v_handoff.from_user_id
     or v_session.released_at is not null
     or v_session.lease_expires_at<=now() then
    raise exception 'GAME_LIVE_HANDOFF_SOURCE_LEASE_INVALID' using errcode='42501';
  end if;

  v_token:=gen_random_uuid()::text;
  v_hash:=iq_v28_private.token_hash(v_token);

  update public.game_live_sessions
  set writer_user_id=auth.uid(),
      lease_token_hash=v_hash,
      acquired_at=now(),
      heartbeat_at=now(),
      lease_expires_at=v_expiry,
      released_at=null,
      release_reason=null,
      version=version+1,
      updated_at=now()
  where game_id=p_game_id;

  update public.game_live_handoffs
  set consumed_at=now(),consumed_by=auth.uid()
  where id=v_handoff.id;

  update public.game_live_handoffs
  set cancelled_at=now(),cancelled_by=auth.uid()
  where game_id=p_game_id
    and id<>v_handoff.id
    and consumed_at is null
    and cancelled_at is null;

  insert into public.game_live_session_events(
    game_id,writer_user_id,actor_user_id,action,metadata
  ) values (
    p_game_id,auth.uid(),auth.uid(),'HANDED_OFF',
    jsonb_build_object('from_user_id',v_handoff.from_user_id,'lease_expires_at',v_expiry)
  );

  return jsonb_build_object(
    'game_id',p_game_id,
    'active',true,
    'is_mine',true,
    'lease_token',v_token,
    'lease_expires_at',v_expiry,
    'heartbeat_interval_seconds',30,
    'lease_ttl_seconds',90
  );
end
$function$;

create or replace function iq_v28_private.assert_live_lease(
  p_game_id uuid,
  p_lease_token text
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_state text;
begin
  select upper(coalesce(g.play_state,'SCHEDULED')) into v_state
  from public.games g
  where g.id=p_game_id;

  if v_state is null then raise exception 'GAME_NOT_FOUND'; end if;
  if v_state<>'LIVE' then return; end if;

  if nullif(trim(coalesce(p_lease_token,'')),'') is null then
    raise exception 'GAME_LIVE_LEASE_REQUIRED' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.game_live_sessions s
    where s.game_id=p_game_id
      and s.writer_user_id=auth.uid()
      and s.lease_token_hash=iq_v28_private.token_hash(trim(p_lease_token))
      and s.released_at is null
      and s.lease_expires_at>now()
  ) then
    raise exception 'GAME_LIVE_LEASE_INVALID' using errcode='42501';
  end if;
end
$function$;

create or replace function iq_v28_private.save_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null,
  p_lease_token text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
begin
  perform iq_v28_private.assert_live_lease(p_game_id,p_lease_token);

  return iq_v21_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,
    p_stats,p_periods,p_events
  );
end
$function$;

-- -----------------------------------------------------------------------------
-- Public RPC boundary
-- -----------------------------------------------------------------------------
create or replace function public.iq_v28_game_live_session_status(p_game_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select iq_v28_private.status(p_game_id);
$function$;

create or replace function public.iq_v28_acquire_game_live_session(
  p_game_id uuid,
  p_force boolean default false
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v28_private.acquire(p_game_id,p_force);
$function$;

create or replace function public.iq_v28_heartbeat_game_live_session(
  p_game_id uuid,
  p_lease_token text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v28_private.heartbeat(p_game_id,p_lease_token);
$function$;

create or replace function public.iq_v28_release_game_live_session(
  p_game_id uuid,
  p_lease_token text,
  p_reason text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v28_private.release(p_game_id,p_lease_token,p_reason);
$function$;

create or replace function public.iq_v28_create_game_live_handoff(
  p_game_id uuid,
  p_lease_token text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v28_private.create_handoff(p_game_id,p_lease_token);
$function$;

create or replace function public.iq_v28_accept_game_live_handoff(
  p_game_id uuid,
  p_handoff_token text
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v28_private.accept_handoff(p_game_id,p_handoff_token);
$function$;

create or replace function public.iq_v28_save_game_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null,
  p_lease_token text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v28_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,
    p_stats,p_periods,p_events,p_lease_token
  );
$function$;

-- Private functions are implementation details, not direct PostgREST surfaces.
revoke all on all functions in schema iq_v28_private from public,anon,authenticated;
grant execute on function iq_v28_private.status(uuid) to authenticated;
grant execute on function iq_v28_private.acquire(uuid,boolean) to authenticated;
grant execute on function iq_v28_private.heartbeat(uuid,text) to authenticated;
grant execute on function iq_v28_private.release(uuid,text,text) to authenticated;
grant execute on function iq_v28_private.create_handoff(uuid,text) to authenticated;
grant execute on function iq_v28_private.accept_handoff(uuid,text) to authenticated;
grant execute on function iq_v28_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text) to authenticated;

revoke all on function public.iq_v28_game_live_session_status(uuid) from public,anon,authenticated;
revoke all on function public.iq_v28_acquire_game_live_session(uuid,boolean) from public,anon,authenticated;
revoke all on function public.iq_v28_heartbeat_game_live_session(uuid,text) from public,anon,authenticated;
revoke all on function public.iq_v28_release_game_live_session(uuid,text,text) from public,anon,authenticated;
revoke all on function public.iq_v28_create_game_live_handoff(uuid,text) from public,anon,authenticated;
revoke all on function public.iq_v28_accept_game_live_handoff(uuid,text) from public,anon,authenticated;
revoke all on function public.iq_v28_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text) from public,anon,authenticated;

grant execute on function public.iq_v28_game_live_session_status(uuid) to authenticated;
grant execute on function public.iq_v28_acquire_game_live_session(uuid,boolean) to authenticated;
grant execute on function public.iq_v28_heartbeat_game_live_session(uuid,text) to authenticated;
grant execute on function public.iq_v28_release_game_live_session(uuid,text,text) to authenticated;
grant execute on function public.iq_v28_create_game_live_handoff(uuid,text) to authenticated;
grant execute on function public.iq_v28_accept_game_live_handoff(uuid,text) to authenticated;
grant execute on function public.iq_v28_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text) to authenticated;

-- Once V28 exists, the old public write surface must not bypass the lease.
revoke all on function public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)
  from public,anon,authenticated;
revoke all on function iq_v21_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)
  from authenticated;

commit;
