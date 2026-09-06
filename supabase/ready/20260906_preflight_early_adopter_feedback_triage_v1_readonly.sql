-- Read-only preflight for V20 Early Adopter Feedback Triage V1.
select
  'EARLY_ADOPTER_FEEDBACK_TRIAGE_V1_PREFLIGHT' as section,
  (
    to_regclass('public.product_feedback') is not null
    and to_regprocedure('public.iq_v19_submit_product_feedback(text,text,text,text,text,jsonb)') is not null
    and to_regprocedure('public.iq_v3_is_global_superadmin()') is not null
    and to_regprocedure('public.iq_v20_list_product_feedback(text,integer)') is null
    and to_regprocedure('public.iq_v20_review_product_feedback(uuid,text,text)') is null
    and not has_table_privilege('authenticated','public.product_feedback','SELECT')
    and not has_table_privilege('authenticated','public.product_feedback','UPDATE')
  ) as ready;
