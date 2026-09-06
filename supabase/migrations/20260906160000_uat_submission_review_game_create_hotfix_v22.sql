-- IQBasket V22 · UAT submission review + game creation hotfix
-- Fixes three UAT regressions without broadening canonical wellness access:
-- 1) scoped staff can review explicit SELF/GUARDIAN wellness submissions;
-- 2) approved wellness submissions can be materialized through a one-transaction marker;
-- 3) game lifecycle compatibility trigger can call its private helper safely.

begin;

do $v22_prereq$
begin
  if to_regclass('public.player_data_submissions') is null
     or to_regclass('public.player360_wellness_entries') is null
     or to_regprocedure('public.iq_account_is_active()') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb)') is null
     or to_regprocedure('public.iq_v18_review_player_submission(uuid,text,text)') is null
     or to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.iq_v7_unchecked_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is null
     or to_regprocedure('iq_private.sync_game_play_state_legacy_status_v2()') is null
     or to_regprocedure('iq_private.game_legacy_status_for_play_state(text)') is null then
    raise exception 'UAT_HOTFIX_V22_PREREQUISITES_MISSING';
  end if;
end
$v22_prereq$;

-- Explicit player/family submissions are a purpose-bound disclosure to the
-- authorised reviewer. Reading the submitted row must not require a separate
-- grant to the canonical Nutrition/Recovery history.
create or replace function iq_private.iq_v14_can_review_player_submission(
  p_team_season_id uuid,
  p_player_id uuid,
  p_submission_type text,
  p_payload jsonb default '{}'::jsonb
) returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_team_id uuid;
  v_module text;
  v_role_ok boolean:=false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then return false; end if;

  select ts.team_id into v_team_id
  from public.team_seasons ts
  where ts.id=p_team_season_id;
  if v_team_id is null then return false; end if;

  v_role_ok:=public.iq_v3_is_global_superadmin()
    or exists (
      select 1 from public.team_season_memberships m
      where m.user_id=auth.uid()
        and m.team_season_id=p_team_season_id
        and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
        and upper(m.function_role) in ('ADMIN','ENTRENADOR')
        and (m.valid_from is null or m.valid_from<=now())
        and (m.valid_until is null or m.valid_until>now())
    )
    or exists (
      select 1
      from public.club_season_memberships cm
      join public.team_seasons ts on ts.id=p_team_season_id
      join public.teams t on t.id=ts.team_id
      where cm.user_id=auth.uid()
        and cm.club_id=t.club_id
        and cm.season_id=ts.season_id
        and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
        and upper(cm.function_role)='ADMIN'
        and (cm.valid_from is null or cm.valid_from<=now())
        and (cm.valid_until is null or cm.valid_until>now())
    )
    or exists (
      select 1 from public.user_profiles up
      where up.id=auth.uid()
        and upper(coalesce(up.global_role,up.role,'USER'))='ADMIN'
        and v_team_id=any(coalesce(up.assigned_team_ids,'{}'::uuid[]))
    );

  if not v_role_ok then return false; end if;

  if upper(coalesce(p_submission_type,''))='WELLNESS_CHECKIN' then
    v_module:=lower(trim(coalesce(p_payload->>'module','')));
    return v_module in ('nutrition','recovery');
  end if;

  return upper(coalesce(p_submission_type,''))='EXTERNAL_TRAINING';
end;
$function$;
revoke all on function iq_private.iq_v14_can_review_player_submission(uuid,uuid,text,jsonb)
  from public,anon,authenticated;

-- A reviewer who can inspect a submitted wellness report may materialize only
-- that exact submitted row, only as CREATE / SPORT_PERFORMANCE, and only during
-- the transaction of iq_v18_review_player_submission.
create or replace function iq_private.iq_v22_submission_materialization_allowed(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
) returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_submission_id uuid;
  v_marker text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then return false; end if;
  if lower(trim(coalesce(p_module,''))) not in ('nutrition','recovery') then return false; end if;
  if upper(trim(coalesce(p_action,'')))<>'CREATE' then return false; end if;
  if upper(trim(coalesce(p_purpose,'')))<>'SPORT_PERFORMANCE' then return false; end if;

  v_marker:=nullif(current_setting('iqbasket.player_submission_review_id',true),'');
  if v_marker is null then return false; end if;
  begin
    v_submission_id:=v_marker::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.player_data_submissions s
    where s.id=v_submission_id
      and s.player_id=p_player_id
      and s.team_season_id=p_team_season_id
      and s.submission_type='WELLNESS_CHECKIN'
      and s.status='SUBMITTED'
      and s.actor_relation in ('SELF','GUARDIAN')
      and s.submitted_by<>auth.uid()
      and lower(coalesce(s.payload->>'module',''))=lower(trim(p_module))
      and iq_private.iq_v14_can_review_player_submission(
        s.team_season_id,s.player_id,s.submission_type,s.payload
      )
  );
