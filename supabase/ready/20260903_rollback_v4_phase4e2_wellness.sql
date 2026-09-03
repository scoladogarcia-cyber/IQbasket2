-- IQBasket Player 360 Phase 4E.2 rollback
-- Removes ONLY Nutrition/Recovery manual check-in objects.

begin;

drop function if exists public.iq_v4e2_archive_wellness_entry(uuid,text);
drop function if exists public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb);
drop function if exists public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer);
drop function if exists public.iq_v4e2_list_wellness_metric_catalog(uuid,text);
drop function if exists public.iq_v4e2_wellness_capabilities(uuid,uuid,text,text);

drop table if exists public.player360_wellness_observations;
drop table if exists public.player360_wellness_entries;
drop table if exists public.player360_wellness_metric_catalog;

commit;

select
  'PLAYER360_PHASE4E2_ROLLBACK' as section,
  to_regclass('public.player360_wellness_metric_catalog') is null as metric_catalog_removed,
  to_regclass('public.player360_wellness_entries') is null as entries_removed,
  to_regclass('public.player360_wellness_observations') is null as observations_removed,
  to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null as save_rpc_removed;
