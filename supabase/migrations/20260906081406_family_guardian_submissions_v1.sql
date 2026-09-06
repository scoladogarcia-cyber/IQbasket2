-- IQBasket V18 - Family Guardian Submissions V1
-- Extends the validated player-submission workflow to authorized GUARDIAN
-- relationships without allowing Family users to impersonate SELF.
begin;

do $v18_prereq$
begin
  if to_regclass('public.player_data_submissions') is null
     or to_regclass('public.player360_subject_relationships') is null
     or to_regclass('public.player360_wellness_entries') is null
     or to_regclass('public.external_development_sessions') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('iq_private.iq_v14_player_submission_is_self(uuid,uuid)') is null
     or to_regprocedure('iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb)') is null
     or to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null
     or to_regprocedure('public.iq_v4_create_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is null then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_PREREQUISITES_MISSING';
  end if;
end
$v18_prereq$;

alter table public.player_data_submissions
  add column if not exists actor_relation text not null default 'SELF';

do $v18_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.player_data_submissions'::regclass
      and conname='player_data_submissions_actor_relation_check'
  ) then
    alter table public.player_data_submissions
      add constraint player_data_submissions_actor_relation_check
      check (actor_relation in ('SELF','GUARDIAN'));
  end if;
end
$v18_constraint$;

comment on column public.player_data_submissions.actor_relation is
  'Authenticated author relationship to the player at submission time: SELF or GUARDIAN.';

create or replace function iq_private.iq_v18_player_submission_relation(
  p_player_id uuid,
  p_team_season_id uuid
) returns text
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    return 'NONE';
  end if;

  if iq_private.iq_v14_player_submission_is_self(
    p_player_id,p_team_season_id
  ) then
    return 'SELF';
  end if;

  if exists (
    select 1
    from public.player360_subject_relationships r
    join public.roster_memberships rm
      on rm.player_id=r.player_id
     and rm.team_season_id=p_team_season_id
    join public.team_seasons ts on ts.id=rm.team_season_id
    where r.user_id=auth.uid()
      and r.player_id=p_player_id
      and r.relationship_type='GUARDIAN'
      and r.status='ACTIVE'
      and r.valid_from<=now()
      and (r.valid_until is null or r.valid_until>now())
      and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.joined_at is null or rm.joined_at<=current_date)
      and (rm.left_at is null or rm.left_at>current_date)
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  ) then
    return 'GUARDIAN';
  end if;

  return 'NONE';
