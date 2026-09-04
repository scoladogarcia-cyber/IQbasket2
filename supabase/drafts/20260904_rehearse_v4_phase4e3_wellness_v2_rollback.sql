-- =============================================================================
-- IQBasket Player 360 Phase 4E.3 - transactional rollback rehearsal
-- Never persists changes. Validates that the additive metric can be removed
-- without touching existing wellness entries/observations.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $iq4e3$
declare
  v_metric_id uuid;
  v_entry_count bigint;
  v_observation_count bigint;
begin
  if exists (
    select 1
    from public.player360_wellness_metric_catalog
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
  ) then
    raise exception 'PLAYER360_PHASE4E3_REHEARSAL_REQUIRES_UNINSTALLED_METRIC';
  end if;

  select count(*) into v_entry_count from public.player360_wellness_entries;
  select count(*) into v_observation_count from public.player360_wellness_observations;

  insert into public.player360_wellness_metric_catalog(
    team_season_id,module,code,name,description,value_type,unit,
    min_value,max_value,step,options,sensitivity,enabled,is_system,sort_order
  ) values (
    null,'recovery','DAILY_ENERGY','Energía percibida',
    'Nivel subjetivo de energía disponible para la actividad diaria o deportiva.',
    'SCALE','SCALE_1_5',1,5,1,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,60
  ) returning id into v_metric_id;

  if v_metric_id is null then
    raise exception 'PLAYER360_PHASE4E3_REHEARSAL_INSERT_FAILED';
  end if;

  delete from public.player360_wellness_metric_catalog where id=v_metric_id;

  if exists (
    select 1
    from public.player360_wellness_metric_catalog
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
  ) then
    raise exception 'PLAYER360_PHASE4E3_REHEARSAL_ROLLBACK_FAILED';
  end if;

  if (select count(*) from public.player360_wellness_entries) <> v_entry_count
     or (select count(*) from public.player360_wellness_observations) <> v_observation_count then
    raise exception 'PLAYER360_PHASE4E3_REHEARSAL_DATA_CHANGED';
  end if;
end
$iq4e3$;

rollback;
