-- Player 360 Phase 4E.2 installed functional smoke.
-- Assumes 4E.2 schema is installed. Synthetic rows always ROLLBACK.

begin;

do $iq4e2installed$
declare
  v_superadmin uuid;
  v_target_user uuid;
  v_team_season uuid;
  v_player uuid;
  v_entry_date date;
  v_before_stint date;
  v_relationship uuid;
  v_authorization uuid;
  v_entry uuid;
  v_entries integer;
  v_error text;
  v_caps jsonb;
begin
  select up.id into v_superadmin
  from public.user_profiles up
  where upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
  order by up.created_at nulls last
  limit 1;

  select up.id into v_target_user
  from public.user_profiles up
  where up.id is distinct from v_superadmin
  order by up.created_at nulls last
  limit 1;

  select
    rm.team_season_id,
    rm.player_id,
    greatest(rms.valid_from,least(current_date,coalesce(rms.valid_until,current_date))),
    rms.valid_from-1
  into v_team_season,v_player,v_entry_date,v_before_stint
  from public.roster_memberships rm
  join public.roster_membership_stints rms on rms.roster_membership_id=rm.id
  where rms.valid_from<=current_date
  order by rms.valid_from desc
  limit 1;

  if v_superadmin is null or v_target_user is null
     or v_team_season is null or v_player is null or v_entry_date is null then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_FIXTURE_MISSING';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_superadmin::text,'role','authenticated')::text,
    true
  );

  v_relationship:=public.iq_v4e_record_subject_relationship(
    v_team_season,v_target_user,v_player,'SELF',
    now()+interval '30 days','PHASE4E2_INSTALLED'
  );

  v_authorization:=public.iq_v4e_record_processing_authorization(
    v_team_season,v_player,
    array['nutrition','recovery'],
    array['PLAYER_SELF_SERVICE'],
    'CONSENT',
    'SMOKE_LEGAL_BASIS',
    'SMOKE_SPECIAL_CATEGORY_CONDITION',
    false,null,now()+interval '30 days','PHASE4E2_INSTALLED'
  );

  v_caps:=public.iq_v4e2_wellness_capabilities(
    v_team_season,v_player,'nutrition','SPORT_PERFORMANCE'
  );
  if coalesce((v_caps->>'can_read')::boolean,false) then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_SUPERADMIN_BYPASS';
  end if;
  if coalesce((v_caps->>'external_import_enabled')::boolean,true) then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_EXTERNAL_IMPORT_ENABLED';
  end if;
  if coalesce((v_caps->>'ai_processing_enabled')::boolean,true) then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_AI_ENABLED';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_target_user::text,'role','authenticated')::text,
    true
  );

  begin
    perform public.iq_v4e2_save_manual_wellness_entry(
      null,v_team_season,v_player,'recovery',v_before_stint,'PLAYER_SELF_SERVICE',
      jsonb_build_array(
        jsonb_build_object('metric_code','READINESS','value',3)
      )
    );
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_OUTSIDE_STINT_NOT_BLOCKED';
  exception
    when others then
      get stacked diagnostics v_error=message_text;
      if position('PLAYER360_WELLNESS_PLAYER_NOT_ELIGIBLE' in v_error)=0 then
        raise;
      end if;
  end;

  v_entry:=public.iq_v4e2_save_manual_wellness_entry(
    null,v_team_season,v_player,'recovery',v_entry_date,'PLAYER_SELF_SERVICE',
    jsonb_build_array(
      jsonb_build_object('metric_code','SLEEP_QUALITY','value',2),
      jsonb_build_object('metric_code','FATIGUE','value',4),
      jsonb_build_object('metric_code','READINESS','value',2)
    )
  );

  if (
    select count(*)
    from public.player360_wellness_observations
    where entry_id=v_entry
  )<>3 then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_OBSERVATIONS_FAILED';
  end if;

  select count(*) into v_entries
  from public.iq_v4e2_list_wellness_entries(
    v_team_season,v_player,'recovery','PLAYER_SELF_SERVICE',
    v_entry_date,v_entry_date,100
  );
  if v_entries<>1 then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_LIST_FAILED';
  end if;

  perform public.iq_v4e2_save_manual_wellness_entry(
    v_entry,v_team_season,v_player,'recovery',v_entry_date,'PLAYER_SELF_SERVICE',
    jsonb_build_array(
      jsonb_build_object('metric_code','SLEEP_QUALITY','value',4),
      jsonb_build_object('metric_code','FATIGUE','value',2),
      jsonb_build_object('metric_code','READINESS','value',4)
    )
  );

  if not public.iq_v4e2_archive_wellness_entry(
    v_entry,'PLAYER_SELF_SERVICE'
  ) then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_ARCHIVE_FAILED';
  end if;

  select count(*) into v_entries
  from public.iq_v4e2_list_wellness_entries(
    v_team_season,v_player,'recovery','PLAYER_SELF_SERVICE',
    null,null,100
  );
  if v_entries<>0 then
    raise exception 'PLAYER360_PHASE4E2_INSTALLED_ARCHIVED_VISIBLE';
  end if;

  raise notice
    'PLAYER360_PHASE4E2_INSTALLED_SMOKE_OK relationship=% authorization=% entry=%',
    v_relationship,v_authorization,v_entry;
end
$iq4e2installed$;

rollback;

select
  'PLAYER360_PHASE4E2_INSTALLED_SMOKE_ROLLBACK' as section,
  to_regclass('public.player360_wellness_metric_catalog') is not null as metric_catalog_installed,
  to_regclass('public.player360_wellness_entries') is not null as entries_installed,
  to_regclass('public.player360_wellness_observations') is not null as observations_installed,
  (select count(*) from public.player360_wellness_entries)=0 as entries_clean,
  (select count(*) from public.player360_wellness_observations)=0 as observations_clean,
  (select count(*) from public.player360_wellness_metric_catalog where is_system)=9 as catalog_preserved,
  (
    to_regclass('public.player360_wellness_metric_catalog') is not null
    and to_regclass('public.player360_wellness_entries') is not null
    and to_regclass('public.player360_wellness_observations') is not null
    and (select count(*) from public.player360_wellness_entries)=0
    and (select count(*) from public.player360_wellness_observations)=0
    and (select count(*) from public.player360_wellness_metric_catalog where is_system)=9
  ) as phase4e2_installed_smoke_clean;
