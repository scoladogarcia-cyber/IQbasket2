-- Read-only verification for V19 Early Adopter Feedback V1.
select
  'EARLY_ADOPTER_FEEDBACK_V1_VERIFY' as section,
  (
    to_regclass('public.product_feedback') is not null
    and to_regprocedure('public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb)') is not null
    and has_function_privilege('authenticated','public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb)','EXECUTE')
    and not has_function_privilege('authenticated','iq_private.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb)','EXECUTE')
    and not has_table_privilege('authenticated','public.product_feedback','SELECT')
    and not has_table_privilege('authenticated','public.product_feedback','INSERT')
    and exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='product_feedback' and c.relrowsecurity
    )
  ) as installed_ok;
