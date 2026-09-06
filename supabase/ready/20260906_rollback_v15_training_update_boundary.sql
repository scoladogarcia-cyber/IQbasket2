begin;

drop trigger if exists trg_iq_training_full_attendance_duration_sync
  on public.training_sessions;
drop trigger if exists trg_iq_training_duration_canonical_guard
  on public.training_sessions;

drop function if exists public.iq_v15_update_training_session(
  uuid,uuid,date,text,text,time without time zone,time without time zone,integer,numeric
);
drop function if exists iq_private.iq_training_full_attendance_duration_sync();
drop function if exists iq_private.iq_training_duration_canonical_guard();

commit;
