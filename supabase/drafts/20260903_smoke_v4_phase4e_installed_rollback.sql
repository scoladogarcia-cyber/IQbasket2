-- Player 360 Phase 4E installed functional smoke.
-- Assumes 4E schema is installed. Creates synthetic rows and always ROLLBACKs.

begin;

do $iq4einstalled$
declare
  v_superadmin uuid;
  v_target_user uuid;
  v_team_season uuid;
  v_player uuid;
  v_relationship uuid;
  v_authorization uuid;
  v_request uuid;
  v_grant uuid;
  v_error text;
begin
  select up.id into v_superadmin
  from public.user_profiles up
  where upper(coalesce(up.global_role, up.role, ''))='SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  select up.id into v_target_user
  from public.user_profiles up
  where up.id is distinct from v_superadmin
  order by up.created_at nulls last
  limit 1;

  select rm.team_season_id, rm.player_id
    into v_team_season, v_player
  from public.roster_memberships rm
  where exists (
    select 1 from public.roster_membership_stints rms
    where rms.roster_membership_id=rm.id
  )
  order by rm.created_at nulls last
  limit 1;

  if v_superadmin is null or v_target_user is null
     or v_team_season is null or v_player is null then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_SMOKE_FIXTURE_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_superadmin::text,'role','authenticated')::text,
    true
  );

  if not public.iq_v4e_can_admin_privacy(v_team_season) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_ADMIN_CAPABILITY_FAILED';
  end if;
  if not public.iq_v4e_can_request_sensitive_access(v_team_season) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_REQUEST_CAPABILITY_FAILED';
  end if;

  v_relationship := public.iq_v4e_record_subject_relationship(
    v_team_season,
    v_target_user,
    v_player,
    'SELF',
    now()+interval '30 days',
    'PHASE4E_INSTALLED_SMOKE'
  );

  v_authorization := public.iq_v4e_record_processing_authorization(
    v_team_season,
    v_player,
    array['nutrition'],
    array['SPORT_PERFORMANCE','PLAYER_SELF_SERVICE'],
    'CONSENT',
    'SMOKE_LEGAL_BASIS',
    'SMOKE_SPECIAL_CATEGORY_CONDITION',
    false,
    null,
    now()+interval '30 days',
    'PHASE4E_INSTALLED_SMOKE'
  );

  v_request := public.iq_v4e_request_sensitive_access(
    v_team_season,
    v_player,
    array['nutrition'],
    array['READ'],
    array['SPORT_PERFORMANCE'],
    'PHASE4E installed smoke request'
  );

  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','READ','SPORT_PERFORMANCE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_SUPERADMIN_BYPASS';
  end if;

  begin
    perform public.iq_v4e_grant_sensitive_access(
      v_team_season,
      v_superadmin,
      v_player,
      array['nutrition'],
      array['READ'],
      array['SPORT_PERFORMANCE'],
      now()+interval '7 days',
      'SHOULD_FAIL_SELF_GRANT',
      null
    );
    raise exception 'PLAYER360_PHASE4E_INSTALLED_SELF_GRANT_NOT_BLOCKED';
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      if position('PLAYER360_PRIVACY_SELF_GRANT_DENIED' in v_error)=0 then
        raise;
      end if;
  end;

  begin
    perform public.iq_v4e_grant_sensitive_access(
      v_team_season,
      v_target_user,
      v_player,
      array['nutrition'],
      array['EXPORT'],
      array['PLAYER_SELF_SERVICE'],
      now()+interval '7 days',
      'SHOULD_FAIL_REQUEST_SCOPE',
      v_request
    );
    raise exception 'PLAYER360_PHASE4E_INSTALLED_REQUEST_MISMATCH_NOT_BLOCKED';
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      if position('PLAYER360_PRIVACY_REQUEST_SCOPE_MISMATCH' in v_error)=0 then
        raise;
      end if;
  end;

  v_grant := public.iq_v4e_grant_sensitive_access(
    v_team_season,
    v_target_user,
    v_player,
    array['nutrition'],
    array['EXPORT'],
    array['PLAYER_SELF_SERVICE'],
    now()+interval '7 days',
    'PHASE4E_INSTALLED_EXPORT',
    null
  );

  if (
    select count(*) < 4
    from public.player360_privacy_audit_log
    where actor_user_id=v_superadmin
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_AUDIT_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_target_user::text,'role','authenticated')::text,
    true
  );

  if public.iq_v4e_subject_relation(v_player) <> 'SELF' then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_SELF_RELATION_FAILED';
  end if;
  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','READ','PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_SELF_READ_DENIED';
  end if;
  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','EXPORT','PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_EXPORT_DENIED';
  end if;
  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','AI_PROCESS','PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_AI_WITHOUT_OPTIN_ALLOWED';
  end if;
  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','READ','SPORT_PERFORMANCE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_SELF_PURPOSE_LEAK';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_superadmin::text,'role','authenticated')::text,
    true
  );
  perform public.iq_v4e_revoke_sensitive_access_grant(
    v_grant,
    'PHASE4E_INSTALLED_REVOKE_GRANT'
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_target_user::text,'role','authenticated')::text,
    true
  );
  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','EXPORT','PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_REVOKED_GRANT_STILL_ACTIVE';
  end if;
  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','READ','PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_GRANT_REVOKE_BROKE_SELF_READ';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_superadmin::text,'role','authenticated')::text,
    true
  );
  perform public.iq_v4e_revoke_processing_authorization(
    v_authorization,
    'PHASE4E_INSTALLED_REVOKE_AUTH'
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_target_user::text,'role','authenticated')::text,
    true
  );
  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','READ','PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E_INSTALLED_REVOKED_AUTH_STILL_ACTIVE';
  end if;

  raise notice
    'PLAYER360_PHASE4E_INSTALLED_SMOKE_OK relationship=% authorization=% request=% grant=%',
    v_relationship,v_authorization,v_request,v_grant;
end
$iq4einstalled$;

rollback;

select
  'PLAYER360_PHASE4E_INSTALLED_SMOKE_ROLLBACK' as section,
  to_regclass('public.player360_subject_relationships') is not null as relationships_installed,
  to_regclass('public.player360_processing_authorizations') is not null as authorizations_installed,
  to_regclass('public.player360_sensitive_access_requests') is not null as requests_installed,
  to_regclass('public.player360_sensitive_access_grants') is not null as grants_installed,
  to_regclass('public.player360_privacy_audit_log') is not null as audit_installed,
  (select count(*) from public.player360_subject_relationships)=0 as relationships_clean,
  (select count(*) from public.player360_processing_authorizations)=0 as authorizations_clean,
  (select count(*) from public.player360_sensitive_access_requests)=0 as requests_clean,
  (select count(*) from public.player360_sensitive_access_grants)=0 as grants_clean,
  (select count(*) from public.player360_privacy_audit_log)=0 as audit_clean,
  (
    to_regclass('public.player360_subject_relationships') is not null
    and to_regclass('public.player360_processing_authorizations') is not null
    and to_regclass('public.player360_sensitive_access_requests') is not null
    and to_regclass('public.player360_sensitive_access_grants') is not null
    and to_regclass('public.player360_privacy_audit_log') is not null
    and (select count(*) from public.player360_subject_relationships)=0
    and (select count(*) from public.player360_processing_authorizations)=0
    and (select count(*) from public.player360_sensitive_access_requests)=0
    and (select count(*) from public.player360_sensitive_access_grants)=0
    and (select count(*) from public.player360_privacy_audit_log)=0
  ) as phase4e_installed_smoke_clean;