end;
$function$;
revoke all on function iq_private.iq_v22_submission_materialization_allowed(uuid,uuid,text,text,text)
  from public,anon,authenticated;

-- Preserve the V7 ABAC wrapper as the canonical path and add only the narrow
-- submission-materialization exception above.
create or replace function public.iq_v4e_can_access_sensitive_resource(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select public.iq_account_is_active()
    and (
      public.iq_v7_unchecked_v4e_can_access_sensitive_resource(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
      or iq_private.iq_v22_submission_materialization_allowed(
        p_player_id,p_team_season_id,p_module,p_action,p_purpose
      )
    );
$function$;
revoke all on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)
  from public,anon;
grant execute on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)
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
  perform set_config('iqbasket.player_submission_review_id','',true);

  if v_decision not in ('APPROVED','RETURNED','REJECTED') then
    raise exception 'PLAYER_SUBMISSION_DECISION_INVALID';
  end if;

  select * into v_row
  from public.player_data_submissions s
  where s.id=p_submission_id
  for update;

  if v_row.id is null then raise exception 'PLAYER_SUBMISSION_NOT_FOUND'; end if;
  if v_row.status<>'SUBMITTED' then raise exception 'PLAYER_SUBMISSION_NOT_REVIEWABLE'; end if;
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
  if v_decision in ('RETURNED','REJECTED') and coalesce(trim(p_note),'')='' then
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

  if v_decision='APPROVED' and v_row.submission_type='WELLNESS_CHECKIN' then
    v_module:=lower(v_row.payload->>'module');
    perform set_config('iqbasket.player_submission_review_id',v_row.id::text,true);

    if not public.iq_v4e_can_access_sensitive_resource(
      v_row.player_id,v_row.team_season_id,v_module,'CREATE','SPORT_PERFORMANCE'
    ) then
      raise exception 'PLAYER_SUBMISSION_WELLNESS_APPROVE_DENIED' using errcode='42501';
    end if;

    v_resource_id:=public.iq_v4e2_save_manual_wellness_entry(
      null,v_row.team_season_id,v_row.player_id,v_module,
      (v_row.payload->>'entry_date')::date,
      'SPORT_PERFORMANCE',v_row.payload->'values'
    );

    perform set_config('iqbasket.player_submission_review_id','',true);

    update public.player360_wellness_entries
    set source_type=v_source_type,
        captured_by=v_row.submitted_by,
        purpose=v_purpose,
        updated_by=auth.uid(),
        updated_at=now()
    where id=v_resource_id;
  end if;

  if v_decision='APPROVED' and v_row.submission_type='EXTERNAL_TRAINING' then
    v_provenance:=jsonb_build_object(
      'source',v_source_type,
      'actor_relation',v_row.actor_relation,
      'submission_id',v_row.id,
      'submitted_by',v_row.submitted_by,
      'validated_by',auth.uid(),
      'validated_at',now()
    );

    v_resource_id:=public.iq_v4_create_external_development(
      v_row.team_season_id,v_row.player_id,
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
      materialized_resource_id=case when v_decision='APPROVED' then v_resource_id else null end,
      updated_at=now()
  where id=p_submission_id;

  return v_resource_id;
end;
$function$;
revoke all on function public.iq_v18_review_player_submission(uuid,text,text)
  from public,anon;
grant execute on function public.iq_v18_review_player_submission(uuid,text,text)
  to authenticated;

-- Trigger functions execute with invoker privileges unless explicitly marked
-- SECURITY DEFINER. The previous function called a private helper whose EXECUTE
-- privilege is correctly revoked from authenticated, breaking normal game INSERT.
create or replace function iq_private.sync_game_play_state_legacy_status_v2()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_legacy text:=lower(trim(coalesce(new.status,'')));
begin
  if tg_op='INSERT' then
    if new.play_state='SCHEDULED' then
      if v_legacy like '%cancel%' then new.play_state:='CANCELLED';
      elsif v_legacy like '%final%' or v_legacy like '%finish%' or v_legacy like '%complet%' then new.play_state:='FINISHED';
      elsif v_legacy like '%curso%' or v_legacy like '%live%' or v_legacy like '%progress%' then new.play_state:='LIVE';
      elsif v_legacy like '%prepar%' or v_legacy like '%ready%' then new.play_state:='READY';
      end if;
    end if;
  elsif new.play_state is not distinct from old.play_state
        and new.status is distinct from old.status then
    new.status:=iq_private.game_legacy_status_for_play_state(old.play_state);
    return new;
  end if;

  new.status:=iq_private.game_legacy_status_for_play_state(new.play_state);
  return new;
end;
$function$;
revoke all on function iq_private.sync_game_play_state_legacy_status_v2()
  from public,anon,authenticated;

comment on function iq_private.iq_v22_submission_materialization_allowed(uuid,uuid,text,text,text) is
  'V22 transaction-scoped bridge: permits canonical wellness CREATE only while approving the exact submitted SELF/GUARDIAN row.';

commit;