end;
$function$;
revoke all on function iq_private.iq_v18_player_submission_relation(uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.iq_v18_validate_submission_payload(
  p_submission_type text,
  p_payload jsonb
) returns void
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_type text:=upper(trim(coalesce(p_submission_type,'')));
begin
  if v_type not in ('WELLNESS_CHECKIN','EXTERNAL_TRAINING') then
    raise exception 'PLAYER_SUBMISSION_TYPE_INVALID';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'PLAYER_SUBMISSION_PAYLOAD_INVALID';
  end if;

  if v_type='WELLNESS_CHECKIN' then
    if lower(coalesce(p_payload->>'module','')) not in ('nutrition','recovery')
       or coalesce(p_payload->>'entry_date','') !~ '^\d{4}-\d{2}-\d{2}$'
       or jsonb_typeof(p_payload->'values')<>'array'
       or jsonb_array_length(p_payload->'values') not between 1 and 20 then
      raise exception 'PLAYER_SUBMISSION_WELLNESS_INVALID';
    end if;
  else
    if coalesce(trim(p_payload->>'title'),'')=''
       or coalesce(p_payload->>'activity_date','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'PLAYER_SUBMISSION_TRAINING_INVALID';
    end if;
  end if;
end;
$function$;
revoke all on function iq_private.iq_v18_validate_submission_payload(text,jsonb)
  from public,anon,authenticated;

create or replace function public.iq_v18_save_player_submission_draft(
  p_submission_id uuid,
  p_team_season_id uuid,
  p_player_id uuid,
  p_submission_type text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_relation text;
  v_type text:=upper(trim(coalesce(p_submission_type,'')));
  v_row public.player_data_submissions;
  v_id uuid;
  v_module text;
  v_purpose text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  v_relation:=iq_private.iq_v18_player_submission_relation(
    p_player_id,p_team_season_id
  );
  if v_relation not in ('SELF','GUARDIAN') then
    raise exception 'PLAYER_SUBMISSION_RELATION_DENIED' using errcode='42501';
  end if;

  perform iq_private.iq_v18_validate_submission_payload(v_type,p_payload);

  if v_type='WELLNESS_CHECKIN' then
    v_module:=lower(p_payload->>'module');
    v_purpose:=case
      when v_relation='GUARDIAN' then 'FAMILY_SUPPORT'
      else 'PLAYER_SELF_SERVICE'
    end;
    if not public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,v_module,'CREATE',v_purpose
    ) then
      raise exception 'PLAYER_SUBMISSION_WELLNESS_CREATE_DENIED'
        using errcode='42501';
    end if;
  end if;

  if p_submission_id is null then
    insert into public.player_data_submissions(
      submitted_by,player_id,team_season_id,submission_type,
      status,payload,actor_relation
    ) values (
      auth.uid(),p_player_id,p_team_season_id,v_type,
      'DRAFT',p_payload,v_relation
    ) returning id into v_id;
  else
    select * into v_row
    from public.player_data_submissions s
    where s.id=p_submission_id
      and s.submitted_by=auth.uid()
      and s.player_id=p_player_id
      and s.team_season_id=p_team_season_id
      and s.submission_type=v_type
    for update;

    if v_row.id is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
    if v_row.status not in ('DRAFT','RETURNED') then
      raise exception 'PLAYER_SUBMISSION_NOT_EDITABLE';
    end if;
    if v_row.actor_relation<>v_relation then
      raise exception 'PLAYER_SUBMISSION_RELATION_CHANGED' using errcode='42501';
    end if;

    update public.player_data_submissions
    set payload=p_payload,
        status='DRAFT',
        submitted_at=null,
        reviewed_by=null,
        reviewed_at=null,
        review_note=null,
        version=version+1,
        updated_at=now()
    where id=p_submission_id
    returning id into v_id;
  end if;

  return v_id;
end;
$function$;
revoke all on function public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)
  from public,anon;
grant execute on function public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)
  to authenticated;

create or replace function public.iq_v18_submit_player_submission(
  p_submission_id uuid
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.player_data_submissions;
  v_relation text;
  v_module text;
  v_purpose text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_row
  from public.player_data_submissions s
  where s.id=p_submission_id
    and s.submitted_by=auth.uid()
  for update;

  if v_row.id is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
  if v_row.status not in ('DRAFT','RETURNED') then
    raise exception 'PLAYER_SUBMISSION_NOT_SUBMITTABLE';
  end if;

  v_relation:=iq_private.iq_v18_player_submission_relation(
    v_row.player_id,v_row.team_season_id
  );
  if v_relation<>v_row.actor_relation then
    raise exception 'PLAYER_SUBMISSION_RELATION_DENIED' using errcode='42501';
  end if;

  if v_row.submission_type='WELLNESS_CHECKIN' then
    v_module:=lower(v_row.payload->>'module');
    v_purpose:=case
      when v_relation='GUARDIAN' then 'FAMILY_SUPPORT'
      else 'PLAYER_SELF_SERVICE'
    end;
    if not public.iq_v4e_can_access_sensitive_resource(
      v_row.player_id,v_row.team_season_id,v_module,'CREATE',v_purpose
    ) then
      raise exception 'PLAYER_SUBMISSION_WELLNESS_CREATE_DENIED'
        using errcode='42501';
    end if;
  end if;

  update public.player_data_submissions
  set status='SUBMITTED',submitted_at=now(),updated_at=now()
  where id=v_row.id;
  return true;
end;
$function$;
revoke all on function public.iq_v18_submit_player_submission(uuid)
  from public,anon;
grant execute on function public.iq_v18_submit_player_submission(uuid)
  to authenticated;

create or replace function public.iq_v18_list_my_player_submissions(
  p_team_season_id uuid default null,
  p_player_id uuid default null,
  p_limit integer default 100
) returns setof public.player_data_submissions
language sql
stable
security definer
set search_path=''
as $function$
  select s.*
  from public.player_data_submissions s
  where s.submitted_by=auth.uid()
    and (p_team_season_id is null or s.team_season_id=p_team_season_id)
    and (p_player_id is null or s.player_id=p_player_id)
    and iq_private.iq_v18_player_submission_relation(
      s.player_id,s.team_season_id
    )=s.actor_relation
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit,100),1),300);
$function$;
revoke all on function public.iq_v18_list_my_player_submissions(uuid,uuid,integer)
  from public,anon;
