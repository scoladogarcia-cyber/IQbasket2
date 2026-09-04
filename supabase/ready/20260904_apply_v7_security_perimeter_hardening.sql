-- IQBasket V7 Â· public security perimeter hardening
-- Removes legacy anonymous SECURITY DEFINER exposure and insecure metadata policies.
begin;

create schema if not exists iq_private;
revoke all on schema iq_private from public;
grant usage on schema iq_private to anon, authenticated, service_role;

create or replace function iq_private.account_is_active(p_user_id uuid)
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
revoke all on function iq_private.account_is_active(uuid) from public;
grant execute on function iq_private.account_is_active(uuid)
  to anon, authenticated, service_role;

create or replace function public.iq_account_is_active()
returns boolean
language sql
stable security invoker
set search_path = ''
as $function$
  select iq_private.account_is_active(auth.uid());
$function$;revoke all on function public.iq_account_is_active() from public;
grant execute on function public.iq_account_is_active()
  to anon, authenticated, service_role;

-- Legacy auth helper is not attached to auth.users anymore. Keep it safe in case
-- an old environment still references it, but never trust client role metadata.
create or replace function public.handle_new_user()
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
  insert into public.profiles(id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.email,
    v_role
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name;
  return new;
end;
$function$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter function public.sync_game_periods_from_json() set search_path = 'public';-- Remove obsolete game_events policies. V7 compatibility + account boundary
-- preserve ACTIVE authenticated behavior; V5 triggers still enforce game locks.
drop policy if exists "Permitir actualizacion solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir borrado solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir insercion solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir lectura a usuarios autenticados" on public.game_events;
drop policy if exists "Permitir todo a usuarios autenticados y anon en game_events" on public.game_events;
drop policy if exists "Permitir todo en game_events" on public.game_events;

-- Explicit deny policies document the private lifecycle tables and silence
-- accidental no-policy regressions without granting table privileges.
drop policy if exists iq_v7_no_client_account_controls on public.user_account_controls;
create policy iq_v7_no_client_account_controls
  on public.user_account_controls for all to anon, authenticated
  using (false) with check (false);

drop policy if exists iq_v7_no_client_account_history on public.user_account_status_history;
create policy iq_v7_no_client_account_history
  on public.user_account_status_history for all to anon, authenticated
  using (false) with check (false);

-- No anonymous caller may invoke a public SECURITY DEFINER routine. Trigger
-- execution is unaffected by EXECUTE ACLs; authenticated RPC grants are preserved.
do $block$
declare
  r record;
  v_auth_can_execute boolean;
  v_service_can_execute boolean;
begin
  for r in
    select p.oid, n.nspname schema_name, p.proname,
           pg_get_function_identity_arguments(p.oid) identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    v_auth_can_execute := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    v_service_can_execute := has_function_privilege('service_role', r.oid, 'EXECUTE');
    execute format('revoke execute on function %I.%I(%s) from public, anon',
      r.schema_name, r.proname, r.identity_args);
    if v_auth_can_execute then
      execute format('grant execute on function %I.%I(%s) to authenticated',
        r.schema_name, r.proname, r.identity_args);
    end if;
    if v_service_can_execute then
      execute format('grant execute on function %I.%I(%s) to service_role',
        r.schema_name, r.proname, r.identity_args);
    end if;
  end loop;
end
$block$;-- Migration invariants: no insecure metadata policy and no anonymous public
-- SECURITY DEFINER execution surface may remain.
do $block$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and coalesce(qual,'') || coalesce(with_check,'') ilike '%user_metadata%'
  ) then
    raise exception 'V7_USER_METADATA_POLICY_REMAINS';
  end if;

  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and has_function_privilege('anon',p.oid,'EXECUTE')
  ) then
    raise exception 'V7_ANON_SECURITY_DEFINER_REMAINS';
  end if;

  if (select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='iq_account_is_active'
        and pg_get_function_identity_arguments(p.oid)='') then
    raise exception 'V7_ACCOUNT_HELPER_STILL_SECURITY_DEFINER';
  end if;

  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
  ) then
    raise exception 'V7_PUBLIC_TABLE_WITHOUT_RLS';
  end if;
end
$block$;

commit;