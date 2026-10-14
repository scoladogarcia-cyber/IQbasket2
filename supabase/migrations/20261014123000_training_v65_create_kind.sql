-- Training V65: create type atomically in the existing RBAC-checked session RPC.
-- Team-season ID remains an authorization context; it is not participant membership.
begin;
create or replace function public.iq_v65_create_training_session(
 p_team_season_id uuid,p_session_date date,p_title text,p_objective text default null,
 p_notes text default null,p_duration_minutes integer default null,p_intensity numeric default null,
 p_start_time time default null,p_end_time time default null,p_blocks jsonb default '[]'::jsonb,
 p_participants jsonb default '[]'::jsonb,p_focus_codes text[] default '{}'::text[],
 p_clone_source_id uuid default null,p_entry_mode text default 'QUICK',p_kind text default 'TEAM'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_kind text:=upper(trim(coalesce(p_kind,'')));
begin
 if auth.uid() is null or not public.iq_account_is_active() then raise exception 'AUTH_REQUIRED'; end if;
 if not public.iq_v4_can_manage_training(p_team_season_id) then raise exception 'TRAINING_MANAGE_DENIED'; end if;
 if v_kind not in ('TEAM','TECHNIFICATION','PERSONAL','COGNITIVE') then raise exception 'TRAINING_KIND_INVALID'; end if;
 v_id:=public.iq_v55_create_training_session(p_team_season_id,p_session_date,p_title,p_objective,p_notes,
 p_duration_minutes,p_intensity,p_start_time,p_end_time,p_blocks,p_participants,p_focus_codes,p_clone_source_id,p_entry_mode);
 update public.training_sessions set metadata=coalesce(metadata,'{}'::jsonb)
 || jsonb_build_object('session_kind',v_kind,'session_kind_review','REVIEWED',
 'session_kind_provenance','USER_SELECTED','session_kind_reviewer',auth.uid())
 where id=v_id and team_season_id=p_team_season_id;
 return v_id;
end $$;
revoke all on function public.iq_v65_create_training_session(uuid,date,text,text,text,integer,numeric,time,time,jsonb,jsonb,text[],uuid,text,text) from public,anon;
grant execute on function public.iq_v65_create_training_session(uuid,date,text,text,text,integer,numeric,time,time,jsonb,jsonb,text[],uuid,text,text) to authenticated;
commit;
