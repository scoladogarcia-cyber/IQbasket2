-- Installed V21 functional smoke. Every mutation is rolled back.
begin;
create temporary table v21_game_capture_smoke_result(
  grant_ok boolean,
  delegate_snapshot_ok boolean,
  delegated_write_ok boolean,
  lifecycle_scope_ok boolean,
  non_delegate_denied boolean,
  revoke_ok boolean,
  direct_access_blocked boolean
) on commit drop;

do $v21_smoke$
declare
  v_superadmin uuid;
  v_delegate uuid;
  v_game uuid;
  v_delegation uuid;
  v_team_score integer;
  v_opp_score integer;
  v_grant_ok boolean:=false;
  v_snapshot_ok boolean:=false;
  v_write_ok boolean:=false;
  v_lifecycle_ok boolean:=false;
  v_non_delegate_denied boolean:=false;
  v_revoke_ok boolean:=false;
  v_direct boolean:=false;
  v_payload jsonb;
begin
  select up.id into v_superadmin
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
    and upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
  order by up.id limit 1;

  select up.id into v_delegate
  from public.user_profiles up
  join public.user_account_controls c on c.user_id=up.id
  where c.account_status='ACTIVE'
    and up.id<>v_superadmin
    and not exists (
      select 1 from public.team_season_memberships m
      where m.user_id=up.id
        and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
        and (m.valid_from is null or m.valid_from<=now())
        and (m.valid_until is null or m.valid_until>now())
    )
    and not exists (
      select 1 from public.club_season_memberships cm
      where cm.user_id=up.id
        and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
        and (cm.valid_from is null or cm.valid_from<=now())
        and (cm.valid_until is null or cm.valid_until>now())
    )
  order by case when upper(coalesce(up.role,'')) in ('INVITADO','VISOR','FAMILIA_TUTOR','JUGADOR') then 0 else 1 end,
           up.id
  limit 1;

  select g.id,g.team_score,g.opponent_score
  into v_game,v_team_score,v_opp_score
  from public.games g
  join public.team_seasons ts on ts.id=g.team_season_id
  where upper(coalesce(g.edit_state,'OPEN'))='OPEN'
    and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  order by g.date desc,g.id
  limit 1;

  if v_superadmin is null or v_delegate is null or v_game is null then
    raise exception 'GAME_CAPTURE_DELEGATION_V1_SMOKE_FIXTURE_MISSING';
  end if;

  perform set_config('request.jwt.claim.sub',v_superadmin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  perform public.iq_v21_grant_game_capture_delegation(
    v_game,
    (select email from public.user_profiles where id=v_delegate),
    array['RECORD_LIVE_GAME','EDIT_BOXSCORE','PREPARE_GAME','START_GAME','FINISH_GAME']::text[],
    now()+interval '2 hours',
    now()-interval '1 minute',
    'V21 transactional smoke'
  );

  select d.id into v_delegation
  from public.game_capture_delegations d
  where d.game_id=v_game
    and d.delegate_user_id=v_delegate
    and d.capability='RECORD_LIVE_GAME'
    and d.revoked_at is null
  order by d.granted_at desc
  limit 1;

  v_grant_ok:=v_delegation is not null
    and exists (
      select 1 from public.game_capture_delegation_events e
      where e.delegation_id=v_delegation and e.action='GRANTED'
    );

  perform set_config('request.jwt.claim.sub',v_delegate::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  select public.iq_v21_game_capture_snapshot(v_game) into v_payload;
  v_snapshot_ok:=coalesce((v_payload->>'can_record_live')::boolean,false)
    and coalesce((v_payload->>'can_edit_boxscore')::boolean,false)
    and jsonb_array_length(coalesce(v_payload->'players','[]'::jsonb))>0
    and exists (
      select 1
      from jsonb_array_elements(public.iq_v21_my_game_capture_delegations()) d
      where d->>'game_id'=v_game::text
    );

  perform public.iq_v21_save_game_capture(
    v_game,v_team_score,v_opp_score,null,null,null,null
  );
  v_write_ok:=exists (
    select 1 from public.game_capture_write_audit a
    where a.game_id=v_game and a.actor_user_id=v_delegate
  );

  v_lifecycle_ok:=iq_private.game_play_state_actor_allowed(v_game,'READY')
    and iq_private.game_play_state_actor_allowed(v_game,'LIVE')
    and iq_private.game_play_state_actor_allowed(v_game,'FINISHED')
    and not iq_private.game_play_state_actor_allowed(v_game,'CANCELLED');

  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.iq_v21_game_capture_snapshot(v_game);
  exception when others then
    v_non_delegate_denied:=sqlerrm like '%GAME_CAPTURE_SNAPSHOT_DENIED%'
      or sqlerrm like '%ACCOUNT_NOT_ACTIVE%';
  end;

  perform set_config('request.jwt.claim.sub',v_superadmin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform public.iq_v21_revoke_game_capture_delegation(v_delegation,'V21 smoke revoke');
  v_revoke_ok:=exists (
    select 1 from public.game_capture_delegations d
    where d.id=v_delegation and d.revoked_at is not null
  ) and exists (
    select 1 from public.game_capture_delegation_events e
    where e.delegation_id=v_delegation and e.action='REVOKED'
  );

  v_direct:=not has_table_privilege('authenticated','public.game_capture_delegations','SELECT')
    and not has_table_privilege('authenticated','public.game_capture_delegations','INSERT')
    and not has_table_privilege('authenticated','public.game_capture_delegations','UPDATE')
    and not has_table_privilege('authenticated','public.game_capture_write_audit','SELECT');

  if not v_grant_ok or not v_snapshot_ok or not v_write_ok or not v_lifecycle_ok
     or not v_non_delegate_denied or not v_revoke_ok or not v_direct then
    raise exception 'GAME_CAPTURE_DELEGATION_V1_SMOKE_FAILED';
  end if;

  insert into v21_game_capture_smoke_result values(
    v_grant_ok,v_snapshot_ok,v_write_ok,v_lifecycle_ok,
    v_non_delegate_denied,v_revoke_ok,v_direct
  );
end
$v21_smoke$;

select 'GAME_CAPTURE_DELEGATION_V1_INSTALLED_SMOKE_ROLLBACK' as section,
  grant_ok,delegate_snapshot_ok,delegated_write_ok,lifecycle_scope_ok,
  non_delegate_denied,revoke_ok,direct_access_blocked
from v21_game_capture_smoke_result;
rollback;
