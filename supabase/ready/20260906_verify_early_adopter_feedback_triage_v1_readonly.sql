-- Read-only verification for installed V20 feedback triage boundary.
select
  'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_VERIFY' as section,
  (
    to_regprocedure('public.iq_v20_list_product_feedback(text,integer)') is not null
    and to_regprocedure('public.iq_v20_review_product_feedback(uuid,text,text)') is not null
    and has_function_privilege('authenticated','public.iq_v20_list_product_feedback(text,integer)','EXECUTE')
    and has_function_privilege('authenticated','public.iq_v20_review_product_feedback(uuid,text,text)','EXECUTE')
    and not has_function_privilege('anon','public.iq_v20_list_product_feedback(text,integer)','EXECUTE')
    and not has_function_privilege('anon','public.iq_v20_review_product_feedback(uuid,text,text)','EXECUTE')
    and not has_table_privilege('authenticated','public.product_feedback','SELECT')
    and not has_table_privilege('authenticated','public.product_feedback','UPDATE')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='product_feedback' and column_name='reviewed_by')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='product_feedback' and column_name='review_note')
    and (select relrowsecurity from pg_class where oid='public.product_feedback'::regclass)
  ) as installed_ok;
