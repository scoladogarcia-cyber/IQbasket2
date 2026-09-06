-- Read-only preflight for V18 Family Guardian Submissions V1.
select
  'FAMILY_GUARDIAN_SUBMISSIONS_V1_PREFLIGHT' as section,
  (select count(*) from public.player_data_submissions) as submission_rows,
  (
    to_regclass('public.player_data_submissions') is not null
    and to_regclass('public.player360_subject_relationships') is not null
    and to_regclass('public.player360_wellness_entries') is not null
    and to_regclass('public.external_development_sessions') is not null
    and to_regprocedure('public.iq_v17_family_authorization_scope()') is not null
    and to_regprocedure('public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)') is null
    and not exists (
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='player_data_submissions'
        and column_name='actor_relation'
    )
    and (select relrowsecurity
         from pg_class
         where oid='public.player_data_submissions'::regclass)
    and not has_table_privilege(
      'authenticated','public.player_data_submissions','INSERT'
    )
    and exists (
      select 1
      from pg_constraint c
      where c.conrelid='public.player360_wellness_entries'::regclass
        and c.conname='player360_wellness_entry_source_check'
        and pg_get_constraintdef(c.oid) ilike '%GUARDIAN_REPORT%'
    )
  ) as ready;
