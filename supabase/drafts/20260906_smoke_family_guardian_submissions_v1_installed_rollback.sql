-- Installed V18 functional smoke. All fixture/data mutations are rolled back.
begin;
create temporary table v18_guardian_smoke_result(
  guardian_submit_ok boolean,
  unlinked_denied boolean,
  self_review_denied boolean,
  reviewer_provenance_ok boolean,
  materialization_ok boolean
) on commit drop;

do $v18_smoke$
declare
  v_guardian uuid;
  v_reviewer uuid;
  v_player_1 uuid;
  v_player_2 uuid;
  v_team_season_1 uuid;
  v_team_season_2 uuid;
  v_submission uuid;
  v_resource uuid;
  v_guardian_submit_ok boolean:=false;
  v_unlinked_denied boolean:=false;
  v_self_review_denied boolean:=false;
  v_reviewer_provenance_ok boolean:=false;
  v_materialization_ok boolean:=false;
begin
  select up.id into v_guardian
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
    and upper(coalesce(up.global_role,up.role,''))='INVITADO'
  order by up.id
  limit 1;

  select up.id into v_reviewer
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
    and upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
  order by up.id
  limit 1;

  select player_id,team_season_id into v_player_1,v_team_season_1
  from (
    select distinct on (rm.player_id)
      rm.player_id,rm.team_season_id
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and public.iq_v3_player_eligible_on_date(rm.player_id,rm.team_season_id,current_date)
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
      and not exists (
        select 1 from public.player360_subject_relationships r
        where r.user_id=v_guardian
          and r.player_id=rm.player_id
          and r.status='ACTIVE'
      )
    order by rm.player_id,rm.updated_at desc nulls last,rm.id
  ) candidate
  order by player_id
  limit 1;

  select player_id,team_season_id into v_player_2,v_team_season_2
  from (
    select distinct on (rm.player_id)
      rm.player_id,rm.team_season_id
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where rm.player_id<>v_player_1
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and public.iq_v3_player_eligible_on_date(rm.player_id,rm.team_season_id,current_date)
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    order by rm.player_id,rm.updated_at desc nulls last,rm.id
  ) candidate
  order by player_id
  limit 1;

  if v_guardian is null or v_reviewer is null
     or v_player_1 is null or v_player_2 is null then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_SMOKE_FIXTURE_MISSING';
  end if;

  perform set_config('request.jwt.claim.sub',v_guardian::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  insert into public.player360_subject_relationships(
    user_id,player_id,relationship_type,status,verification_source,verified_by
  ) values (
    v_guardian,v_player_1,'GUARDIAN','ACTIVE','V18_TRANSACTIONAL_SMOKE',v_reviewer
  );

  v_submission:=public.iq_v18_save_player_submission_draft(
    null,
    v_team_season_1,
    v_player_1,
    'EXTERNAL_TRAINING',
    jsonb_build_object(
      'activity_date',current_date::text,
      'title','V18 guardian transactional smoke',
      'duration_minutes',45,
      'intensity',5,
      'rpe',5,
      'objective','Validation boundary smoke',
      'provider_type','GUARDIAN_REPORTED',
      'notes','Rolled back automatically'
    )
  );

  v_guardian_submit_ok:=exists (
    select 1 from public.player_data_submissions s
    where s.id=v_submission
      and s.submitted_by=v_guardian
      and s.player_id=v_player_1
      and s.actor_relation='GUARDIAN'
      and s.status='DRAFT'
  );

  perform public.iq_v18_submit_player_submission(v_submission);
  v_guardian_submit_ok:=v_guardian_submit_ok and exists (
    select 1 from public.player_data_submissions s
    where s.id=v_submission and s.status='SUBMITTED'
  );

  begin
    perform public.iq_v18_save_player_submission_draft(
      null,v_team_season_2,v_player_2,'EXTERNAL_TRAINING',
      jsonb_build_object(
        'activity_date',current_date::text,
        'title','Must be denied'
      )
    );
  exception when others then
    v_unlinked_denied:=sqlerrm like '%PLAYER_SUBMISSION_RELATION_DENIED%';
  end;

  begin
    perform public.iq_v18_review_player_submission(
      v_submission,'APPROVED',null
    );
  exception when others then
    v_self_review_denied:=sqlerrm like '%PLAYER_SUBMISSION_SELF_REVIEW_DENIED%';
  end;

  perform set_config('request.jwt.claim.sub',v_reviewer::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select exists (
    select 1
    from public.iq_v18_list_player_submission_reviews(
      v_team_season_1,false,100
    ) r
    where r.id=v_submission
      and r.actor_relation='GUARDIAN'
      and r.submitted_by=v_guardian
      and coalesce(r.submitter_name,'')<>''
  ) into v_reviewer_provenance_ok;

  v_resource:=public.iq_v18_review_player_submission(
    v_submission,'APPROVED','V18 transactional smoke approval'
  );

  v_materialization_ok:=v_resource is not null and exists (
    select 1
    from public.external_development_sessions ed
    where ed.id=v_resource
      and ed.player_id=v_player_1
      and ed.team_season_id=v_team_season_1
      and ed.source_type='GUARDIAN_REPORT'
      and ed.provenance->>'actor_relation'='GUARDIAN'
      and ed.provenance->>'submission_id'=v_submission::text
      and ed.metadata->>'validation_status'='APPROVED'
  ) and exists (
    select 1 from public.player_data_submissions s
    where s.id=v_submission
      and s.status='APPROVED'
      and s.materialized_resource_id=v_resource
  );

  if not v_guardian_submit_ok
     or not v_unlinked_denied
     or not v_self_review_denied
     or not v_reviewer_provenance_ok
     or not v_materialization_ok then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_SMOKE_FAILED';
  end if;

  insert into v18_guardian_smoke_result values(
    v_guardian_submit_ok,
    v_unlinked_denied,
    v_self_review_denied,
    v_reviewer_provenance_ok,
    v_materialization_ok
  );
end
$v18_smoke$;

select
  'FAMILY_GUARDIAN_SUBMISSIONS_V1_INSTALLED_SMOKE_ROLLBACK' as section,
  guardian_submit_ok,
  unlinked_denied,
  self_review_denied,
  reviewer_provenance_ok,
  materialization_ok
from v18_guardian_smoke_result;

rollback;
