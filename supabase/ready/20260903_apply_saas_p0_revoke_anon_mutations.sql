-- =============================================================================
-- IQBasket SaaS Security P0 · revoke anonymous public-schema mutations
-- No domain rows are modified. Public registration uses Supabase Auth, not DML
-- against public application tables.
-- =============================================================================
begin;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname='public'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table %I.%I from anon',
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

commit;

select 'ANON_MUTATION_HARDENING_APPLY' as section, true as applied;
