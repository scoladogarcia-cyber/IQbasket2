-- Training duration/attendance hotfix preflight. READ ONLY.
with fn as (
  select pg_get_functiondef(
    'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
  ) as body
)
select
  'TRAINING_DURATION_HOTFIX_PREFLIGHT' as section,
  to_regclass('public.training_sessions') is not null as sessions_ok,
  to_regclass('public.training_participants') is not null as participants_ok,
  to_regprocedure('public.iq_v4_can_manage_training(uuid)') is not null as manage_helper_ok,
  position('TRAINING_DURATION_MISMATCH' in body)=0 as hotfix_absent,
  (
    to_regclass('public.training_sessions') is not null
    and to_regclass('public.training_participants') is not null
    and to_regprocedure('public.iq_v4_can_manage_training(uuid)') is not null
    and position('TRAINING_DURATION_MISMATCH' in body)=0
  ) as preflight_ok
from fn;
