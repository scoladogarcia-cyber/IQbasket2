-- IQBasket V7 · Account lifecycle security foundation
-- Separates security lifecycle from the legacy user_profiles.status workflow.
-- Existing/new profiles remain ACTIVE so this migration is behavior-preserving.

begin;

create table if not exists public.user_account_controls (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  account_status text not null default 'ACTIVE',
  status_reason text null,
  changed_at timestamptz not null default now(),
  changed_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_account_controls_status_check
    check (account_status in ('ACTIVE','SUSPENDED','DISABLED','PENDING_ACTIVATION')),
  constraint user_account_controls_reason_length_check
    check (status_reason is null or char_length(status_reason) <= 500)
);

create table if not exists public.user_account_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  previous_status text null,
  new_status text not null,
  reason text null,
  actor_id uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_account_status_history_status_check
    check (new_status in ('ACTIVE','SUSPENDED','DISABLED','PENDING_ACTIVATION')),
  constraint user_account_status_history_reason_length_check
    check (reason is null or char_length(reason) <= 500)
);

create index if not exists user_account_status_history_user_created_idx
  on public.user_account_status_history(user_id, created_at desc);

alter table public.user_account_controls enable row level security;
alter table public.user_account_status_history enable row level security;
revoke all on public.user_account_controls from anon, authenticated;
revoke all on public.user_account_status_history from anon, authenticated;

insert into public.user_account_controls(user_id, account_status, status_reason)
select up.id, 'ACTIVE', 'V7_INITIAL_BACKFILL'
from public.user_profiles up
on conflict (user_id) do nothing;

-- Public signup must never trust client-supplied role metadata. The unique master
-- identity is the only exception; all other accounts start as INVITADO.
create or replace function public.handle_new_user_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := case
    when lower(coalesce(new.email,'')) = 'scolado@nechigroup.com' then 'SUPERADMIN'
    else 'INVITADO'
  end;
begin
  insert into public.user_profiles(id,email,first_name,last_name,role,global_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    v_role,
    case when v_role='SUPERADMIN' then 'SUPERADMIN' else null end
  )
  on conflict (email) do update
    set first_name=excluded.first_name,
        last_name=excluded.last_name;
  return new;
end;
$function$;
revoke all on function public.handle_new_user_profiles() from public, anon, authenticated;

-- Current-user gate. SECURITY DEFINER is required because clients have no direct
-- access to the control table.
create or replace function public.iq_account_is_active()
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and exists (
      select 1 from public.user_account_controls c
      where c.user_id = auth.uid()
        and c.account_status = 'ACTIVE'
    );
$function$;
revoke all on function public.iq_account_is_active() from public;
grant execute on function public.iq_account_is_active() to anon, authenticated, service_role;

