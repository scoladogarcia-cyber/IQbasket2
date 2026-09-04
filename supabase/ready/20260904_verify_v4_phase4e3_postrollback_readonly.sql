-- =============================================================================
-- IQBasket Player 360 Phase 4E.3 - post-rollback verification (READ ONLY)
-- DAILY_ENERGY must either be absent or disabled. 4E.2 APIs stay installed.
-- =============================================================================

\set ON_ERROR_STOP on

do $iq4e3$
begin
  if exists (
    select 1
    from public.player360_wellness_metric_catalog
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
      and enabled
  ) then
    raise exception 'PLAYER360_PHASE4E3_ROLLBACK_METRIC_STILL_ENABLED';
  end if;

  if to_regprocedure('public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)') is null
     or to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null then
    raise exception 'PLAYER360_PHASE4E3_ROLLBACK_DAMAGED_PHASE4E2';
  end if;
end
$iq4e3$;

select
  'PLAYER360_PHASE4E3_POST_ROLLBACK' as section,
  not exists (
    select 1
    from public.player360_wellness_metric_catalog
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
      and enabled
  ) as daily_energy_not_active,
  to_regprocedure('public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)') is not null as phase4e2_read_api_preserved,
  to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is not null as phase4e2_write_api_preserved;
