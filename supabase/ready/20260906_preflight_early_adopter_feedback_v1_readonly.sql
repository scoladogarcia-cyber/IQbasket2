-- Read-only preflight for V19 Early Adopter Feedback V1.
select
  'EARLY_ADOPTER_FEEDBACK_V1_PREFLIGHT' as section,
  (
    to_regclass('public.user_profiles') is not null
    and to_regclass('public.user_account_controls') is not null
    and (
      to_regclass('public.product_feedback') is null
      or exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='product_feedback' and column_name='message'
      )
    )
  ) as ready;
