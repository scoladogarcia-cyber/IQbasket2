-- Read-only verification for Family Product Analytics V1.
select
  to_regclass('public.product_event_catalog') is not null as catalog_ok,
  to_regclass('public.product_analytics_events') is not null as events_ok,
  to_regprocedure('public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)') is not null as track_ok,
  to_regprocedure('public.iq_v9_product_metrics(integer)') is not null as metrics_ok;

select
  (select relrowsecurity from pg_class where oid='public.product_event_catalog'::regclass) as catalog_rls,
  (select relrowsecurity from pg_class where oid='public.product_analytics_events'::regclass) as events_rls,
  has_table_privilege('authenticated','public.product_analytics_events','SELECT') as auth_select,
  has_table_privilege('authenticated','public.product_analytics_events','INSERT') as auth_insert,
  has_function_privilege('authenticated','public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)','EXECUTE') as auth_track,
  has_function_privilege('anon','public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)','EXECUTE') as anon_track;

select count(*)::integer as catalog_events from public.product_event_catalog;
select count(*)::integer as stored_events from public.product_analytics_events;
