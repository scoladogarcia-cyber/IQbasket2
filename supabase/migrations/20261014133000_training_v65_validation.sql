-- V65: explicit session validation and reopening; no bulk mutations to historical rows.
begin;
create or replace function public.iq_v65_set_training_validation(
 p_session_id uuid, p_team_season_id uuid, p_validate boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.training_sessions%rowtype;v_invalid integer;
begin
 if auth.uid() is null or not public.iq_account_is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if not public.iq_v4_can_manage_training(p_team_season_id) then raise exception 'TRAINING_MANAGE_DENIED'; end if;
 select * into v_session from public.training_sessions
 where id=p_session_id and team_season_id=p_team_season_id for update;
 if not found then raise exception 'TRAINING_NOT_FOUND'; end if;
 if upper(v_session.status) in ('ARCHIVED','CANCELLED') then raise exception 'TRAINING_NOT_VALIDATABLE'; end if;
 if p_validate then
   if v_session.session_date > current_date then raise exception 'TRAINING_CANNOT_VALIDATE_FUTURE'; end if;
   if v_session.duration_minutes is null or v_session.duration_minutes<1 then raise exception 'TRAINING_DURATION_REQUIRED'; end if;
   select count(*) into v_invalid from public.training_participants p
   where p.training_session_id=p_session_id and (
     p.attendance_status='PLANNED'
     or (p.attendance_status in ('PRESENT','PARTIAL') and
        (p.participated_minutes is null or p.participated_minutes<0 or p.participated_minutes>v_session.duration_minutes))
     or (p.attendance_status in ('ABSENT','EXCUSED') and coalesce(p.participated_minutes,0)<>0));
   if v_invalid>0 then raise exception 'TRAINING_PARTICIPANTS_NEED_CONFIRMATION'; end if;
   if not exists (select 1 from public.training_participants p where p.training_session_id=p_session_id)
      then raise exception 'TRAINING_NO_PARTICIPANTS'; end if;
 end if;
 update public.training_sessions
 set status=case when p_validate then 'COMPLETED' else 'PLANNED' end,
     updated_by=auth.uid(),updated_at=now(),
     metadata=coalesce(metadata,'{}'::jsonb) ||
       jsonb_build_object('validation_last_action',case when p_validate then 'VALIDATED' else 'REOPENED' end,
                          'validation_last_actor',auth.uid(),'validation_last_at',now())
 where id=p_session_id;
 return p_session_id;
end $$;
revoke all on function public.iq_v65_set_training_validation(uuid,uuid,boolean) from public,anon;
grant execute on function public.iq_v65_set_training_validation(uuid,uuid,boolean) to authenticated;
commit;