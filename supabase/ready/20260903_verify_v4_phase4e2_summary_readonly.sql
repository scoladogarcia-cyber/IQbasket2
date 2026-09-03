-- Player 360 Phase 4E.2 post-apply verifier. READ ONLY.

with objects as (
  select
    to_regclass('public.player360_wellness_metric_catalog') is not null as metric_catalog_ok,
    to_regclass('public.player360_wellness_entries') is not null as entries_ok,
    to_regclass('public.player360_wellness_observations') is not null as observations_ok,
    to_regprocedure('public.iq_v4e2_wellness_capabilities(uuid,uuid,text,text)') is not null as capabilities_ok,
    to_regprocedure('public.iq_v4e2_list_wellness_metric_catalog(uuid,text)') is not null as metric_list_ok,
    to_regprocedure('public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)') is not null as entry_list_ok,
    to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is not null as save_ok,
    to_regprocedure('public.iq_v4e2_archive_wellness_entry(uuid,text)') is not null as archive_ok
),
rls as (
  select count(*)=3 as rls_ok
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in (
      'player360_wellness_metric_catalog',
      'player360_wellness_entries',
      'player360_wellness_observations'
    )
    and c.relrowsecurity
),
privileges as (
  select
    not has_table_privilege('authenticated','public.player360_wellness_metric_catalog','SELECT') as catalog_private,
    not has_table_privilege('authenticated','public.player360_wellness_entries','SELECT') as entries_private,
    not has_table_privilege('authenticated','public.player360_wellness_entries','INSERT') as entries_write_private,
    not has_table_privilege('authenticated','public.player360_wellness_observations','SELECT') as observations_private,
    has_function_privilege(
      'authenticated',
      'public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)',
      'EXECUTE'
    ) as authenticated_list_rpc,
    has_function_privilege(
      'authenticated',
      'public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)',
      'EXECUTE'
    ) as authenticated_save_rpc,
    not has_function_privilege(
      'anon',
      'public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)',
      'EXECUTE'
    ) as anon_list_blocked,
    not has_function_privilege(
      'anon',
      'public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)',
      'EXECUTE'
    ) as anon_save_blocked
),
catalog as (
  select
    count(*) filter (where is_system)=9 as system_metric_count,
    count(*) filter (
      where code in (
        'WEIGHT_KG','BMI','BODY_FAT_PCT','CALORIE_INTAKE','ENERGY_DEFICIT',
        'MENSTRUATION','MEDICATION','DIAGNOSIS','CLINICAL_SYMPTOMS'
      )
    )=0 as prohibited_metrics_absent,
    count(*) filter (where sensitivity<>'WELLNESS_RESTRICTED')=0 as sensitivity_ok,
    count(*) filter (where value_type='TEXT')=0 as no_text_metrics
  from public.player360_wellness_metric_catalog
),
rows as (
  select
    (select count(*) from public.player360_wellness_entries)=0 as entries_empty,
    (select count(*) from public.player360_wellness_observations)=0 as observations_empty
),
shape as (
  select
    not exists (
      select 1
      from information_schema.columns
      where table_schema='public'
        and table_name in ('player360_wellness_entries','player360_wellness_observations')
        and column_name in ('notes','comment','free_text','diagnosis','medication','weight','calories','external_provider')
    ) as no_sensitive_free_text_columns
),
legacy as (
  select
    to_regclass('public.player360_processing_authorizations') is not null as phase4e_auth_ok,
    to_regclass('public.player360_sensitive_access_grants') is not null as phase4e_grants_ok,
    to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as phase4e_abac_ok,
    to_regclass('public.player_longitudinal_snapshots') is not null as phase4d_ok,
    to_regclass('public.training_sessions') is not null as phase4b_ok,
    to_regclass('public.roster_membership_stints') is not null as v3_stints_ok
)
select
  'PLAYER360_PHASE4E2_POST_APPLY' as section,
  o.*,r.rls_ok,p.*,c.*,x.*,s.no_sensitive_free_text_columns,l.*,
  (
    o.metric_catalog_ok and o.entries_ok and o.observations_ok
    and o.capabilities_ok and o.metric_list_ok and o.entry_list_ok
    and o.save_ok and o.archive_ok
    and r.rls_ok
    and p.catalog_private and p.entries_private and p.entries_write_private
    and p.observations_private and p.authenticated_list_rpc and p.authenticated_save_rpc
    and p.anon_list_blocked and p.anon_save_blocked
    and c.system_metric_count=9 and c.prohibited_metrics_absent
    and c.sensitivity_ok and c.no_text_metrics
    and x.entries_empty and x.observations_empty
    and s.no_sensitive_free_text_columns
    and l.phase4e_auth_ok and l.phase4e_grants_ok and l.phase4e_abac_ok
    and l.phase4d_ok and l.phase4b_ok and l.v3_stints_ok
  ) as phase4e2_ok
from objects o cross join rls r cross join privileges p cross join catalog c
cross join rows x cross join shape s cross join legacy l;
