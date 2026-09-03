-- Training duration/attendance hotfix verifier. READ ONLY.
with fn as (
  select pg_get_functiondef(
    'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)'::regprocedure
  ) as body
)
select
  'TRAINING_DURATION_HOTFIX_VERIFY' as section,
  position('TRAINING_DURATION_MISMATCH' in body)>0 as mismatch_guard_ok,
  position('TRAINING_TIME_PAIR_REQUIRED' in body)>0 as pair_guard_ok,
  position('extract(epoch from (p_end_time - p_start_time))' in body)>0 as derived_duration_ok,
  position('v_default_attendance' in body)>0 as historical_default_ok,
  has_function_privilege(
    'authenticated',
    'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)',
    'EXECUTE'
  ) as execute_ok,
  (
    position('TRAINING_DURATION_MISMATCH' in body)>0
    and position('TRAINING_TIME_PAIR_REQUIRED' in body)>0
    and position('extract(epoch from (p_end_time - p_start_time))' in body)>0
    and position('v_default_attendance' in body)>0
    and has_function_privilege(
      'authenticated',
      'public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time without time zone,time without time zone,jsonb,jsonb)',
      'EXECUTE'
    )
  ) as hotfix_ok
from fn;
