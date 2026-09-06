-- Transactional installed smoke for V17. Always rolled back.
begin;
create temporary table v17_family_smoke_result(
  one_player_scope_ok boolean,
  two_player_scope_ok boolean,
  team_season_scope_ok boolean
) on commit drop;

do $v17_smoke$
declare
  v_user uuid;
  v_players uuid[];
  v_player_1 uuid;
  v_player_2 uuid;
  v_team_season_1 uuid;
  v_scope_1 jsonb;
  v_scope_2 jsonb;
  v_one_ok boolean:=false;
  v_two_ok boolean:=false;
  v_team_ok boolean:=false;
begin
  select up.id into v_user
  from public.user_profiles up
  where upper(coalesce(up.global_role,up.role,''))='SUPERADMIN'
    and not exists (
      select 1 from public.player360_subject_relationships r
      where r.user_id=up.id and r.relationship_type='GUARDIAN'
        and r.status='ACTIVE'
    )
  order by up.created_at nulls last,up.id
  limit 1;
  select array_agg(player_id order by player_id)
  into v_players
  from (
    select distinct rm.player_id
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
      and (rm.joined_at is null or rm.joined_at<=current_date)
      and (rm.left_at is null or rm.left_at>current_date)
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    order by rm.player_id
    limit 2
  ) candidates;

  if v_user is null or coalesce(cardinality(v_players),0) < 2 then
    raise exception 'FAMILY_SCOPED_PLAYER_SUPPORT_V1_SMOKE_FIXTURE_MISSING';
  end if;

  v_player_1:=v_players[1];
  v_player_2:=v_players[2];
  select rm.team_season_id into v_team_season_1
  from public.roster_memberships rm
  join public.team_seasons ts on ts.id=rm.team_season_id
  where rm.player_id=v_player_1
    and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
    and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
  order by rm.updated_at desc nulls last,rm.id
  limit 1;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  insert into public.player360_subject_relationships(
    user_id,player_id,relationship_type,status,verification_source,verified_by
  ) values (
    v_user,v_player_1,'GUARDIAN','ACTIVE','V17_TRANSACTIONAL_SMOKE',v_user
  );

  v_scope_1:=public.iq_v17_family_authorization_scope();
  v_one_ok:=jsonb_array_length(coalesce(v_scope_1->'linked_player_ids','[]'::jsonb))=1
    and (v_scope_1->'linked_player_ids') ? v_player_1::text;
  v_team_ok:=(v_scope_1->'allowed_team_season_ids') ? v_team_season_1::text;

  insert into public.player360_subject_relationships(
    user_id,player_id,relationship_type,status,verification_source,verified_by
  ) values (
    v_user,v_player_2,'GUARDIAN','ACTIVE','V17_TRANSACTIONAL_SMOKE',v_user
  );

  v_scope_2:=public.iq_v17_family_authorization_scope();
  v_two_ok:=jsonb_array_length(coalesce(v_scope_2->'linked_player_ids','[]'::jsonb))=2
    and (v_scope_2->'linked_player_ids') ? v_player_1::text
    and (v_scope_2->'linked_player_ids') ? v_player_2::text;

  if not v_one_ok or not v_two_ok or not v_team_ok then
    raise exception 'FAMILY_SCOPED_PLAYER_SUPPORT_V1_SMOKE_FAILED';
  end if;

  insert into v17_family_smoke_result values(v_one_ok,v_two_ok,v_team_ok);
end
$v17_smoke$;
select
  'FAMILY_SCOPED_PLAYER_SUPPORT_V1_INSTALLED_SMOKE_ROLLBACK' as section,
  one_player_scope_ok,
  two_player_scope_ok,
  team_season_scope_ok
from v17_family_smoke_result;

rollback;