grant execute on function public.iq_v18_list_my_player_submissions(uuid,uuid,integer)
  to authenticated;

create or replace function public.iq_v18_list_player_submission_reviews(
  p_team_season_id uuid default null,
  p_include_resolved boolean default false,
  p_limit integer default 100
) returns table(
  id uuid, player_id uuid, player_name text, team_season_id uuid,
  submission_type text, status text, payload jsonb,
  submitted_at timestamptz, reviewed_at timestamptz, review_note text,
  materialized_resource_id uuid, submitted_by uuid,
  actor_relation text, submitter_name text
)
language sql
stable
security definer
set search_path=''
as $function$
  select s.id,s.player_id,
    trim(concat_ws(' ',p.first_name,p.last_name)) as player_name,
    s.team_season_id,s.submission_type,s.status,s.payload,
    s.submitted_at,s.reviewed_at,s.review_note,
    s.materialized_resource_id,s.submitted_by,s.actor_relation,
    coalesce(
      nullif(trim(concat_ws(' ',up.first_name,up.last_name)),''),
      up.email,
      case when s.actor_relation='GUARDIAN' then 'Familia / Tutor' else 'Jugador' end
    ) as submitter_name
  from public.player_data_submissions s
  join public.players p on p.id=s.player_id
  left join public.user_profiles up on up.id=s.submitted_by
  where (p_team_season_id is null or s.team_season_id=p_team_season_id)
    and (p_include_resolved or s.status='SUBMITTED')
    and iq_private.iq_v14_can_review_player_submission(
      s.team_season_id,s.player_id,s.submission_type,s.payload
    )
  order by coalesce(s.submitted_at,s.created_at) desc
  limit least(greatest(coalesce(p_limit,100),1),300);
$function$;
revoke all on function public.iq_v18_list_player_submission_reviews(uuid,boolean,integer)
  from public,anon;
grant execute on function public.iq_v18_list_player_submission_reviews(uuid,boolean,integer)
  to authenticated;

