-- IQBasket Player 360 · Training edit V1 preflight · READ ONLY
with checks as (
  select
    to_regclass('public.training_sessions') is not null as sessions_ok,
    to_regclass('public.training_blocks') is not null as blocks_ok,
    to_regclass('public.training_participants') is not null as participants_ok,
    to_regclass('public.external_development_sessions') is not null as external_ok,
    to_regprocedure('public.iq_v4_can_manage_training(uuid)') is not null as manage_helper_ok,
    to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)') is not null as create_training_ok,
    to_regprocedure('public.iq_v4_create_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null as create_external_ok
)
select
  'TRAINING_EDIT_PREFLIGHT' as section,
  *,
  sessions_ok and blocks_ok and participants_ok and external_ok
    and manage_helper_ok and create_training_ok and create_external_ok as all_ok
from checks;

select
  'TRAINING_EDIT_BASELINE' as section,
  (select count(*) from public.training_sessions) as training_sessions,
  (select count(*) from public.training_blocks) as training_blocks,
  (select count(*) from public.training_participants) as training_participants,
  (select count(*) from public.external_development_sessions) as external_development;


select
  'TRAINING_EDIT_EXISTING_RPC' as section,
  p.oid::regprocedure::text as signature,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  replace(replace(pg_get_functiondef(p.oid), E'\n', ' '), E'\r', ' ') as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'iq_v4_update_training_session',
    'iq_v4_update_external_development'
  )
order by p.proname;
