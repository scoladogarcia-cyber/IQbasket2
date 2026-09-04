-- IQBasket AI usage ledger V1 - READ ONLY preflight

do $$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.clubs') is null
     or to_regclass('public.teams') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.player_longitudinal_snapshots') is null
     or to_regclass('public.player_ai_insights') is null then
    raise exception 'AI_USAGE_LEDGER_PREFLIGHT_SCHEMA_MISSING';
  end if;

  if to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is null
     or to_regprocedure('public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb)') is null then
    raise exception 'AI_USAGE_LEDGER_PREFLIGHT_PHASE4D_MISSING';
  end if;

  if to_regclass('public.ai_usage_ledger') is not null and not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='ai_usage_ledger'
      and column_name='idempotency_key' and data_type='uuid'
  ) then
    raise exception 'AI_USAGE_LEDGER_PREFLIGHT_INCOMPATIBLE_EXISTING_TABLE';
  end if;
end $$;

select
  'AI_USAGE_LEDGER_V1_PREFLIGHT' as section,
  true as preflight_ok,
  to_regclass('public.ai_usage_ledger') is not null as already_installed;