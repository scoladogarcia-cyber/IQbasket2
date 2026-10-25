-- V68: player/guardian-owned continuity across clubs. Only explicitly shared,
-- non-private scores; never exposes old clubs' private staff evaluations.
begin;
create or replace function public.iq_v68_passport_shared_career(
 p_player_id uuid,p_team_season_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;
begin
 if auth.uid() is null or not public.iq_account_is_active()
    or not public.iq_v4_can_access_player_passport(p_player_id,p_team_season_id)
 then raise exception 'PASSPORT_ACCESS_DENIED' using errcode='42501'; end if;
 if not iq_private.family_can_view_player(auth.uid(),p_player_id)
 then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'evaluation_date',e.evaluation_date,'title',e.title,
   'created_at',e.created_at,'metadata',e.metadata,
   'history_access','PLAYER_OR_GUARDIAN_SHARED',
   'scores',coalesce((
      select jsonb_agg(jsonb_build_object(
        'metric_code',s.metric_code,'score',s.score,
        'evaluation_context',coalesce(s.evaluation_context,s.metadata->>'evaluation_context'),
        'confidence_label',s.confidence_label,
        'evidence_count',coalesce(s.evidence_count,0),
        'metadata',s.metadata
      ) order by s.metric_code)
      from public.player_evaluation_scores s
      where s.evaluation_id=e.id
        and iq_private.iq_v4_score_is_player_passport(s.metric_code)
   ),'[]'::jsonb)
 ) order by e.evaluation_date desc,e.created_at desc),'[]'::jsonb)
 into v_items
 from public.player_evaluations e
 where e.player_id=p_player_id
   and e.team_season_id<>p_team_season_id
   and e.status<>'ARCHIVED'
   and e.share_with_player is true and coalesce(e.is_private,false)=false;
 return v_items;
end $$;
revoke all on function public.iq_v68_passport_shared_career(uuid,uuid) from public,anon;
grant execute on function public.iq_v68_passport_shared_career(uuid,uuid) to authenticated;
commit;