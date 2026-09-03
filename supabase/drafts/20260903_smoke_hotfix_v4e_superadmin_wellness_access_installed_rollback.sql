-- SUPERADMIN Nutrition/Recovery hotfix installed smoke.
-- Read-only against product rows and always ends with ROLLBACK.

begin;

do $superadmin_wellness_hotfix_smoke$
declare
  v_superadmin uuid;
  v_team_season uuid;
  v_player uuid;
  v_caps jsonb;
begin
  select up.id into v_superadmin
  from public.user_profiles up
  where upper(coalesce(up.global_role, up.role, ''))='SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  select rm.team_season_id, rm.player_id
    into v_team_season, v_player
  from public.roster_memberships rm
  order by rm.created_at nulls last
  limit 1;

  if v_superadmin is null or v_team_season is null or v_player is null then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_SMOKE_FIXTURE_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_superadmin::text,'role','authenticated')::text,
    true
  );

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_AUTH_CONTEXT_FAILED';
  end if;

  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','READ','SPORT_PERFORMANCE'
  ) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_NUTRITION_READ_DENIED';
  end if;

  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','CREATE','SPORT_PERFORMANCE'
  ) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_NUTRITION_CREATE_DENIED';
  end if;

  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'nutrition','UPDATE','SPORT_PERFORMANCE'
  ) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_NUTRITION_UPDATE_DENIED';
  end if;

  if not public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,'recovery','READ','OPERATIONS'
  ) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_RECOVERY_READ_DENIED';
  end if;

  -- The override must not create an EXPORT path when the normal processing
  -- authorization itself is absent.
  if not public.iq_v4e_has_processing_authorization(
       v_player,v_team_season,'nutrition','EXPORT','SPORT_PERFORMANCE'
     )
     and public.iq_v4e_can_access_sensitive_resource(
       v_player,v_team_season,'nutrition','EXPORT','SPORT_PERFORMANCE'
     ) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_EXPORT_BYPASS_DETECTED';
  end if;

  -- Neuro-Cognitive remains strict when no processing authorization exists.
  if not public.iq_v4e_has_processing_authorization(
       v_player,v_team_season,'neuro_cognitive','READ','SPORT_PERFORMANCE'
     )
     and public.iq_v4e_can_access_sensitive_resource(
       v_player,v_team_season,'neuro_cognitive','READ','SPORT_PERFORMANCE'
     ) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_NEURO_BYPASS_DETECTED';
  end if;

  v_caps := public.iq_v4e2_wellness_capabilities(
    v_team_season,v_player,'nutrition','SPORT_PERFORMANCE'
  );

  if not coalesce((v_caps->>'can_read')::boolean,false)
     or not coalesce((v_caps->>'can_create')::boolean,false)
     or not coalesce((v_caps->>'can_update')::boolean,false)
     or not coalesce((v_caps->>'can_archive')::boolean,false) then
    raise exception 'SUPERADMIN_WELLNESS_HOTFIX_CAPABILITIES_FAILED:%',v_caps;
  end if;
end;
$superadmin_wellness_hotfix_smoke$;

select 'SUPERADMIN_WELLNESS_HOTFIX_INSTALLED_SMOKE_ROLLBACK' as section, true as smoke_ok;

rollback;
