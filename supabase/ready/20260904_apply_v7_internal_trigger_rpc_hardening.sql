-- IQBasket V7 · internal trigger RPC hardening
-- Trigger/event-trigger functions are invoked by PostgreSQL, never by browser RPC.
begin;

do $block$
declare r record;
begin
  for r in
    select p.oid, n.nspname schema_name, p.proname,
           pg_get_function_identity_arguments(p.oid) identity_args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and pg_get_function_result(p.oid) in ('trigger','event_trigger')
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      r.schema_name, r.proname, r.identity_args
    );
  end loop;
end
$block$;

-- Direct RPC execution must be impossible, while attached triggers remain valid.
do $block$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and pg_get_function_result(p.oid) in ('trigger','event_trigger')
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'V7_TRIGGER_RPC_EXECUTE_REMAINS'; end if;
end
$block$;

commit;