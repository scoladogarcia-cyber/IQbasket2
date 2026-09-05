-- =============================================================================
-- IQBasket · Game Play State V2
-- Date: 2026-09-05
-- Separates sporting lifecycle (play_state) from historical edit lock (edit_state).
-- play_state is canonical; status remains a temporary compatibility projection.
-- =============================================================================

begin;

do $play_state_prereq$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.team_season_memberships') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null then
    raise exception 'GAME_PLAY_STATE_V2_PREREQUISITES_MISSING';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid='public.games'::regclass and attname='edit_state' and not attisdropped
  ) then raise exception 'GAME_PLAY_STATE_V2_REQUIRES_EDIT_STATE'; end if;
end
$play_state_prereq$;

-- -----------------------------------------------------------------------------
-- 1. Additive canonical sporting state
-- -----------------------------------------------------------------------------
alter table public.games
  add column if not exists play_state text,
  add column if not exists play_state_changed_at timestamptz,
  add column if not exists play_state_changed_by uuid references public.user_profiles(id) on delete set null,
  add column if not exists play_state_reason text;

-- V5 and V6 correctly reject ordinary updates to locked/frozen games. The one-time
-- schema backfill must touch those historical rows, so suspend only those guards
-- transactionally and restore them before exposing V13. A migration failure rolls
-- the trigger state back together with every other DDL/DML statement.
do $backfill_disable_guards$
declare
  v_trigger text;
begin
  foreach v_trigger in array array[
    'trg_iq_v5_guard_game_lock_transition',
    'trg_iq_v6_guard_frozen_team_season_game'
  ] loop
    if exists (
      select 1 from pg_trigger
      where tgrelid='public.games'::regclass
        and tgname=v_trigger
        and not tgisinternal
    ) then
      execute format('alter table public.games disable trigger %I',v_trigger);
    end if;
  end loop;
end
$backfill_disable_guards$;

-- One-time compatibility mapping from the legacy free-text status column.
update public.games
set play_state=case
  when lower(coalesce(status,'')) like '%cancel%' then 'CANCELLED'
  when lower(coalesce(status,'')) like '%final%' or lower(coalesce(status,'')) like '%finish%' then 'FINISHED'
  when lower(coalesce(status,'')) like '%curso%' or lower(coalesce(status,'')) like '%live%' or lower(coalesce(status,'')) like '%progress%' then 'LIVE'
  when lower(coalesce(status,'')) like '%prepar%' or lower(coalesce(status,'')) like '%ready%' then 'READY'
  when lower(coalesce(status,'')) like '%program%' or lower(coalesce(status,'')) like '%schedul%' then 'SCHEDULED'
  else 'SCHEDULED'
end,
play_state_changed_at=coalesce(play_state_changed_at,created_at,now())
where play_state is null;

alter table public.games alter column play_state set default 'SCHEDULED';
alter table public.games alter column play_state set not null;

do $play_state_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.games'::regclass and conname='games_play_state_check'
  ) then
    alter table public.games add constraint games_play_state_check
      check (play_state in ('SCHEDULED','READY','LIVE','FINISHED','CANCELLED'));
  end if;
end
$play_state_constraint$;

create index if not exists games_play_state_idx
  on public.games(team_season_id,play_state,date desc);
create index if not exists games_play_state_changed_by_fk_idx
  on public.games(play_state_changed_by);

-- `status` is still read by legacy dashboards/aggregators. Keep it as a projection
-- until those readers are migrated; no client may use it as the new source of truth.
create or replace function iq_private.game_legacy_status_for_play_state(p_state text)
returns text
language sql
immutable
set search_path=''
as $function$
  select case upper(coalesce(p_state,''))
    when 'SCHEDULED' then 'Programado'
    when 'READY' then 'Preparado'
    when 'LIVE' then 'En curso'
    when 'FINISHED' then 'Finalizado'
    when 'CANCELLED' then 'Cancelado'
    else 'Programado'
  end;
$function$;
revoke all on function iq_private.game_legacy_status_for_play_state(text) from public,anon,authenticated;

-- Normalize existing legacy projection while historical guards remain suspended.
update public.games
set status=iq_private.game_legacy_status_for_play_state(play_state)
where status is distinct from iq_private.game_legacy_status_for_play_state(play_state);

