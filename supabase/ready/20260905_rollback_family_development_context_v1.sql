-- Emergency rollback for Family Development Context V1.
begin;

do $rollback$
begin
  if to_regclass('public.product_analytics_events') is not null
     and exists(
       select 1 from public.product_analytics_events
       where event_code='FAMILY_WEEKLY_PLAN_VIEWED'
     ) then
    raise exception 'FAMILY_DEVELOPMENT_ROLLBACK_REFUSED_EVENTS_EXIST';
  end if;
end
$rollback$;

drop function if exists public.iq_v10_family_development_context(uuid,uuid);
delete from public.product_event_catalog where code='FAMILY_WEEKLY_PLAN_VIEWED';

commit;
