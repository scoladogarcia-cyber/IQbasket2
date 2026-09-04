-- =============================================================================
-- IQBasket Player 360 Phase 4E.3 - Wellness V2 rollback
-- Removes DAILY_ENERGY only when unused. If observations already reference it,
-- the metric is disabled instead so historical data remains valid/readable.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $iq4e3$
declare
  v_metric_id uuid;
begin
  select id into v_metric_id
  from public.player360_wellness_metric_catalog
  where team_season_id is null
    and module='recovery'
    and code='DAILY_ENERGY'
  order by created_at desc
  limit 1;

  if v_metric_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.player360_wellness_observations
    where metric_catalog_id=v_metric_id
  ) then
    update public.player360_wellness_metric_catalog
    set enabled=false
    where id=v_metric_id;
  else
    delete from public.player360_wellness_metric_catalog
    where id=v_metric_id;
  end if;
end
$iq4e3$;

commit;
