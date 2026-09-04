-- =============================================================================
-- IQBasket Player 360 Phase 4E.3 - Wellness V2 preflight (READ ONLY)
-- Verifies the installed 4E.2 foundation before adding the V2 energy metric.
-- =============================================================================

\set ON_ERROR_STOP on

do $iq4e3$
begin
  if to_regclass('public.player360_wellness_metric_catalog') is null
     or to_regclass('public.player360_wellness_entries') is null
     or to_regclass('public.player360_wellness_observations') is null
     or to_regprocedure('public.iq_v4e2_list_wellness_metric_catalog(uuid,text)') is null
     or to_regprocedure('public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)') is null
     or to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null then
    raise exception 'PLAYER360_PHASE4E3_PREREQUISITES_MISSING';
  end if;

  if exists (
    select 1
    from public.player360_wellness_metric_catalog
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
  ) then
    raise exception 'PLAYER360_PHASE4E3_ALREADY_INSTALLED';
  end if;
end
$iq4e3$;

select
  'PLAYER360_PHASE4E3_PREFLIGHT' as section,
  true as prerequisites_ok,
  not exists (
    select 1
    from public.player360_wellness_metric_catalog
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
  ) as daily_energy_absent;