-- Restore every pre-existing V5/V6 protection before creating the V13 write path.
do $backfill_enable_guards$
declare
  v_trigger text;
begin
  foreach v_trigger in array array[
    'trg_iq_v5_guard_game_lock_transition',
    'trg_iq_v6_guard_frozen_team_season_game'
  ] loop
    if exists (
      select 1 from pg_trigger
      where tgrelid='public.games'::regclass
        and tgname=v_trigger
        and not tgisinternal
    ) then
      execute format('alter table public.games enable trigger %I',v_trigger);
    end if;
  end loop;
end
$backfill_enable_guards$;

create or replace function iq_private.sync_game_play_state_legacy_status_v2()
returns trigger
language plpgsql
set search_path=''
as $function$
declare
  v_legacy text:=lower(trim(coalesce(new.status,'')));
begin
  if tg_op='INSERT' then
    -- Existing clients do not yet send play_state. Preserve their historical
    -- create semantics by interpreting a recognized legacy status once on INSERT.
    if new.play_state='SCHEDULED' then
      if v_legacy like '%cancel%' then new.play_state:='CANCELLED';
      elsif v_legacy like '%final%' or v_legacy like '%finish%' then new.play_state:='FINISHED';
      elsif v_legacy like '%curso%' or v_legacy like '%live%' or v_legacy like '%progress%' then new.play_state:='LIVE';
      elsif v_legacy like '%prepar%' or v_legacy like '%ready%' then new.play_state:='READY';
      end if;
    end if;
  elsif new.play_state is not distinct from old.play_state
        and new.status is distinct from old.status then
    -- Once V2 exists, legacy status writes cannot mutate the canonical lifecycle.
    new.status:=iq_private.game_legacy_status_for_play_state(old.play_state);
    return new;
  end if;

  new.status:=iq_private.game_legacy_status_for_play_state(new.play_state);
  return new;
end;
$function$;
revoke all on function iq_private.sync_game_play_state_legacy_status_v2() from public,anon,authenticated;

drop trigger if exists trg_iq_v13_sync_game_legacy_status on public.games;
create trigger trg_iq_v13_sync_game_legacy_status
before insert or update of play_state,status on public.games
for each row execute function iq_private.sync_game_play_state_legacy_status_v2();

-- -----------------------------------------------------------------------------
-- 2. Immutable transition audit
-- -----------------------------------------------------------------------------
create table public.game_play_state_transitions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  from_state text not null,
  to_state text not null,
  reason text,
  changed_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint game_play_transition_from_check check (from_state in ('SCHEDULED','READY','LIVE','FINISHED','CANCELLED')),
  constraint game_play_transition_to_check check (to_state in ('SCHEDULED','READY','LIVE','FINISHED','CANCELLED')),
  constraint game_play_transition_change_check check (from_state<>to_state)
);
create index game_play_state_transition_game_idx
  on public.game_play_state_transitions(game_id,created_at desc);
create index game_play_state_transition_changed_by_fk_idx
  on public.game_play_state_transitions(changed_by);

alter table public.game_play_state_transitions enable row level security;
revoke all on table public.game_play_state_transitions from public,anon,authenticated;
create policy iq_game_play_state_transitions_no_direct_client_access
  on public.game_play_state_transitions for all to anon,authenticated
  using(false) with check(false);

-- -----------------------------------------------------------------------------
-- 3. Transition and action policy helpers
-- -----------------------------------------------------------------------------
create or replace function iq_private.game_play_state_transition_allowed(
  p_from text,p_to text
)
returns boolean language sql immutable set search_path=''
as $function$
  select case upper(coalesce(p_from,''))
    when 'SCHEDULED' then upper(coalesce(p_to,'')) in ('READY','CANCELLED')
    when 'READY' then upper(coalesce(p_to,'')) in ('SCHEDULED','LIVE','CANCELLED')
    when 'LIVE' then upper(coalesce(p_to,''))='FINISHED'
    else false
  end;
$function$;
revoke all on function iq_private.game_play_state_transition_allowed(text,text) from public,anon,authenticated;

