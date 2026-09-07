-- IQBasket V34 · read-only production preflight
select
  to_regclass('public.user_profiles') is not null as user_profiles_ok,
  to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
  to_regclass('public.saas_billing_accounts') is not null as billing_accounts_ok,
  to_regclass('public.saas_billing_subjects') is not null as billing_subjects_ok,
  to_regclass('public.saas_subscriptions') is not null as subscriptions_ok,
  to_regclass('public.saas_plans') is not null as plans_ok,
  to_regclass('public.roster_memberships') is not null as roster_ok,
  to_regprocedure('iq_private.family_bootstrap_free_account(uuid,uuid)') is not null as family_bootstrap_dependency_ok,
  to_regprocedure('public.iq_v26_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean)') is not null as family_admin_dependency_ok,
  to_regprocedure('public.iq_v8_family_claim_link(text)') is not null as family_claim_dependency_ok,
  to_regprocedure('public.iq_v34_family_bootstrap_free(uuid)') is null as v34_not_applied_yet;
