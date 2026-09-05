-- Emergency rollback for Family Product Analytics V1.
-- Refuses destructive rollback if real telemetry already exists.
begin;

do $rollback$
begin
  if to_regclass('public.product_analytics_events') is not null
     and exists(select 1 from public.product_analytics_events) then
    raise exception 'PRODUCT_ANALYTICS_ROLLBACK_REFUSED_EVENTS_EXIST';
  end if;
end
$rollback$;

drop function if exists public.iq_v9_product_metrics(integer);
drop function if exists public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer);
drop table if exists public.product_analytics_events;
drop table if exists public.product_event_catalog;

commit;
