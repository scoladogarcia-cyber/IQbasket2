-- IQBasket V29 · read-only post-apply verification
select
  to_regprocedure('public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)') is not null as invite_rpc_ok,
  to_regprocedure('public.iq_v29_find_family_profile(uuid,text)') is not null as lookup_rpc_ok,
  to_regprocedure('iq_v29_private.can_invite_family(uuid)') is not null as invite_guard_ok,
  to_regprocedure('iq_v29_private.normalize_new_game_shell()') is not null as game_shell_guard_ok,
  has_function_privilege('authenticated','public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)','EXECUTE') as auth_invite_execute_ok,
  has_function_privilege('authenticated','public.iq_v29_find_family_profile(uuid,text)','EXECUTE') as auth_lookup_execute_ok,
  not has_function_privilege('anon','public.iq_v29_create_family_link_invitation(uuid,uuid,text,integer)','EXECUTE') as anon_invite_denied,
  not has_function_privilege('anon','public.iq_v29_find_family_profile(uuid,text)','EXECUTE') as anon_lookup_denied,
  exists (
    select 1 from pg_trigger
    where tgrelid='public.games'::regclass
      and tgname='trg_iq_v29_normalize_new_game_shell'
      and not tgisinternal
  ) as game_shell_trigger_ok,
  coalesce((
    select position('ENTRENADOR' in pg_get_functiondef('iq_v29_private.can_invite_family(uuid)'::regprocedure))>0
  ),false) as trainer_invite_guard_ok,
  coalesce((
    select position('v26_can_manage_family_profile' in pg_get_functiondef('iq_v29_private.find_family_profile(uuid,text)'::regprocedure))>0
  ),false) as direct_assignment_still_admin_guarded,
  coalesce((
    select column_default from information_schema.columns
    where table_schema='public' and table_name='games' and column_name='status'
  ),'') like '%Programado%' as scheduled_default_ok;
