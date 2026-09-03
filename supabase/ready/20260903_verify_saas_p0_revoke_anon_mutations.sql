-- IQBasket SaaS Security P0 · verification · READ ONLY
select
  'ANON_MUTATION_VERIFY' as section,
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema='public'
      and grantee='anon'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) as no_anon_mutation_grants,
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema='public'
      and grantee='anon'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) as remaining_mutation_grants;
