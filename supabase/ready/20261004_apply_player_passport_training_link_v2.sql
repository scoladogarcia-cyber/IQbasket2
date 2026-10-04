-- IQBasket Player Passport V2 - explicit training-session evidence link.
begin;

create or replace function public.iq_v4_save_player_passport_evaluation_v2(
  p_team_season_id uuid,p_player_id uuid,p_evaluation_date date,p_title text,
  p_context text,p_scores jsonb,p_summary text default null,p_strengths text default null,
  p_development_priorities text default null,p_existing_evaluation_id uuid default null,
  p_training_session_id uuid default null
)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_id uuid; v_training public.training_sessions;
begin
  if p_training_session_id is not null then
    select * into v_training
    from public.training_sessions
    where id=p_training_session_id;
    if v_training.id is null then raise exception 'PLAYER_PASSPORT_TRAINING_NOT_FOUND'; end if;
    if v_training.team_season_id<>p_team_season_id then raise exception 'PLAYER_PASSPORT_TRAINING_SCOPE_MISMATCH'; end if;
    if v_training.session_date<>p_evaluation_date then raise exception 'PLAYER_PASSPORT_TRAINING_DATE_MISMATCH'; end if;
    if not public.iq_v4_can_manage_evaluation(p_team_season_id) then
      raise exception 'PLAYER_PASSPORT_TRAINING_EVALUATION_DENIED' using errcode='42501';
    end if;
  end if;

  v_id:=public.iq_v4_save_player_passport_evaluation(
    p_team_season_id,p_player_id,p_evaluation_date,p_title,p_context,p_scores,
    p_summary,p_strengths,p_development_priorities,p_existing_evaluation_id
  );

  if p_training_session_id is not null then
    update public.player_evaluations
    set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'training_session_id',p_training_session_id,
      'evidence_source','TRAINING'
    )
    where id=v_id;

    insert into public.player_evaluation_evidence(
      evaluation_score_id,evidence_type,training_session_id,note,created_by
    )
    select s.id,'TRAINING',p_training_session_id,
      nullif(trim(coalesce(s.notes,'')),''),auth.uid()
    from public.player_evaluation_scores s
    where s.evaluation_id=v_id;
  end if;

  return v_id;
end
$fn$;

revoke all on function public.iq_v4_save_player_passport_evaluation_v2(
  uuid,uuid,date,text,text,jsonb,text,text,text,uuid,uuid
) from public,anon;
grant execute on function public.iq_v4_save_player_passport_evaluation_v2(
  uuid,uuid,date,text,text,jsonb,text,text,text,uuid,uuid
) to authenticated;

commit;
