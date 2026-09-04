-- =============================================================================
-- IQBasket Player 360 Phase 4E.3 - Wellness V2 verification (READ ONLY)
-- =============================================================================

\set ON_ERROR_STOP on

do $iq4e3$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.player360_wellness_metric_catalog
  where team_season_id is null
    and module='recovery'
    and code='DAILY_ENERGY'
    and name='Energía percibida'
    and value_type='SCALE'
    and unit='SCALE_1_5'
    and min_value=1
    and max_value=5
    and step=1
    and sensitivity='WELLNESS_RESTRICTED'
    and enabled
    and is_system
    and sort_order=60;

  if v_count <> 1 then
    raise exception 'PLAYER360_PHASE4E3_VERIFY_DAILY_ENERGY_INVALID';
  end if;

  if exists (
    select 1
    from public.player360_wellness_metric_catalog
    where code in (
      'WEIGHT_KG','BMI','BODY_FAT_PCT','CALORIE_INTAKE','ENERGY_DEFICIT',
      'MENSTRUATION','MEDICATION','DIAGNOSIS','CLINICAL_SYMPTOMS'
    )
      and is_system
  ) then
    raise exception 'PLAYER360_PHASE4E3_PROHIBITED_SYSTEM_METRIC_PRESENT';
  end if;
end
$iq4e3$;

select
  'PLAYER360_PHASE4E3_VERIFY' as section,
  count(*) filter (
    where team_season_id is null
      and module='recovery'
      and code='DAILY_ENERGY'
      and enabled
  ) = 1 as daily_energy_ok,
  to_regprocedure('public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)') is not null as existing_read_api_preserved,
  to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is not null as existing_write_api_preserved
from public.player360_wellness_metric_catalog;
