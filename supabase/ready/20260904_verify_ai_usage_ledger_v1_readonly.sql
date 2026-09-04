-- IQBasket AI usage ledger V1 - READ ONLY verification

do $$
begin
  if to_regclass('public.ai_usage_ledger') is null then
    raise exception 'AI_USAGE_LEDGER_VERIFY_TABLE_MISSING';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='ai_usage_ledger' and c.relrowsecurity
  ) then raise exception 'AI_USAGE_LEDGER_VERIFY_RLS_MISSING'; end if;

  if has_table_privilege('authenticated','public.ai_usage_ledger','SELECT')
     or has_table_privilege('authenticated','public.ai_usage_ledger','INSERT')
     or has_table_privilege('anon','public.ai_usage_ledger','SELECT') then
    raise exception 'AI_USAGE_LEDGER_VERIFY_DIRECT_ACCESS_OPEN';
  end if;

  if to_regprocedure('public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)') is null
     or to_regprocedure('public.iq_ai_mark_provider_started(uuid,uuid,text,text)') is null
     or to_regprocedure('public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)') is null
     or to_regprocedure('public.iq_ai_fail_usage(uuid,uuid,text)') is null then
    raise exception 'AI_USAGE_LEDGER_VERIFY_RPC_MISSING';
  end if;
end $$;
do $$
begin
  if has_function_privilege('authenticated','public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)','EXECUTE')
     or has_function_privilege('authenticated','public.iq_ai_mark_provider_started(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.iq_ai_fail_usage(uuid,uuid,text)','EXECUTE') then
    raise exception 'AI_USAGE_LEDGER_VERIFY_AUTH_RPC_EXPOSED';
  end if;

  if not has_function_privilege('service_role','public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)','EXECUTE')
     or not has_function_privilege('service_role','public.iq_ai_mark_provider_started(uuid,uuid,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.iq_ai_complete_usage(uuid,uuid,uuid,text,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.iq_ai_fail_usage(uuid,uuid,text)','EXECUTE') then
    raise exception 'AI_USAGE_LEDGER_VERIFY_SERVICE_ROLE_RPC_MISSING';
  end if;
end $$;

select
  'AI_USAGE_LEDGER_V1_VERIFY' as section,
  true as verify_ok,
  (select count(*) from public.ai_usage_ledger) as ledger_rows,
  not has_table_privilege('authenticated','public.ai_usage_ledger','SELECT') as browser_direct_read_blocked,
  not has_function_privilege('authenticated','public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)','EXECUTE') as browser_reserve_blocked,
  has_function_privilege('service_role','public.iq_ai_reserve_usage(uuid,uuid,uuid,uuid,integer,text)','EXECUTE') as service_reserve_ok;