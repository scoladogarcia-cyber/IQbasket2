-- V64: RBAC guarded reclassification of recovered training records.
create or replace function public.iq_v64_correct_training_kind(
 p_session_id uuid, p_team_season_id uuid, p_kind text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old public.training_sessions%rowtype; v_kind text := upper(trim(coalesce(p_kind,'')));
begin
 if auth.uid() is null or not public.iq_account_is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if v_kind not in ('TEAM','TECHNIFICATION','PERSONAL','COGNITIVE') then
   raise exception 'TRAINING_KIND_INVALID';
 end if;
 if not public.iq_v4_can_manage_training(p_team_season_id) then
   raise exception 'TRAINING_KIND_PERMISSION_DENIED';
 end if;
 select * into v_old from public.training_sessions
 where id=p_session_id and team_season_id=p_team_season_id for update;
 if not found then raise exception 'TRAINING_SESSION_NOT_FOUND'; end if;
 if upper(v_old.status)='ARCHIVED' then raise exception 'TRAINING_ARCHIVED'; end if;
 update public.training_sessions
 set metadata=coalesce(v_old.metadata,'{}'::jsonb)
   || jsonb_build_object('session_kind',v_kind,'session_kind_review','REVIEWED',
       'session_kind_reviewer',auth.uid(),'session_kind_reviewed_at',now(),
       'session_kind_previous',v_old.metadata->>'session_kind'),
     updated_by=auth.uid(), updated_at=now()
 where id=p_session_id;
 return p_session_id;
end $$;
revoke all on function public.iq_v64_correct_training_kind(uuid,uuid,text) from public,anon;
grant execute on function public.iq_v64_correct_training_kind(uuid,uuid,text) to authenticated;