create or replace function public.iq_v18_review_player_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.player_data_submissions;
  v_decision text:=upper(trim(coalesce(p_decision,'')));
  v_resource_id uuid;
  v_module text;
  v_provenance jsonb;
  v_source_type text;
  v_purpose text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_decision not in ('APPROVED','RETURNED','REJECTED') then
    raise exception 'PLAYER_SUBMISSION_DECISION_INVALID';
  end if;

  select * into v_row
  from public.player_data_submissions s
  where s.id=p_submission_id
  for update;

  if v_row.id is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
  if v_row.status<>'SUBMITTED' then
    raise exception 'PLAYER_SUBMISSION_NOT_REVIEWABLE';
  end if;
  if v_row.actor_relation not in ('SELF','GUARDIAN') then
    raise exception 'PLAYER_SUBMISSION_RELATION_INVALID';
  end if;
  if v_row.submitted_by=auth.uid() then
    raise exception 'PLAYER_SUBMISSION_SELF_REVIEW_DENIED' using errcode='42501';
  end if;
  if not iq_private.iq_v14_can_review_player_submission(
    v_row.team_season_id,v_row.player_id,v_row.submission_type,v_row.payload
  ) then
    raise exception 'PLAYER_SUBMISSION_REVIEW_DENIED' using errcode='42501';
  end if;
  if v_decision in ('RETURNED','REJECTED')
     and coalesce(trim(p_note),'')='' then
    raise exception 'PLAYER_SUBMISSION_REVIEW_NOTE_REQUIRED';
  end if;

  v_source_type:=case
    when v_row.actor_relation='GUARDIAN' then 'GUARDIAN_REPORT'
    else 'PLAYER_SELF_REPORT'
  end;
  v_purpose:=case
    when v_row.actor_relation='GUARDIAN' then 'FAMILY_SUPPORT'
    else 'PLAYER_SELF_SERVICE'
  end;

  if v_decision='APPROVED'
     and v_row.submission_type='WELLNESS_CHECKIN' then
    v_module:=lower(v_row.payload->>'module');
    if not public.iq_v4e_can_access_sensitive_resource(
      v_row.player_id,v_row.team_season_id,v_module,'CREATE','SPORT_PERFORMANCE'
    ) then
      raise exception 'PLAYER_SUBMISSION_WELLNESS_APPROVE_DENIED'
        using errcode='42501';
    end if;

    v_resource_id:=public.iq_v4e2_save_manual_wellness_entry(
      null,
      v_row.team_season_id,
      v_row.player_id,
      v_module,
      (v_row.payload->>'entry_date')::date,
      'SPORT_PERFORMANCE',
      v_row.payload->'values'
    );

    update public.player360_wellness_entries
    set source_type=v_source_type,
        captured_by=v_row.submitted_by,
        purpose=v_purpose,
        updated_by=auth.uid(),
        updated_at=now()
    where id=v_resource_id;
  end if;

  if v_decision='APPROVED'
     and v_row.submission_type='EXTERNAL_TRAINING' then
    v_provenance:=jsonb_build_object(
      'source',v_source_type,
      'actor_relation',v_row.actor_relation,
      'submission_id',v_row.id,
      'submitted_by',v_row.submitted_by,
      'validated_by',auth.uid(),
      'validated_at',now()
    );

    v_resource_id:=public.iq_v4_create_external_development(
      v_row.team_season_id,
      v_row.player_id,
      (v_row.payload->>'activity_date')::date,
      v_row.payload->>'title',
      nullif(v_row.payload->>'activity_code',''),
      nullif(v_row.payload->>'activity_type_id','')::uuid,
      nullif(v_row.payload->>'provider_type',''),
      nullif(v_row.payload->>'provider_name',''),
      nullif(v_row.payload->>'objective',''),
      nullif(v_row.payload->>'duration_minutes','')::integer,
      nullif(v_row.payload->>'intensity','')::numeric,
      nullif(v_row.payload->>'rpe','')::numeric,
      v_source_type,
      nullif(v_row.payload->>'notes',''),
      v_provenance,
      jsonb_build_object(
        'validation_status','APPROVED',
        'player_submission_id',v_row.id,
        'actor_relation',v_row.actor_relation
      )
    );
  end if;

  update public.player_data_submissions
  set status=v_decision,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      review_note=nullif(trim(coalesce(p_note,'')),''),
      materialized_resource_type=case
        when v_decision<>'APPROVED' then null
        when submission_type='WELLNESS_CHECKIN' then 'WELLNESS_ENTRY'
        else 'EXTERNAL_DEVELOPMENT_SESSION'
      end,
      materialized_resource_id=case
        when v_decision='APPROVED' then v_resource_id
        else null
      end,
      updated_at=now()
  where id=p_submission_id;

  return v_resource_id;
end;
$function$;
revoke all on function public.iq_v18_review_player_submission(uuid,text,text)
  from public,anon;
grant execute on function public.iq_v18_review_player_submission(uuid,text,text)
  to authenticated;

-- Stale SELF clients are routed through V18 too, so the stronger authorization
-- boundary is effective immediately without requiring a synchronized frontend.
create or replace function public.iq_v14_save_player_submission_draft(
  p_submission_id uuid,
  p_team_season_id uuid,
  p_player_id uuid,
  p_submission_type text,
  p_payload jsonb
) returns uuid
language sql
volatile
security definer
set search_path=''
as $function$
  select public.iq_v18_save_player_submission_draft(
    p_submission_id,p_team_season_id,p_player_id,p_submission_type,p_payload
  );
$function$;
revoke all on function public.iq_v14_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)
  from public,anon;
grant execute on function public.iq_v14_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)
  to authenticated;

create or replace function public.iq_v14_submit_player_submission(
  p_submission_id uuid
) returns boolean
language sql
volatile
security definer
set search_path=''
as $function$
  select public.iq_v18_submit_player_submission(p_submission_id);