create or replace function iq_private.game_play_state_action_for_target(p_target text)
returns text language sql immutable set search_path=''
as $function$
  select case upper(coalesce(p_target,''))
    when 'SCHEDULED' then 'PREPARE_GAME'
    when 'READY' then 'PREPARE_GAME'
    when 'LIVE' then 'START_GAME'
    when 'FINISHED' then 'FINISH_GAME'
    when 'CANCELLED' then 'CANCEL_GAME'
    else null
  end;
$function$;
revoke all on function iq_private.game_play_state_action_for_target(text) from public,anon,authenticated;

create or replace function iq_private.game_play_state_actor_allowed(
  p_game_id uuid,p_target text
)
returns boolean language sql stable security definer set search_path=''
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
    join public.club_season_memberships cm on cm.club_id=gs.club_id and cm.season_id=gs.season_id
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
        select 1 from membership_roles mr
        where case iq_private.game_play_state_action_for_target(p_target)
          when 'CANCEL_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR')
          when 'PREPARE_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          when 'START_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          when 'FINISH_GAME' then mr.role in ('ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA')
          else false
        end
      )
    );
$function$;
revoke all on function iq_private.game_play_state_actor_allowed(uuid,text) from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 4. Authoritative action RPC
-- -----------------------------------------------------------------------------
create or replace function public.iq_v13_set_game_play_state(
  p_game_id uuid,
  p_target_state text,
  p_reason text default null
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_target text:=upper(trim(coalesce(p_target_state,'')));
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_legacy_status text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if v_target not in ('SCHEDULED','READY','LIVE','FINISHED','CANCELLED') then
    raise exception 'GAME_PLAY_STATE_TARGET_INVALID';
  end if;

  select * into v_game from public.games g where g.id=p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))='LOCKED' then
    raise exception 'GAME_PLAY_STATE_LOCKED' using errcode='42501';
  end if;
  if v_game.play_state=v_target then
    return jsonb_build_object(
      'success',true,'reason_code','NO_CHANGE','game_id',v_game.id,
      'play_state',v_game.play_state,'edit_state',v_game.edit_state,
      'legacy_status',iq_private.game_legacy_status_for_play_state(v_game.play_state)
    );
  end if;
  if not iq_private.game_play_state_transition_allowed(v_game.play_state,v_target) then
    raise exception 'GAME_PLAY_STATE_TRANSITION_INVALID';
  end if;
  if not iq_private.game_play_state_actor_allowed(v_game.id,v_target) then
    raise exception 'GAME_PLAY_STATE_ACTION_DENIED' using errcode='42501';
  end if;
  if v_target='CANCELLED' and coalesce(length(v_reason),0)<5 then
    raise exception 'GAME_PLAY_STATE_CANCEL_REASON_REQUIRED';
  end if;

  v_legacy_status:=iq_private.game_legacy_status_for_play_state(v_target);

  update public.games
  set play_state=v_target,
      status=v_legacy_status,
      play_state_changed_at=now(),
      play_state_changed_by=auth.uid(),
      play_state_reason=v_reason
  where id=v_game.id;

  insert into public.game_play_state_transitions(
    game_id,from_state,to_state,reason,changed_by,metadata
  ) values (
    v_game.id,v_game.play_state,v_target,v_reason,auth.uid(),
    jsonb_build_object(
      'version','GAME_PLAY_STATE_V2',
      'action',iq_private.game_play_state_action_for_target(v_target)
    )
  );

  return jsonb_build_object(
    'success',true,'reason_code','TRANSITION_APPLIED','game_id',v_game.id,
    'from_state',v_game.play_state,'play_state',v_target,'edit_state',v_game.edit_state,
    'legacy_status',v_legacy_status,'changed_at',now()
  );
