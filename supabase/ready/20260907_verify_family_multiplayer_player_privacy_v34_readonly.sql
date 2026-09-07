-- IQBasket V34 · read-only post-apply verification
-- SECURITY INVOKER is PostgreSQL's default and pg_get_functiondef() may omit
-- the explicit clause. Check pg_proc.prosecdef instead: false = invoker.
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='player_show_other_player_names' and data_type='boolean' and is_nullable='NO') as player_names_pref_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name='player_show_other_player_jerseys' and data_type='boolean' and is_nullable='NO') as player_jerseys_pref_ok,
  to_regclass('public.player_profile_config_audit') is not null as player_audit_ok,
  to_regprocedure('public.iq_v34_get_player_profile_config(text,uuid)') is not null as admin_get_rpc_ok,
  to_regprocedure('public.iq_v34_save_player_profile_config(text,uuid,boolean,boolean)') is not null as admin_save_rpc_ok,
  to_regprocedure('public.iq_v34_my_player_identity_preferences(uuid)') is not null as player_self_rpc_ok,
  to_regprocedure('public.iq_v34_family_bootstrap_free(uuid)') is not null as family_bootstrap_rpc_ok,
  to_regprocedure('public.iq_v34_family_claim_link(text)') is not null as family_claim_rpc_ok,
  to_regprocedure('public.iq_v34_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean)') is not null as family_admin_save_rpc_ok,
  has_function_privilege('authenticated','public.iq_v34_family_bootstrap_free(uuid)','EXECUTE') as authenticated_family_execute_ok,
  not has_function_privilege('anon','public.iq_v34_family_bootstrap_free(uuid)','EXECUTE') as anon_family_denied_ok,
  has_function_privilege('authenticated','public.iq_v34_my_player_identity_preferences(uuid)','EXECUTE') as authenticated_player_execute_ok,
  not has_function_privilege('anon','public.iq_v34_my_player_identity_preferences(uuid)','EXECUTE') as anon_player_denied_ok,
  not (select p.prosecdef from pg_proc p where p.oid='public.iq_v34_family_bootstrap_free(uuid)'::regprocedure) as public_family_invoker_ok,
  not (select p.prosecdef from pg_proc p where p.oid='public.iq_v34_save_player_profile_config(text,uuid,boolean,boolean)'::regprocedure) as public_player_save_invoker_ok,
  not exists (
    select 1
    from public.saas_billing_accounts a
    join public.saas_subscriptions sub on sub.billing_account_id=a.id and sub.status in ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED')
    join public.saas_plans plan on plan.id=sub.plan_id and plan.code='FAMILY_FREE' and plan.account_type='FAMILY'
    join public.player360_subject_relationships r on r.user_id=a.owner_user_id
      and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    where a.account_type='FAMILY' and a.status='ACTIVE'
      and not exists (
        select 1 from public.saas_billing_subjects bs
        where bs.billing_account_id=a.id and bs.subject_type='PLAYER' and bs.player_id=r.player_id
          and bs.status='ACTIVE' and bs.valid_from<=now() and (bs.valid_until is null or bs.valid_until>now())
      )
  ) as family_free_guardians_materialized_ok;
