-- IQBasket · Player Development Loop V2 · read-only verification

do $v2_verify$
begin
  if to_regclass('public.player_development_cycles') is null
     or to_regclass('public.player_development_actions') is null
     or to_regclass('public.player_development_action_evidence') is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_TABLES_MISSING';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.player_development_cycles'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.player_development_actions'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.player_development_action_evidence'::regclass) then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_RLS_MISSING';
  end if;
end
$v2_verify$;

do $v2_privileges$
begin
  if has_table_privilege('authenticated','public.player_development_cycles','SELECT')
     or has_table_privilege('authenticated','public.player_development_actions','UPDATE')
     or has_table_privilege('authenticated','public.player_development_action_evidence','INSERT') then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_DIRECT_ACCESS_OPEN';
  end if;

  if has_function_privilege('authenticated','iq_private.development_cycle_can_manage(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.development_cycle_evidence_snapshot(uuid,uuid)','EXECUTE') then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_PRIVATE_HELPER_EXPOSED';
  end if;
end
$v2_privileges$;

do $v2_functions$
begin
  if to_regprocedure('public.iq_v16_development_cycle_capabilities(uuid,uuid)') is null
     or to_regprocedure('public.iq_v16_development_cycle_snapshot(uuid,uuid)') is null
     or to_regprocedure('public.iq_v16_start_development_cycle(uuid,uuid,uuid,jsonb)') is null
     or to_regprocedure('public.iq_v16_set_development_action_state(uuid,text,text)') is null
     or to_regprocedure('public.iq_v16_link_development_evidence(uuid,text,uuid,text)') is null
     or to_regprocedure('public.iq_v16_review_development_cycle(uuid,text,text)') is null
     or to_regprocedure('public.iq_v16_family_development_cycle(uuid,uuid)') is null then
    raise exception 'PLAYER_DEVELOPMENT_LOOP_V2_RPC_MISSING';
  end if;
end
$v2_functions$;

select 'PLAYER_DEVELOPMENT_LOOP_V2_VERIFY' as section,
       (select count(*) from public.player_development_cycles) as cycles,
       (select count(*) from public.player_development_actions) as actions,
       (select count(*) from public.player_development_action_evidence) as evidence,
       true as phase_ok;
