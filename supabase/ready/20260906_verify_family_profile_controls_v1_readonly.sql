-- IQBasket V26 · readonly post-apply verification
select
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_profiles'
      and column_name='family_show_other_player_names'
      and data_type='boolean' and is_nullable='NO'
  ) as names_preference_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_profiles'
      and column_name='family_show_other_player_jerseys'
      and data_type='boolean' and is_nullable='NO'
  ) as jerseys_preference_ok,
  to_regclass('public.family_profile_config_audit') is not null as audit_table_ok,
  to_regprocedure('public.iq_v26_get_family_profile_config(uuid,uuid)') is not null as get_rpc_ok,
  to_regprocedure('public.iq_v26_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean)') is not null as save_rpc_ok,
  to_regprocedure('iq_private.v26_can_manage_family_profile(uuid)') is not null as private_manager_helper_ok,
  to_regprocedure('iq_private.v26_is_family_user(uuid)') is not null as private_target_helper_ok,
  not has_function_privilege('authenticated','iq_private.v26_can_manage_family_profile(uuid)','execute') as private_manager_closed,
  not has_function_privilege('authenticated','iq_private.v26_is_family_user(uuid)','execute') as private_target_closed,
  has_function_privilege('authenticated','public.iq_v26_get_family_profile_config(uuid,uuid)','execute') as get_rpc_authenticated,
  has_function_privilege('authenticated','public.iq_v26_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean)','execute') as save_rpc_authenticated,
  not has_table_privilege('authenticated','public.family_profile_config_audit','select') as audit_direct_select_closed,
  not has_table_privilege('authenticated','public.family_profile_config_audit','insert') as audit_direct_insert_closed,
  (select relrowsecurity from pg_class where oid='public.family_profile_config_audit'::regclass) as audit_rls_enabled,
  position('show_other_player_names' in pg_get_functiondef('public.iq_v17_family_authorization_scope()'::regprocedure))>0 as family_scope_names_extended,
  position('show_other_player_jerseys' in pg_get_functiondef('public.iq_v17_family_authorization_scope()'::regprocedure))>0 as family_scope_jerseys_extended;
