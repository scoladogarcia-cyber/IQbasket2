-- Gate B functional smoke. All ledger mutations are rolled back.
begin;

do $$
declare
  v_user uuid;
  v_snapshot uuid;
  v_scope uuid := 'd0000000-0000-4000-8000-000000000005'::uuid;
  v_a jsonb;
  v_b jsonb;
  v_c jsonb;
  v_ledger uuid;
begin
  select id into v_user from public.user_profiles
  where lower(email)='scolado@nechigroup.com' limit 1;
  select id into v_snapshot from public.player_longitudinal_snapshots
  where team_season_id=v_scope and calculation_version='DEMO_V1'
  order by id limit 1;
  if v_user is null or v_snapshot is null then
    raise exception 'AI_USAGE_SMOKE_DEMO_PREREQUISITE_MISSING';
  end if;

  v_a := public.iq_ai_reserve_usage(
    v_user,v_scope,v_snapshot,'11111111-1111-4111-8111-111111111111'::uuid,1
  );
  if coalesce((v_a->>'accepted')::boolean,false) is not true then
    raise exception 'AI_USAGE_SMOKE_FIRST_RESERVE_FAILED:%',v_a;
  end if;
  v_ledger := (v_a->>'ledger_id')::uuid;
  v_b := public.iq_ai_reserve_usage(
    v_user,v_scope,v_snapshot,'11111111-1111-4111-8111-111111111111'::uuid,1
  );
  if coalesce(v_b->>'state','') <> 'RESERVED'
     or coalesce((v_b->>'accepted')::boolean,true) is not false then
    raise exception 'AI_USAGE_SMOKE_IDEMPOTENCY_FAILED:%',v_b;
  end if;

  perform public.iq_ai_fail_usage(v_ledger,v_user,'PRE_PROVIDER_TEST');
  if (select consumed_units from public.ai_usage_ledger where id=v_ledger) <> 0 then
    raise exception 'AI_USAGE_SMOKE_PRE_PROVIDER_RELEASE_FAILED';
  end if;

  v_b := public.iq_ai_reserve_usage(
    v_user,v_scope,v_snapshot,'22222222-2222-4222-8222-222222222222'::uuid,1
  );
  if coalesce((v_b->>'accepted')::boolean,false) is not true then
    raise exception 'AI_USAGE_SMOKE_SECOND_RESERVE_FAILED:%',v_b;
  end if;
  v_ledger := (v_b->>'ledger_id')::uuid;
  perform public.iq_ai_mark_provider_started(v_ledger,v_user,'OPENAI','SMOKE_MODEL');
  perform public.iq_ai_fail_usage(v_ledger,v_user,'PROVIDER_TEST_FAILURE');
  if (select consumed_units from public.ai_usage_ledger where id=v_ledger) <> 1 then
    raise exception 'AI_USAGE_SMOKE_PROVIDER_CONSUMPTION_FAILED';
  end if;
  v_c := public.iq_ai_reserve_usage(
    v_user,v_scope,v_snapshot,'33333333-3333-4333-8333-333333333333'::uuid,1
  );
  if coalesce(v_c->>'state','') <> 'DENIED'
     or coalesce(v_c->>'reason','') <> 'QUOTA_EXCEEDED' then
    raise exception 'AI_USAGE_SMOKE_QUOTA_FAILED:%',v_c;
  end if;
end $$;

rollback;

select
  'AI_USAGE_LEDGER_V1_SMOKE' as section,
  true as smoke_ok,
  0 as persisted_test_rows;