end;
$function$;
revoke all on function public.iq_v13_set_game_play_state(uuid,text,text) from public,anon;
grant execute on function public.iq_v13_set_game_play_state(uuid,text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Read projection; raw actor identifiers stay inside the private audit trail
-- -----------------------------------------------------------------------------
create or replace function public.iq_v13_game_play_state_snapshot(p_game_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_history jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;

  if not public.iq_v3_is_global_superadmin()
     and not exists (
       select 1 from public.team_season_memberships m
       where m.user_id=auth.uid() and m.team_season_id=v_game.team_season_id
         and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
     )
     and not exists (
       select 1 from public.user_profiles up
       where up.id=auth.uid()
         and (
           up.linked_player_id in (
             select pgs.player_id from public.player_game_stats pgs where pgs.game_id=v_game.id
           )
           or v_game.team_id::text in (
             select value from jsonb_array_elements_text(coalesce(to_jsonb(up.assigned_team_ids),'[]'::jsonb))
           )
         )
     ) then
    raise exception 'GAME_PLAY_STATE_VIEW_DENIED' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'from_state',h.from_state,
    'to_state',h.to_state,
    'reason',h.reason,
    'created_at',h.created_at
  ) order by h.created_at desc),'[]'::jsonb)
  into v_history
  from public.game_play_state_transitions h where h.game_id=v_game.id;

  return jsonb_build_object(
    'game_id',v_game.id,
    'play_state',v_game.play_state,
    'edit_state',v_game.edit_state,
    'legacy_status',v_game.status,
    'changed_at',v_game.play_state_changed_at,
    'reason',v_game.play_state_reason,
    'history',v_history
  );
end;
$function$;
revoke all on function public.iq_v13_game_play_state_snapshot(uuid) from public,anon;
grant execute on function public.iq_v13_game_play_state_snapshot(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Lock compatibility
-- -----------------------------------------------------------------------------
-- V6 season freeze intentionally locks every OPEN game in the scope, including
-- scheduled games. Preserve that lifecycle. Only operational READY/LIVE games
-- are forbidden from being locked before they are finished/cancelled/reset.
create or replace function iq_private.guard_lock_live_game_v2()
returns trigger language plpgsql set search_path=''
as $function$
begin
  if upper(coalesce(new.edit_state,'OPEN'))='LOCKED'
     and upper(coalesce(old.edit_state,'OPEN'))<>'LOCKED'
     and new.play_state in ('READY','LIVE') then
    raise exception 'GAME_MUST_BE_FINISHED_BEFORE_LOCK';
  end if;
  return new;
end;
$function$;
revoke all on function iq_private.guard_lock_live_game_v2() from public,anon,authenticated;

drop trigger if exists trg_iq_v13_guard_lock_live_game on public.games;
create trigger trg_iq_v13_guard_lock_live_game
before update of edit_state on public.games
for each row execute function iq_private.guard_lock_live_game_v2();

-- -----------------------------------------------------------------------------
-- 7. Security and compatibility invariants
-- -----------------------------------------------------------------------------
do $play_state_verify$
begin
  if has_table_privilege('authenticated','public.game_play_state_transitions','SELECT')
     or has_table_privilege('authenticated','public.game_play_state_transitions','INSERT') then
    raise exception 'GAME_PLAY_STATE_AUDIT_DIRECT_ACCESS_OPEN';
  end if;
  if has_function_privilege('authenticated','iq_private.game_play_state_transition_allowed(text,text)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.game_play_state_action_for_target(text)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.game_play_state_actor_allowed(uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.game_legacy_status_for_play_state(text)','EXECUTE') then
    raise exception 'GAME_PLAY_STATE_PRIVATE_HELPER_EXPOSED';
  end if;
  if exists (
    select 1 from public.games g
    where g.status is distinct from iq_private.game_legacy_status_for_play_state(g.play_state)
  ) then
    raise exception 'GAME_PLAY_STATE_LEGACY_PROJECTION_MISMATCH';
  end if;
  if exists (
    select 1 from pg_trigger
    where tgrelid='public.games'::regclass
      and tgname in ('trg_iq_v5_guard_game_lock_transition','trg_iq_v6_guard_frozen_team_season_game')
      and not tgisinternal
      and tgenabled='D'
  ) then
    raise exception 'GAME_PLAY_STATE_PREEXISTING_GUARD_LEFT_DISABLED';
  end if;
end
$play_state_verify$;

commit;

select 'GAME_PLAY_STATE_V2' section,
  count(*) filter(where play_state='SCHEDULED') scheduled,
  count(*) filter(where play_state='READY') ready,
  count(*) filter(where play_state='LIVE') live,
  count(*) filter(where play_state='FINISHED') finished,
  count(*) filter(where play_state='CANCELLED') cancelled
from public.games;
