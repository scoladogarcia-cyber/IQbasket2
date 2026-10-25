-- IQBasket V68: enforced evidence counts and difficulty/protocol provenance for new scores.
-- Historical scores are preserved and remain visibly provisional if evidence_count=0.
begin;
create table if not exists iq_private.iq_passport_attribute_rules_v68 (
 metric_code text primary key,
 minimum_observations integer not null check (minimum_observations between 1 and 50),
 rubric_version text not null,
 valid_contexts text[] not null
);
revoke all on iq_private.iq_passport_attribute_rules_v68 from public, anon, authenticated;
insert into iq_private.iq_passport_attribute_rules_v68
(metric_code,minimum_observations,rubric_version,valid_contexts)
values
('TEC-BOT-01',8,'1.0',ARRAY['T','JR','P5']),
('TEC-BOT-02',8,'1.0',ARRAY['T','JR','P5']),
('TEC-BOT-03',8,'1.0',ARRAY['T','JR','P5']),
('TEC-BOT-04',8,'1.0',ARRAY['T','JR','P5']),
('TEC-BOT-05',8,'1.0',ARRAY['T','JR','P5']),
('TEC-BOT-06',8,'1.0',ARRAY['T','JR','P5']),
('TEC-BOT-07',6,'1.0',ARRAY['T','JR','P5']),
('TEC-PAS-01',8,'1.0',ARRAY['T','JR','P5']),
('TEC-PAS-02',8,'1.0',ARRAY['T','JR','P5']),
('TEC-PAS-03',8,'1.0',ARRAY['T','JR','P5']),
('TEC-PAS-04',8,'1.0',ARRAY['T','JR','P5']),
('TEC-PAS-05',8,'1.0',ARRAY['T','JR','P5']),
('TEC-PAS-06',8,'1.0',ARRAY['T','JR','P5']),
('TEC-FIN-01',8,'1.0',ARRAY['T','JR','P5']),
('TEC-FIN-02',8,'1.0',ARRAY['T','JR','P5']),
('TEC-FIN-03',8,'1.0',ARRAY['T','JR','P5']),
('TEC-FIN-04',8,'1.0',ARRAY['T','JR','P5']),
('TEC-FIN-05',8,'1.0',ARRAY['T','JR','P5']),
('TEC-FIN-06',8,'1.0',ARRAY['T','JR','P5']),
('TEC-TIR-01',8,'1.0',ARRAY['T','JR','P5']),
('TEC-TIR-02',8,'1.0',ARRAY['T','JR','P5']),
('TEC-TIR-03',8,'1.0',ARRAY['T','JR','P5']),
('TEC-TIR-04',8,'1.0',ARRAY['T','JR','P5']),
('TEC-TIR-05',6,'1.0',ARRAY['T','JR','P5']),
('TEC-TIR-06',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-01',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-02',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-03',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-04',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-05',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-06',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-07',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-08',6,'1.0',ARRAY['JR','P5']),
('TAC-OF-09',6,'1.0',ARRAY['JR','P5']),
('TAC-OF-10',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-11',8,'1.0',ARRAY['JR','P5']),
('TAC-OF-12',6,'1.0',ARRAY['P5']),
('DEF-01',8,'1.0',ARRAY['T','JR','P5']),
('DEF-02',8,'1.0',ARRAY['JR','P5']),
('DEF-03',8,'1.0',ARRAY['JR','P5']),
('DEF-04',8,'1.0',ARRAY['JR','P5']),
('DEF-05',8,'1.0',ARRAY['JR','P5']),
('DEF-06',8,'1.0',ARRAY['JR','P5']),
('DEF-07',8,'1.0',ARRAY['JR','P5']),
('DEF-08',8,'1.0',ARRAY['JR','P5']),
('DEF-09',8,'1.0',ARRAY['JR','P5']),
('DEF-10',6,'1.0',ARRAY['JR','P5']),
('DEF-11',6,'1.0',ARRAY['JR','P5']),
('DEF-12',8,'1.0',ARRAY['P5']),
('DEF-13',8,'1.0',ARRAY['JR','P5']),
('DEF-14',8,'1.0',ARRAY['JR','P5']),
('DEF-15',8,'1.0',ARRAY['JR','P5']),
('DEF-16',8,'1.0',ARRAY['JR','P5']),
('DEF-17',8,'1.0',ARRAY['JR','P5']),
('MEN-01',5,'1.0',ARRAY['T','JR','P5']),
('MEN-02',5,'1.0',ARRAY['JR','P5']),
('MEN-03',5,'1.0',ARRAY['P5']),
('MEN-04',5,'1.0',ARRAY['T','JR','P5']),
('MEN-05',5,'1.0',ARRAY['T','JR','P5']),
('MEN-06',5,'1.0',ARRAY['T','JR','P5']),
('MEN-07',5,'1.0',ARRAY['T','JR','P5']),
('MEN-08',5,'1.0',ARRAY['T','JR','P5']),
('MEN-09',6,'1.0',ARRAY['JR','P5']),
('COL-01',5,'1.0',ARRAY['JR','P5']),
('COL-02',6,'1.0',ARRAY['JR','P5']),
('COL-03',6,'1.0',ARRAY['P5']),
('COL-04',6,'1.0',ARRAY['JR','P5']),
('COL-05',6,'1.0',ARRAY['T','JR','P5']),
('COL-06',5,'1.0',ARRAY['T','JR','P5'])
on conflict(metric_code) do update
set minimum_observations=excluded.minimum_observations,
 rubric_version=excluded.rubric_version,valid_contexts=excluded.valid_contexts;

create or replace function public.iq_v68_save_guided_passport_evaluation(
 p_team_season_id uuid,p_player_id uuid,p_evaluation_date date,p_title text,
 p_context text,p_scores jsonb,p_summary text default null,
 p_training_session_id uuid default null,p_assessment_duration_minutes integer default null,
 p_protocol_version text default 'IQB-RUBRIC-1.0'
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_item jsonb;v_rule iq_private.iq_passport_attribute_rules_v68%rowtype;
        v_id uuid; v_category text;v_competition text;v_seen text[]:='{}'::text[];
        v_code text;v_difficulty text;v_count integer;
begin
 if auth.uid() is null or not public.iq_account_is_active() or
    not public.iq_v4_can_access_player_passport(p_player_id,p_team_season_id) or
    not public.iq_v4_can_manage_evaluation(p_team_season_id)
 then raise exception 'PLAYER_PASSPORT_EDIT_DENIED' using errcode='42501'; end if;
 if p_context not in ('T','JR','P5','VIDEO') then raise exception 'PASSPORT_CONTEXT_INVALID'; end if;
 if p_scores is null or jsonb_typeof(p_scores)<>'array' or jsonb_array_length(p_scores)=0
 then raise exception 'PASSPORT_SCORES_REQUIRED'; end if;
 if p_assessment_duration_minutes is not null and
   (p_assessment_duration_minutes<1 or p_assessment_duration_minutes>600)
 then raise exception 'ASSESSMENT_DURATION_INVALID'; end if;
 if length(coalesce(p_protocol_version,''))<3 or length(p_protocol_version)>80
 then raise exception 'PASSPORT_PROTOCOL_REQUIRED'; end if;
 for v_item in select value from jsonb_array_elements(p_scores) loop
    v_code:=upper(trim(coalesce(v_item->>'metric_code','')));
    if v_code=any(v_seen) then raise exception 'PASSPORT_DUPLICATE_ATTRIBUTE:%',v_code;end if;
    v_seen:=array_append(v_seen,v_code);
    select * into v_rule from iq_private.iq_passport_attribute_rules_v68 where metric_code=v_code;
    if not found then raise exception 'PASSPORT_ATTRIBUTE_UNKNOWN:%',v_code;end if;
    if nullif(v_item->>'score','') is null or
      (v_item->>'score')::numeric<>trunc((v_item->>'score')::numeric) or
      (v_item->>'score')::numeric not between 1 and 5
    then raise exception 'PASSPORT_SCORE_INVALID:%',v_code;end if;
    v_count:=coalesce(nullif(v_item->>'evidence_count','')::integer,0);
    if v_count<v_rule.minimum_observations
    then raise exception 'PASSPORT_EVIDENCE_INSUFFICIENT:%:REQUIRED_%',v_code,v_rule.minimum_observations;end if;
    v_difficulty:=upper(coalesce(v_item->>'difficulty_tier',''));
    if v_difficulty not in ('D1','D2','D3','D4','D5')
    then raise exception 'PASSPORT_DIFFICULTY_REQUIRED:%',v_code;end if;
    if p_context<>'VIDEO' and not (p_context=any(v_rule.valid_contexts))
    then raise exception 'PASSPORT_CONTEXT_UNSUPPORTED:%',v_code;end if;
    if upper(coalesce(v_item->>'rubric_version',''))<>upper(v_rule.rubric_version)
    then raise exception 'PASSPORT_RUBRIC_VERSION_UNSUPPORTED:%',v_code;end if;
 end loop;
 select t.category,t.competition into v_category,v_competition
 from public.team_seasons ts join public.teams t on t.id=ts.team_id
 where ts.id=p_team_season_id;
 v_id:=public.iq_v4_save_player_passport_evaluation_v2(
   p_team_season_id,p_player_id,p_evaluation_date,p_title,upper(p_context),
   p_scores,p_summary,null,null,null,p_training_session_id);
 update public.player_evaluations e
 set assessment_duration_minutes=p_assessment_duration_minutes,
     metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object(
      'rubric_protocol',p_protocol_version,'assessment_category',v_category,
      'assessment_competition',v_competition,'assessed_at',p_evaluation_date,
      'assessment_quality','OBSERVATIONS_RECORDED','scientific_validation','PENDING_CALIBRATION'),
     updated_at=now(),updated_by=auth.uid()
 where e.id=v_id;
 update public.player_evaluation_scores s
 set metadata=coalesce(s.metadata,'{}'::jsonb)
    ||jsonb_build_object(
      'difficulty_tier',upper(j.item->>'difficulty_tier'),
      'protocol_version',p_protocol_version,
      'minimum_evidence_met',true,
      'assessment_category',v_category,
      'scientific_validation','PENDING_CALIBRATION')
 from (select value as item from jsonb_array_elements(p_scores)) j
 where s.evaluation_id=v_id and upper(s.metric_code)=upper(j.item->>'metric_code');
 return v_id;
end $$;
revoke all on function public.iq_v68_save_guided_passport_evaluation(uuid,uuid,date,text,text,jsonb,text,uuid,integer,text) from public,anon;
grant execute on function public.iq_v68_save_guided_passport_evaluation(uuid,uuid,date,text,text,jsonb,text,uuid,integer,text) to authenticated;
commit;