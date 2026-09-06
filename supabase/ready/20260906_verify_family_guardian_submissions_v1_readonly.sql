-- Read-only verification for installed V18 boundary.
select
  'FAMILY_GUARDIAN_SUBMISSIONS_V1_VERIFY' as section,
  (select count(*) from public.player_data_submissions where actor_relation='GUARDIAN') as guardian_rows,
  (
    exists (
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='player_data_submissions'
        and column_name='actor_relation'
    )
    and to_regprocedure('public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)') is not null
    and to_regprocedure('public.iq_v18_submit_player_submission(uuid)') is not null
    and to_regprocedure('public.iq_v18_list_my_player_submissions(uuid,uuid,integer)') is not null
    and to_regprocedure('public.iq_v18_list_player_submission_reviews(uuid,boolean,integer)') is not null
    and to_regprocedure('public.iq_v18_review_player_submission(uuid,text,text)') is not null
    and has_function_privilege('authenticated','public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)','EXECUTE')
    and has_function_privilege('authenticated','public.iq_v18_review_player_submission(uuid,text,text)','EXECUTE')
    and not has_function_privilege('anon','public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','iq_private.iq_v18_player_submission_relation(uuid,uuid)','EXECUTE')
    and not has_table_privilege('authenticated','public.player_data_submissions','INSERT')
    and pg_get_functiondef('iq_private.iq_v14_guard_validated_wellness_history()'::regprocedure)
      ilike '%PLAYER360_WELLNESS_GUARDIAN_SUBMISSION_REQUIRED%'
    and pg_get_functiondef('public.iq_v14_review_player_submission(uuid,text,text)'::regprocedure)
      ilike '%iq_v18_review_player_submission%'
    and not exists (
      select 1 from public.player_data_submissions
      where actor_relation not in ('SELF','GUARDIAN')
    )
  ) as installed_ok;
