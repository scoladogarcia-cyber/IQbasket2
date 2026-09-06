-- IQBasket V22 · installed functional smoke · FORCED ROLLBACK
-- Uses a real eligible submission as a payload template, but all fixture rows
-- and materialized wellness/game rows are rolled back.

begin;

do $seed$
declare
  v_source public.player_data_submissions;
  v_coach uuid;
  v_team uuid;
  v_season uuid;
  v_fixture_reject uuid:=gen_random_uuid();
  v_fixture_approve uuid:=gen_random_uuid();
begin
  select s.* into v_source
  from public.player_data_submissions s
  where s.submission_type='WELLNESS_CHECKIN'
    and s.actor_relation in ('SELF','GUARDIAN')
    and lower(coalesce(s.payload->>'module','')) in ('nutrition','recovery')
  order by coalesce(s.submitted_at,s.created_at) desc
  limit 1;

  if v_source.id is null then raise exception 'V22_SMOKE_NO_WELLNESS_TEMPLATE'; end if;

  select m.user_id into v_coach
  from public.team_season_memberships m
  where m.team_season_id=v_source.team_season_id
    and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
    and upper(m.function_role)='ENTRENADOR'
    and m.user_id<>v_source.submitted_by
    and (m.valid_from is null or m.valid_from<=now())
    and (m.valid_until is null or m.valid_until>now())
    and public.iq_account_is_active_for_user(m.user_id)
  order by m.valid_from desc nulls last
  limit 1;

  if v_coach is null then raise exception 'V22_SMOKE_NO_ACTIVE_COACH'; end if;

  select ts.team_id,ts.season_id into v_team,v_season
  from public.team_seasons ts where ts.id=v_source.team_season_id;

  insert into public.player_data_submissions(
    id,submitted_by,player_id,team_season_id,submission_type,status,payload,
    submitted_at,version,actor_relation
  ) values
  (
    v_fixture_reject,v_source.submitted_by,v_source.player_id,v_source.team_season_id,
    v_source.submission_type,'SUBMITTED',v_source.payload,now(),1,v_source.actor_relation
  ),
  (
    v_fixture_approve,v_source.submitted_by,v_source.player_id,v_source.team_season_id,
    v_source.submission_type,'SUBMITTED',v_source.payload,now(),1,v_source.actor_relation
  );

  perform set_config('iq.v22.coach_id',v_coach::text,true);
  perform set_config('iq.v22.player_id',v_source.player_id::text,true);
  perform set_config('iq.v22.team_season_id',v_source.team_season_id::text,true);
  perform set_config('iq.v22.team_id',v_team::text,true);
  perform set_config('iq.v22.season_id',v_season::text,true);
  perform set_config('iq.v22.fixture_reject',v_fixture_reject::text,true);
  perform set_config('iq.v22.fixture_approve',v_fixture_approve::text,true);
end
$seed$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',current_setting('iq.v22.coach_id'),
    'role','authenticated'
  )::text,
  true
);

set local role authenticated;

do $smoke$
declare
  v_coach uuid:=current_setting('iq.v22.coach_id')::uuid;
  v_player uuid:=current_setting('iq.v22.player_id')::uuid;
  v_team_season uuid:=current_setting('iq.v22.team_season_id')::uuid;
  v_team uuid:=current_setting('iq.v22.team_id')::uuid;
  v_season uuid:=current_setting('iq.v22.season_id')::uuid;
  v_reject uuid:=current_setting('iq.v22.fixture_reject')::uuid;
  v_approve uuid:=current_setting('iq.v22.fixture_approve')::uuid;
  v_module text;
  v_resource uuid;
  v_game uuid;
  v_status text;
begin
  if auth.uid()<>v_coach then raise exception 'V22_SMOKE_AUTH_CONTEXT_FAILED'; end if;

  select lower(payload->>'module') into v_module
  from public.iq_v18_list_player_submission_reviews(v_team_season,false,100)
  where id=v_reject;
  if v_module not in ('nutrition','recovery') then
    raise exception 'V22_SMOKE_COACH_CANNOT_SEE_SUBMISSION';
  end if;

  -- The coach still has no generic wellness CREATE access just because they can
  -- review an explicitly submitted row.
  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,v_module,'CREATE','SPORT_PERFORMANCE'
  ) then
    raise exception 'V22_SMOKE_GENERIC_WELLNESS_ACCESS_WIDENED';
  end if;

  perform public.iq_v18_review_player_submission(
    v_reject,'REJECTED','V22 rollback smoke rejection'
  );
  select status into v_status from public.player_data_submissions where id=v_reject;
  if v_status<>'REJECTED' then raise exception 'V22_SMOKE_REJECT_FAILED'; end if;

  v_resource:=public.iq_v18_review_player_submission(
    v_approve,'APPROVED','V22 rollback smoke approval'
  );
  if v_resource is null then raise exception 'V22_SMOKE_APPROVE_DID_NOT_MATERIALIZE'; end if;
  if not exists (
    select 1 from public.player360_wellness_entries e
    where e.id=v_resource
      and e.player_id=v_player
      and e.team_season_id=v_team_season
      and e.source_type in ('PLAYER_SELF_REPORT','GUARDIAN_REPORT')
  ) then
    raise exception 'V22_SMOKE_MATERIALIZED_ROW_INVALID';
  end if;

  if public.iq_v4e_can_access_sensitive_resource(
    v_player,v_team_season,v_module,'CREATE','SPORT_PERFORMANCE'
  ) then
    raise exception 'V22_SMOKE_MARKER_NOT_CLEARED';
  end if;

  begin
    perform iq_private.iq_v22_submission_materialization_allowed(
      v_player,v_team_season,v_module,'CREATE','SPORT_PERFORMANCE'
    );
    raise exception 'V22_SMOKE_PRIVATE_HELPER_EXPOSED';
  exception
    when insufficient_privilege then null;
  end;

  -- This exact INSERT reproduced the UAT failure before V22 because the games
  -- trigger executed as authenticated and could not call its private helper.
  insert into public.games(
    team_id,season_id,team_season_id,date,game_date,time,opponent,
    competition,venue,status,play_state
  ) values (
    v_team,v_season,v_team_season,current_date,current_date,'18:00',
    'ZZ V22 rollback smoke','UAT_SMOKE','Local','Programado','SCHEDULED'
  ) returning id into v_game;

  if v_game is null then raise exception 'V22_SMOKE_GAME_CREATE_FAILED'; end if;
  select status into v_status from public.games where id=v_game;
  if v_status<>'Programado' then raise exception 'V22_SMOKE_GAME_STATUS_SYNC_FAILED'; end if;
end
$smoke$;

reset role;

select
  'UAT_HOTFIX_V22_INSTALLED_SMOKE_ROLLBACK' as section,
  true as coach_review_ok,
  true as reject_ok,
  true as approve_materialization_ok,
  true as generic_wellness_access_still_closed,
  true as private_helper_closed,
  true as game_create_ok;

rollback;