-- Target-user gate for trusted backend metering. Never exposed to browser roles.
create or replace function public.iq_account_is_active_for_user(p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and exists (
      select 1 from public.user_account_controls c
      where c.user_id = p_user_id
        and c.account_status = 'ACTIVE'
    );
$function$;
revoke all on function public.iq_account_is_active_for_user(uuid) from public, anon, authenticated;
grant execute on function public.iq_account_is_active_for_user(uuid) to service_role;

create or replace function public.iq_current_account_state()
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $function$
declare
  v_control public.user_account_controls%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('active', false, 'account_status', 'UNAUTHENTICATED', 'reason_code', 'AUTH_REQUIRED');
  end if;

  select * into v_control
  from public.user_account_controls c
  where c.user_id = auth.uid();

  if v_control.user_id is null then
    return jsonb_build_object('active', false, 'account_status', 'DISABLED', 'reason_code', 'ACCOUNT_CONTROL_MISSING');
  end if;

  return jsonb_build_object(
    'active', v_control.account_status = 'ACTIVE',
    'account_status', v_control.account_status,
    'changed_at', v_control.changed_at
  );
end;
$function$;
revoke all on function public.iq_current_account_state() from public, anon;
grant execute on function public.iq_current_account_state() to authenticated, service_role;

-- Every profile gets a control row. The existing auth.users -> user_profiles
-- trigger runs first; this trigger then creates the security control.
create or replace function public.iq_seed_account_control_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.user_account_controls(user_id, account_status, status_reason)
  values (new.id, 'ACTIVE', 'PROFILE_CREATED')
  on conflict (user_id) do nothing;
  return new;
end;
$function$;
revoke all on function public.iq_seed_account_control_for_profile() from public, anon, authenticated;

drop trigger if exists iq_seed_account_control_after_profile_insert on public.user_profiles;
create trigger iq_seed_account_control_after_profile_insert
  after insert on public.user_profiles
  for each row execute function public.iq_seed_account_control_for_profile();

-- Only an active global SUPERADMIN may alter account lifecycle. Any existing
-- SUPERADMIN profile is protected against accidental suspension/disable.
create or replace function public.iq_admin_set_account_status(
  p_user_id uuid,
  p_account_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text := upper(trim(coalesce(p_account_status, '')));
  v_previous text;
  v_target_role text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED';
  end if;
  if not public.iq_v3_is_global_superadmin() then
    raise exception 'ACCOUNT_STATUS_ADMIN_REQUIRED';
  end if;
  if v_status not in ('ACTIVE','SUSPENDED','DISABLED','PENDING_ACTIVATION') then
    raise exception 'ACCOUNT_STATUS_INVALID';
  end if;
  if p_reason is not null and char_length(trim(p_reason)) > 500 then
    raise exception 'ACCOUNT_STATUS_REASON_TOO_LONG';
  end if;

  select upper(coalesce(up.global_role, up.role, 'USER')) into v_target_role
  from public.user_profiles up
  where up.id = p_user_id;
  if v_target_role is null then raise exception 'ACCOUNT_STATUS_USER_NOT_FOUND'; end if;
  if v_target_role = 'SUPERADMIN' and v_status <> 'ACTIVE' then
    raise exception 'ACCOUNT_STATUS_MASTER_PROTECTED';
  end if;

  select c.account_status into v_previous
  from public.user_account_controls c
  where c.user_id = p_user_id
  for update;

  insert into public.user_account_controls(user_id, account_status, status_reason, changed_at, changed_by)
  values (p_user_id, v_status, nullif(trim(coalesce(p_reason,'')), ''), now(), auth.uid())
  on conflict (user_id) do update
    set account_status = excluded.account_status,
        status_reason = excluded.status_reason,
        changed_at = excluded.changed_at,
        changed_by = excluded.changed_by;

  if v_previous is distinct from v_status then
    insert into public.user_account_status_history(user_id, previous_status, new_status, reason, actor_id)
    values (p_user_id, v_previous, v_status, nullif(trim(coalesce(p_reason,'')), ''), auth.uid());
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'previous_status', v_previous,
    'account_status', v_status,
    'changed', v_previous is distinct from v_status
  );
end;
$function$;
revoke all on function public.iq_admin_set_account_status(uuid,text,text) from public, anon;
grant execute on function public.iq_admin_set_account_status(uuid,text,text) to authenticated;

-- Database-level write protection. Triggers still execute for SECURITY DEFINER
-- RPCs, so suspended accounts cannot mutate tables by bypassing browser RBAC.
create or replace function public.iq_require_active_account_for_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
revoke all on function public.iq_require_active_account_for_write() from public, anon, authenticated;

-- Apply the write gate to all current public data tables except the account
-- security tables and user_profiles. user_profiles is excluded because signup
-- creates it before the control row exists; its full RLS conversion is V8.
do $block$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('user_profiles','user_account_controls','user_account_status_history')
  loop
    execute format('drop trigger if exists iq_account_active_write_guard on %I.%I', r.schema_name, r.table_name);
    execute format(
      'create trigger iq_account_active_write_guard before insert or update or delete on %I.%I for each row execute function public.iq_require_active_account_for_write()',
      r.schema_name, r.table_name
    );
  end loop;
end
$block$;

-- Legacy tables were historically exposed with RLS disabled. V7 enables RLS in a
-- behavior-preserving compatibility mode: ACTIVE authenticated users keep the same
-- broad legacy access they had before RLS, while anonymous and blocked accounts are
-- denied. V8 can later replace these compatibility policies table-by-table with
-- resource-scoped RBAC/ABAC without reopening public access.
do $block$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
      and c.relname not in ('translations','user_profiles')
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
    execute format('drop policy if exists iq_v7_active_legacy_compat on %I.%I', r.schema_name, r.table_name);
    execute format(
      'create policy iq_v7_active_legacy_compat on %I.%I as permissive for all to authenticated using (true) with check (true)',
      r.schema_name, r.table_name
    );
    execute format('drop policy if exists iq_v7_account_boundary on %I.%I', r.schema_name, r.table_name);
    execute format(
      'create policy iq_v7_account_boundary on %I.%I as restrictive for all to public using (auth.uid() is not null and public.iq_account_is_active()) with check (auth.uid() is not null and public.iq_account_is_active())',
      r.schema_name, r.table_name
    );
  end loop;
end
$block$;

-- user_profiles is security-sensitive and must not use the broad legacy write
-- compatibility policy. Reads remain behavior-compatible for ACTIVE users; writes
-- are constrained by row ownership plus a BEFORE UPDATE security guard.
alter table public.user_profiles enable row level security;
drop policy if exists iq_v7_user_profiles_select_active on public.user_profiles;
create policy iq_v7_user_profiles_select_active
  on public.user_profiles for select to authenticated
  using (public.iq_account_is_active());
drop policy if exists iq_v7_user_profiles_update_safe on public.user_profiles;
create policy iq_v7_user_profiles_update_safe
  on public.user_profiles for update to authenticated
  using (
    public.iq_account_is_active()
    and (id = auth.uid() or public.iq_v3_is_global_superadmin())
  )
  with check (
    public.iq_account_is_active()
    and (id = auth.uid() or public.iq_v3_is_global_superadmin())
  );

create or replace function public.iq_v7_guard_user_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then return new; end if;
  if current_setting('iqbasket.profile_admin_rpc', true) = '1' then return new; end if;
  if not public.iq_account_is_active() then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;

  if public.iq_v3_is_global_superadmin() then
    if lower(coalesce(old.email,'')) = 'scolado@nechigroup.com'
       and (
         lower(coalesce(new.email,'')) <> 'scolado@nechigroup.com'
         or upper(coalesce(new.global_role,new.role,'USER')) <> 'SUPERADMIN'
       ) then
      raise exception 'MASTER_IDENTITY_PROTECTED';
    end if;
    return new;
  end if;

  if new.id is distinct from auth.uid() then raise exception 'PROFILE_UPDATE_SCOPE_DENIED'; end if;
  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.global_role is distinct from old.global_role
     or new.status is distinct from old.status
     or new.assigned_team_ids is distinct from old.assigned_team_ids
     or new.linked_player_id is distinct from old.linked_player_id
     or new.created_at is distinct from old.created_at then
    raise exception 'PROFILE_SECURITY_FIELDS_READ_ONLY';
  end if;
  return new;
end;
$function$;
revoke all on function public.iq_v7_guard_user_profile_update() from public, anon, authenticated;
drop trigger if exists iq_v7_guard_user_profile_update on public.user_profiles;
create trigger iq_v7_guard_user_profile_update
  before update on public.user_profiles
  for each row execute function public.iq_v7_guard_user_profile_update();

-- Privileged profile changes are backend-only. Direct browser UPDATE can no longer
-- promote roles or alter team scope.
create or replace function public.iq_v7_assign_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := upper(trim(coalesce(p_role,'')));
  v_actor_role text;
  v_actor_teams uuid[];
  v_target_email text;
  v_target_teams uuid[];
  v_is_super boolean := false;
  v_standard text[] := array['ENTRENADOR','ANALISTA','PREPARADOR_FISICO','JUGADOR','FAMILIA_TUTOR','VISOR','INVITADO'];
begin
  if auth.uid() is null or not public.iq_account_is_active() then raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'ROLE_ASSIGNMENT_TARGET_INVALID'; end if;

  select upper(coalesce(up.global_role,up.role,'USER')), coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_actor_role, v_actor_teams from public.user_profiles up where up.id=auth.uid();
  select lower(up.email), coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_target_email, v_target_teams from public.user_profiles up where up.id=p_user_id;
  if v_target_email is null then raise exception 'ROLE_ASSIGNMENT_USER_NOT_FOUND'; end if;
  if v_target_email='scolado@nechigroup.com' then raise exception 'MASTER_IDENTITY_PROTECTED'; end if;
  if v_role='SUPERADMIN' then raise exception 'ROLE_ASSIGNMENT_SUPERADMIN_DENIED'; end if;

  v_is_super := public.iq_v3_is_global_superadmin();
  if v_is_super then
    if not (v_role='ADMIN' or v_role=any(v_standard)) then raise exception 'ROLE_ASSIGNMENT_INVALID'; end if;
  elsif v_actor_role='ADMIN' then
    if not (v_role=any(v_standard)) then raise exception 'ROLE_ASSIGNMENT_PRIVILEGED_DENIED'; end if;
    if cardinality(v_actor_teams)=0 or not (v_target_teams && v_actor_teams) then
      raise exception 'ROLE_ASSIGNMENT_SCOPE_DENIED';
    end if;
  else
    raise exception 'ROLE_ASSIGNMENT_ADMIN_REQUIRED';
  end if;

  perform set_config('iqbasket.profile_admin_rpc','1',true);
  update public.user_profiles
  set role=v_role,
      global_role=case when v_role='ADMIN' then 'ADMIN' else null end
  where id=p_user_id;
  perform set_config('iqbasket.profile_admin_rpc','0',true);

  return jsonb_build_object('user_id',p_user_id,'role',v_role);
end;
$function$;
revoke all on function public.iq_v7_assign_user_role(uuid,text) from public, anon;
grant execute on function public.iq_v7_assign_user_role(uuid,text) to authenticated;

create or replace function public.iq_v7_set_user_team_assignments(p_user_id uuid, p_team_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_actor_teams uuid[];
  v_target_email text;
  v_target_teams uuid[];
  v_requested uuid[];
  v_final uuid[];
  v_is_super boolean := false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED'; end if;
  if p_user_id is null then raise exception 'TEAM_ASSIGNMENT_TARGET_REQUIRED'; end if;

  select coalesce(array_agg(distinct x),'{}'::uuid[]) into v_requested
  from unnest(coalesce(p_team_ids,'{}'::uuid[])) x;
  if exists(select 1 from unnest(v_requested) x where not exists(select 1 from public.teams t where t.id=x)) then
    raise exception 'TEAM_ASSIGNMENT_UNKNOWN_TEAM';
  end if;

  select upper(coalesce(up.global_role,up.role,'USER')), coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_actor_role, v_actor_teams from public.user_profiles up where up.id=auth.uid();
  select lower(up.email), coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_target_email, v_target_teams from public.user_profiles up where up.id=p_user_id;
  if v_target_email is null then raise exception 'TEAM_ASSIGNMENT_USER_NOT_FOUND'; end if;

  v_is_super := public.iq_v3_is_global_superadmin();
  if v_is_super then
    v_final := v_requested;
  elsif v_actor_role='ADMIN' then
    if cardinality(v_actor_teams)=0 then raise exception 'TEAM_ASSIGNMENT_SCOPE_DENIED'; end if;
    if exists(select 1 from unnest(v_requested) x where not (x=any(v_actor_teams))) then
      raise exception 'TEAM_ASSIGNMENT_SCOPE_DENIED';
    end if;
    select coalesce(array_agg(distinct q.team_id),'{}'::uuid[]) into v_final
    from (
      select x as team_id from unnest(v_target_teams) x where not (x=any(v_actor_teams))
      union
      select x from unnest(v_requested) x
    ) q;
  else
    raise exception 'TEAM_ASSIGNMENT_ADMIN_REQUIRED';
  end if;

  if v_target_email='scolado@nechigroup.com' and not v_is_super then raise exception 'MASTER_IDENTITY_PROTECTED'; end if;
  perform set_config('iqbasket.profile_admin_rpc','1',true);
  update public.user_profiles set assigned_team_ids=v_final where id=p_user_id;
  perform set_config('iqbasket.profile_admin_rpc','0',true);

  return jsonb_build_object('user_id',p_user_id,'assigned_team_ids',to_jsonb(v_final));
end;
$function$;
revoke all on function public.iq_v7_set_user_team_assignments(uuid,uuid[]) from public, anon;
grant execute on function public.iq_v7_set_user_team_assignments(uuid,uuid[]) to authenticated;

-- Translations are intentionally public-read so the login shell can localize before
-- authentication. Public write is removed; authenticated writes require ACTIVE state.
alter table public.translations enable row level security;
drop policy if exists "Escritura de traducciones" on public.translations;
drop policy if exists iq_v7_active_translation_write on public.translations;
create policy iq_v7_active_translation_write
  on public.translations as permissive for all to authenticated
  using (public.iq_account_is_active())
  with check (public.iq_account_is_active());

-- RLS-enabled tables also get a restrictive SELECT/WRITE gate. Existing RBAC/
-- ABAC policies remain unchanged and must still pass independently.
do $block$
declare r record;
begin
  for r in
    select n.nspname schema_name, c.relname table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
      and c.relname not in ('user_account_controls','user_account_status_history')
  loop
    execute format('drop policy if exists iq_account_active_guard on %I.%I', r.schema_name, r.table_name);
    execute format(
      'create policy iq_account_active_guard on %I.%I as restrictive for all to authenticated using (public.iq_account_is_active()) with check (public.iq_account_is_active())',
      r.schema_name, r.table_name
    );
  end loop;
end
$block$;

-- Preserve installed authorization semantics byte-for-byte by snapshotting each
-- current implementation once, then replacing the original function (same OID,
-- same ACL/dependencies) with an account gate + delegation wrapper.
do $block$
declare
  v_item text[];
  v_original text;
  v_copy text;
  v_identity text;
  v_definition text;
begin
  foreach v_item slice 1 in array array[
    array['iq_v3_is_global_superadmin','iq_v7_unchecked_v3_is_global_superadmin',''],
    array['iq_v3_can_read_team_season','iq_v7_unchecked_v3_can_read_team_season','uuid'],
    array['iq_v3_can_manage_team_season','iq_v7_unchecked_v3_can_manage_team_season','uuid'],
    array['iq_v3_can_manage_roster','iq_v7_unchecked_v3_can_manage_roster','uuid'],
    array['iq_v4_has_player360_action_role','iq_v7_unchecked_v4_has_player360_action_role','uuid,text[],text[],text[]'],
    array['iq_v4_can_view_player360_team_season','iq_v7_unchecked_v4_can_view_player360_team_season','uuid'],
    array['iq_v4_can_manage_training','iq_v7_unchecked_v4_can_manage_training','uuid'],
    array['iq_v4_can_manage_evaluation','iq_v7_unchecked_v4_can_manage_evaluation','uuid'],
    array['iq_v4e_can_access_sensitive_resource','iq_v7_unchecked_v4e_can_access_sensitive_resource','uuid,uuid,text,text,text'],
    array['iq_v5_current_role','iq_v7_unchecked_v5_current_role',''],
    array['iq_v5_can_access_team','iq_v7_unchecked_v5_can_access_team','uuid'],
    array['iq_v5_role_for_game','iq_v7_unchecked_v5_role_for_game','uuid'],
    array['iq_v6_role_for_team_season','iq_v7_unchecked_v6_role_for_team_season','uuid'],
    array['iq_ai_reserve_usage','iq_v7_unchecked_ai_reserve_usage','uuid,uuid,uuid,uuid,integer,text']
  ]
  loop
    v_original := v_item[1];
    v_copy := v_item[2];
    v_identity := v_item[3];

    if to_regprocedure(format('public.%I(%s)', v_original, v_identity)) is null then
      raise exception 'V7_REQUIRED_HELPER_MISSING: %(%)', v_original, v_identity;
    end if;

    if to_regprocedure(format('public.%I(%s)', v_copy, v_identity)) is null then
      select pg_get_functiondef(to_regprocedure(format('public.%I(%s)', v_original, v_identity)))
        into v_definition;
      v_definition := replace(
        v_definition,
        format('FUNCTION public.%I(', v_original),
        format('FUNCTION public.%I(', v_copy)
      );
      execute v_definition;
    end if;
  end loop;
end
$block$;

-- Internal snapshots are callable only by their owner (wrappers execute as owner).
revoke all on function public.iq_v7_unchecked_v3_is_global_superadmin() from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v3_can_read_team_season(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v3_can_manage_team_season(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v3_can_manage_roster(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v4_has_player360_action_role(uuid,text[],text[],text[]) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v4_can_view_player360_team_season(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v4_can_manage_training(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v4_can_manage_evaluation(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v5_current_role() from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v5_can_access_team(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v5_role_for_game(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_v6_role_for_team_season(uuid) from public, anon, authenticated, service_role;
revoke all on function public.iq_v7_unchecked_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text) from public, anon, authenticated, service_role;

create or replace function public.iq_v3_is_global_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v3_is_global_superadmin(); $function$;

create or replace function public.iq_v3_can_read_team_season(p_team_season_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v3_can_read_team_season(p_team_season_id); $function$;

create or replace function public.iq_v3_can_manage_team_season(target_team_season_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v3_can_manage_team_season(target_team_season_id); $function$;

create or replace function public.iq_v3_can_manage_roster(target_team_season_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v3_can_manage_roster(target_team_season_id); $function$;

create or replace function public.iq_v4_has_player360_action_role(p_team_season_id uuid, p_team_roles text[], p_club_roles text[], p_profile_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v4_has_player360_action_role(p_team_season_id,p_team_roles,p_club_roles,p_profile_roles); $function$;

create or replace function public.iq_v4_can_view_player360_team_season(p_team_season_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v4_can_view_player360_team_season(p_team_season_id); $function$;

create or replace function public.iq_v4_can_manage_training(p_team_season_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v4_can_manage_training(p_team_season_id); $function$;

create or replace function public.iq_v4_can_manage_evaluation(p_team_season_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v4_can_manage_evaluation(p_team_season_id); $function$;

create or replace function public.iq_v4e_can_access_sensitive_resource(p_player_id uuid,p_team_season_id uuid,p_module text,p_action text,p_purpose text)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v4e_can_access_sensitive_resource(p_player_id,p_team_season_id,p_module,p_action,p_purpose); $function$;

create or replace function public.iq_v5_current_role()
returns text language sql stable security definer set search_path = ''
as $function$ select case when public.iq_account_is_active() then public.iq_v7_unchecked_v5_current_role() else 'BLOCKED' end; $function$;

create or replace function public.iq_v5_can_access_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select public.iq_account_is_active() and public.iq_v7_unchecked_v5_can_access_team(target_team_id); $function$;

create or replace function public.iq_v5_role_for_game(target_game_id uuid)
returns text language sql stable security definer set search_path = ''
as $function$ select case when public.iq_account_is_active() then public.iq_v7_unchecked_v5_role_for_game(target_game_id) else 'BLOCKED' end; $function$;

create or replace function public.iq_v6_role_for_team_season(p_team_season_id uuid)
returns text language sql stable security definer set search_path = ''
as $function$ select case when public.iq_account_is_active() then public.iq_v7_unchecked_v6_role_for_team_season(p_team_season_id) else 'BLOCKED' end; $function$;

create or replace function public.iq_ai_reserve_usage(
  p_user_id uuid,p_team_season_id uuid,p_snapshot_id uuid,p_idempotency_key uuid,
  p_monthly_limit integer,p_operation text default 'PLAYER360_AI_INSIGHT'
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
begin
  if not public.iq_account_is_active_for_user(p_user_id) then
    raise exception 'AI_USAGE_ACCOUNT_NOT_ACTIVE';
  end if;
  return public.iq_v7_unchecked_ai_reserve_usage(
    p_user_id,p_team_season_id,p_snapshot_id,p_idempotency_key,p_monthly_limit,p_operation
  );
end;
$function$;

-- Migration invariants: additive backfill only; legacy registration status is untouched.
do $block$
declare v_profiles integer; v_controls integer;
begin
  select count(*) into v_profiles from public.user_profiles;
  select count(*) into v_controls from public.user_account_controls;
  if v_controls <> v_profiles then
    raise exception 'ACCOUNT_CONTROL_BACKFILL_MISMATCH profiles=% controls=%', v_profiles, v_controls;
  end if;
  if exists (select 1 from public.user_account_controls where account_status <> 'ACTIVE') then
    raise exception 'ACCOUNT_CONTROL_INITIAL_STATE_NOT_ACTIVE';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
  ) then
    raise exception 'V7_PUBLIC_TABLE_WITHOUT_RLS';
  end if;
  if exists (
    select 1 from public.user_profiles up
    where (upper(coalesce(up.role,''))='SUPERADMIN' or upper(coalesce(up.global_role,''))='SUPERADMIN')
      and lower(coalesce(up.email,'')) <> 'scolado@nechigroup.com'
  ) then
    raise exception 'V7_UNAUTHORIZED_SUPERADMIN_PROFILE';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='user_profiles'
      and policyname='iq_v7_active_legacy_compat'
  ) then
    raise exception 'V7_USER_PROFILES_LEGACY_POLICY_FORBIDDEN';
  end if;
end
$block$;

commit;