$function$;
revoke all on function public.iq_v14_submit_player_submission(uuid)
  from public,anon;
grant execute on function public.iq_v14_submit_player_submission(uuid)
  to authenticated;

create or replace function public.iq_v14_review_player_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
) returns uuid
language sql
volatile
security definer
set search_path=''
as $function$
  select public.iq_v18_review_player_submission(
    p_submission_id,p_decision,p_note
  );
$function$;
revoke all on function public.iq_v14_review_player_submission(uuid,text,text)
  from public,anon;
grant execute on function public.iq_v14_review_player_submission(uuid,text,text)
  to authenticated;

-- Direct canonical SELF/GUARDIAN writes from the original reporter are blocked.
create or replace function iq_private.iq_v14_guard_validated_wellness_history()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if auth.uid() is not null and new.captured_by=auth.uid() then
    if new.source_type='PLAYER_SELF_REPORT' then
      raise exception 'PLAYER360_WELLNESS_SELF_SUBMISSION_REQUIRED';
    end if;
    if new.source_type='GUARDIAN_REPORT' then
      raise exception 'PLAYER360_WELLNESS_GUARDIAN_SUBMISSION_REQUIRED';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function iq_private.iq_v14_guard_validated_wellness_history()
  from public,anon,authenticated;

comment on table public.player_data_submissions is
  'Temporary SELF/GUARDIAN reports. Only APPROVED rows are materialized into canonical history.';
comment on column public.player_data_submissions.payload is
  'Unvalidated player-context payload; excluded from canonical analytics until staff approval.';

do $v18_verify$
begin
  if not (select relrowsecurity
          from pg_class
          where oid='public.player_data_submissions'::regclass) then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_RLS_REQUIRED';
  end if;
  if has_table_privilege('authenticated','public.player_data_submissions','SELECT')
     or has_table_privilege('authenticated','public.player_data_submissions','INSERT')
     or has_table_privilege('authenticated','public.player_data_submissions','UPDATE') then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_DIRECT_TABLE_ACCESS_OPEN';
  end if;

  if has_function_privilege('anon','public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.iq_v18_submit_player_submission(uuid)','EXECUTE')
     or has_function_privilege('anon','public.iq_v18_list_my_player_submissions(uuid,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.iq_v18_list_player_submission_reviews(uuid,boolean,integer)','EXECUTE')
     or has_function_privilege('anon','public.iq_v18_review_player_submission(uuid,text,text)','EXECUTE') then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_ANON_RPC_OPEN';
  end if;

  if not has_function_privilege('authenticated','public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v18_submit_player_submission(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v18_list_my_player_submissions(uuid,uuid,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v18_list_player_submission_reviews(uuid,boolean,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v18_review_player_submission(uuid,text,text)','EXECUTE') then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_AUTH_RPC_CLOSED';
  end if;

  if has_function_privilege('authenticated','iq_private.iq_v18_player_submission_relation(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.iq_v18_validate_submission_payload(text,jsonb)','EXECUTE') then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_PRIVATE_HELPER_EXPOSED';
  end if;

  if exists (
    select 1 from public.player_data_submissions
    where actor_relation not in ('SELF','GUARDIAN')
  ) then
    raise exception 'FAMILY_GUARDIAN_SUBMISSIONS_V1_INVALID_RELATION_DATA';
  end if;
end
$v18_verify$;

commit;

select
  'FAMILY_GUARDIAN_SUBMISSIONS_V1' as section,
  to_regprocedure('public.iq_v18_save_player_submission_draft(uuid,uuid,uuid,text,jsonb)') is not null as save_ok,
  to_regprocedure('public.iq_v18_submit_player_submission(uuid)') is not null as submit_ok,
  to_regprocedure('public.iq_v18_list_my_player_submissions(uuid,uuid,integer)') is not null as list_mine_ok,
  to_regprocedure('public.iq_v18_list_player_submission_reviews(uuid,boolean,integer)') is not null as review_list_ok,
  to_regprocedure('public.iq_v18_review_player_submission(uuid,text,text)') is not null as review_ok;
