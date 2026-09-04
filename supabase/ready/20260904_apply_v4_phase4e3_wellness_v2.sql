-- =============================================================================
-- IQBasket Player 360 Phase 4E.3 - Nutrition + Recovery V2
-- ADDITIVE: adds one non-clinical structured system metric. No existing rows,
-- permissions, RLS policies, functions or observations are rewritten.
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $iq4e3$
begin
  if to_regclass('public.player360_wellness_metric_catalog') is null
     or to_regclass('public.player360_wellness_entries') is null
     or to_regclass('public.player360_wellness_observations') is null
     or to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null then
    raise exception 'PLAYER360_PHASE4E3_PREREQUISITES_MISSING';
  end if;
end
$iq4e3$;

insert into public.player360_wellness_metric_catalog(
  team_season_id,module,code,name,description,value_type,unit,
  min_value,max_value,step,options,sensitivity,enabled,is_system,sort_order
)
select
  null,
  'recovery',
  'DAILY_ENERGY',
  'Energía percibida',
  'Nivel subjetivo de energía disponible para la actividad diaria o deportiva.',
  'SCALE',
  'SCALE_1_5',
  1,
  5,
  1,
  '[]'::jsonb,
  'WELLNESS_RESTRICTED',
  true,
  true,
  60
where not exists (
  select 1
  from public.player360_wellness_metric_catalog
  where team_season_id is null
    and module='recovery'
    and code='DAILY_ENERGY'
);

commit;
