-- IQBasket V70: compact family-owned passport summary.
-- Read-only. Never alters scores, sessions or access to other players.
-- Independently gates relationship AND commercial feature entitlement.
begin;
create or replace function public.iq_v70_family_passport_brief(p_player_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
 v_profile jsonb;
 v_history jsonb;
 v_advanced jsonb;
 v_has_history boolean;
 v_has_advanced boolean;
 v_category text;
 v_season_name text;
 v_team_name text;
 v_recorded bigint:=0;
 v_accredited bigint:=0;
 v_sessions integer:=0;
 v_pending_sessions integer:=0;
 v_pending_kind integer:=0;
 v_unknown_minutes integer:=0;
 v_rated integer:=0;
 v_documented integer:=0;
 v_unverified integer:=0;
begin
 if auth.uid() is null or not public.iq_account_is_active()
    or not iq_private.family_can_view_player(auth.uid(),p_player_id) then
   raise exception 'FAMILY_PLAYER_ACCESS_DENIED' using errcode='42501';
 end if;
 v_profile:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'PLAYER_PROFILE',1);
 if not public.iq_v3_is_global_superadmin()
   and not coalesce((v_profile->>'allowed')::boolean,false) then
   raise exception 'FAMILY_PROFILE_NOT_INCLUDED' using errcode='42501';
 end if;
 v_history:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'GAME_HISTORY',1);
 v_advanced:=public.iq_saas_entitlement_check('PLAYER',p_player_id,null,'PLAYER_PASSPORT',1);
 v_has_history:=public.iq_v3_is_global_superadmin() or coalesce((v_history->>'allowed')::boolean,false);
 v_has_advanced:=public.iq_v3_is_global_superadmin() or coalesce((v_advanced->>'allowed')::boolean,false);

 select t.category,t.name,sc.name
 into v_category,v_team_name,v_season_name
 from public.roster_memberships rm
 join public.team_seasons ts on ts.id=rm.team_season_id
 join public.teams t on t.id=ts.team_id
 join public.season_catalog sc on sc.id=ts.season_id
 where rm.player_id=p_player_id
 order by
  (upper(coalesce(rm.status,'ACTIVE'))='ACTIVE') desc,
  sc.end_date desc nulls last,
  sc.start_date desc nulls last,rm.id
 limit 1;

 if v_has_history then
   select count(*)::integer,
     coalesce(sum(case when tp.attendance_status in ('PRESENT','PARTIAL')
       and ts.session_date <= current_date and tp.participated_minutes is not null
       then greatest(0,least(tp.participated_minutes,coalesce(ts.duration_minutes,0)))
       else 0 end),0)::bigint,
     coalesce(sum(case when ts.status='COMPLETED'
       and tp.attendance_status in ('PRESENT','PARTIAL') and ts.session_date<=current_date
       and tp.participated_minutes is not null
       then greatest(0,least(tp.participated_minutes,coalesce(ts.duration_minutes,0)))
       else 0 end),0)::bigint,
     count(*) filter(where ts.status<>'COMPLETED'
        and ts.session_date<=current_date
        and tp.attendance_status in ('PRESENT','PARTIAL')
        and coalesce(tp.participated_minutes,0)>0)::integer,
     count(*) filter(where coalesce(ts.metadata->>'session_kind_review','NOT_REVIEWED')
        in ('PENDING','NOT_REVIEWED'))::integer,
     count(*) filter(where tp.attendance_status in ('PRESENT','PARTIAL')
       and ts.session_date<=current_date and tp.participated_minutes is null)::integer
   into v_sessions,v_recorded,v_accredited,v_pending_sessions,v_pending_kind,v_unknown_minutes
   from public.training_participants tp
   join public.training_sessions ts on ts.id=tp.training_session_id
   where tp.player_id=p_player_id;
 end if;

 if v_has_advanced then
   with ranked as (
     select distinct on (upper(s.metric_code))
       s.metric_code,s.evidence_count,s.metadata,
       s.rubric_version,e.evaluation_date,e.created_at
     from public.player_evaluation_scores s
     join public.player_evaluations e on e.id=s.evaluation_id
     where e.player_id=p_player_id
       and e.status<>'ARCHIVED'
       and e.share_with_player is true
       and coalesce(e.is_private,false)=false
       and iq_private.iq_v4_score_is_player_passport(s.metric_code)
     order by upper(s.metric_code),e.evaluation_date desc,e.created_at desc,s.id desc
   )
   select count(*)::integer,
       count(*) filter(where r.metric_code is not null
         and coalesce(ranked.evidence_count,0)>=r.minimum_observations
         and upper(coalesce(ranked.metadata->>'difficulty_tier','')) in ('D1','D2','D3','D4','D5')
         and ranked.rubric_version=r.rubric_version)::integer
   into v_rated,v_documented
   from ranked
   left join iq_private.iq_passport_attribute_rules_v68 r
     on r.metric_code=upper(ranked.metric_code);
   v_unverified:=greatest(0,v_rated-v_documented);
 end if;

 return jsonb_build_object(
   'player_id',p_player_id,
   'category',v_category,'team_name',v_team_name,'season_name',v_season_name,
   'training_access',v_has_history,
   'training',case when v_has_history then jsonb_build_object(
     'sessions',v_sessions,'recorded_minutes',v_recorded,
     'accredited_minutes',v_accredited,
     'pending_minutes',greatest(0,v_recorded-v_accredited),
     'pending_sessions',v_pending_sessions,'classification_to_review',v_pending_kind,
     'without_minutes',v_unknown_minutes) else null end,
   'evaluation_access',v_has_advanced,
   'evaluation_quality',case when v_has_advanced then jsonb_build_object(
     'attributes_rated',v_rated,'with_documented_observations',v_documented,
     'pending_documentation',v_unverified,'scientific_calibration','PENDING'
   ) else null end,
   'source','IQB_FAMILY_RBAC_ENTITLEMENTS_V70'
 );
end
$function$;
revoke all on function public.iq_v70_family_passport_brief(uuid) from public,anon;
grant execute on function public.iq_v70_family_passport_brief(uuid) to authenticated;
comment on function public.iq_v70_family_passport_brief(uuid)
is 'Family-only player-scoped summary; guarded by active verified relationship and SaaS entitlements. Read-only.';
commit;
