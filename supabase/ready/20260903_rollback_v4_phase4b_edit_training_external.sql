-- IQBasket Player 360 · Training edit V1 rollback
begin;

drop function if exists public.iq_v4_update_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
);
drop function if exists public.iq_v4_update_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
);

create or replace function public.iq_v4_training_capabilities()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'ready',auth.uid() is not null,
    'training_core',true,
    'external_development',true,
    'activity_catalog',true,
    'temporal_roster_validation',true,
    'recovery',false,
    'nutrition',false,
    'neuro_cognitive',false,
    'contract_version','PLAYER360_OBSERVATION_V1'
  );
$$;

revoke all on function public.iq_v4_training_capabilities() from public,anon;
grant execute on function public.iq_v4_training_capabilities() to authenticated;

commit;
