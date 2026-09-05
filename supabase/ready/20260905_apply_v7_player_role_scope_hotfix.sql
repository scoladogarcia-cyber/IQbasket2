-- V7 player-role scope hotfix.
-- Player identity is validated against the explicit active team-season roster,
-- not the legacy players.team_id field. Converting to JUGADOR also drops old
-- team scopes and contextual memberships to preserve least privilege.

create or replace function public.iq_v7_assign_user_role_context(
  p_user_id uuid,
  p_role text,
  p_linked_player_id uuid default null,
  p_team_season_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := upper(trim(coalesce(p_role,'')));
  v_actor_role text;
  v_actor_teams uuid[];
  v_target_email text;
  v_target_teams uuid[];
  v_player_team uuid;
  v_is_super boolean := false;
  v_now timestamptz := now();
  v_standard text[] := array['ENTRENADOR','ANALISTA','PREPARADOR_FISICO','JUGADOR','FAMILIA_TUTOR','VISOR','INVITADO'];
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'ROLE_ASSIGNMENT_TARGET_INVALID';
  end if;

  select upper(coalesce(up.global_role,up.role,'USER')), coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_actor_role, v_actor_teams
  from public.user_profiles up where up.id=auth.uid();

  select lower(up.email), coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_target_email, v_target_teams
  from public.user_profiles up where up.id=p_user_id;

  if v_target_email is null then raise exception 'ROLE_ASSIGNMENT_USER_NOT_FOUND'; end if;
  if v_target_email='scolado@nechigroup.com' then raise exception 'MASTER_IDENTITY_PROTECTED'; end if;
  if v_role='SUPERADMIN' then raise exception 'ROLE_ASSIGNMENT_SUPERADMIN_DENIED'; end if;

  v_is_super := public.iq_v3_is_global_superadmin();
  if v_is_super then
    if not (v_role='ADMIN' or v_role=any(v_standard)) then raise exception 'ROLE_ASSIGNMENT_INVALID'; end if;
  elsif v_actor_role='ADMIN' then
    if not (v_role=any(v_standard)) then raise exception 'ROLE_ASSIGNMENT_PRIVILEGED_DENIED'; end if;
    if cardinality(v_actor_teams)=0 or not (v_target_teams && v_actor_teams) then
      raise exception 'ROLE_ASSIGNMENT_SCOPE_DENIED';
    end if;
  else
    raise exception 'ROLE_ASSIGNMENT_ADMIN_REQUIRED';
  end if;

  if v_role='JUGADOR' then
    if p_linked_player_id is null then raise exception 'PLAYER_LINK_REQUIRED'; end if;
    if p_team_season_id is null then raise exception 'PLAYER_LINK_TEAM_SEASON_REQUIRED'; end if;

    select ts.team_id
      into v_player_team
    from public.roster_memberships rm
    join public.team_seasons ts on ts.id=rm.team_season_id
    where rm.player_id=p_linked_player_id
      and rm.team_season_id=p_team_season_id
      and upper(coalesce(rm.status,'ACTIVE'))='ACTIVE'
      and rm.left_at is null
      and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
      and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    limit 1;

    if v_player_team is null then raise exception 'PLAYER_LINK_ROSTER_MEMBERSHIP_REQUIRED'; end if;
    if not v_is_super and not (v_player_team=any(v_actor_teams)) then
      raise exception 'PLAYER_LINK_SCOPE_DENIED';
    end if;
  elsif p_linked_player_id is not null or p_team_season_id is not null then
    raise exception 'PLAYER_LINK_ONLY_FOR_PLAYER_ROLE';
  end if;

  perform set_config('iqbasket.profile_admin_rpc','1',true);
  update public.user_profiles
  set role=v_role,
      global_role=case when v_role='ADMIN' then 'ADMIN' else null end,
      linked_player_id=case when v_role='JUGADOR' then p_linked_player_id else null end,
      assigned_team_ids=case when v_role='JUGADOR' then array[v_player_team] else v_target_teams end
  where id=p_user_id;
  perform set_config('iqbasket.profile_admin_rpc','0',true);

  update public.user_player_links
  set status='INACTIVE', valid_until=v_now, updated_at=v_now
  where user_id=p_user_id
    and relation_type='SELF'
    and status='ACTIVE'
    and (v_role<>'JUGADOR' or player_id<>p_linked_player_id);

  if v_role='JUGADOR' then
    insert into public.user_player_links(
      user_id,player_id,relation_type,status,valid_from,valid_until,created_at,updated_at
    ) values (
      p_user_id,p_linked_player_id,'SELF','ACTIVE',v_now,null,v_now,v_now
    )
    on conflict (user_id,player_id,relation_type) do update
      set status='ACTIVE', valid_from=v_now, valid_until=null, updated_at=v_now;

    update public.team_season_memberships
    set status='INACTIVE', valid_until=v_now, updated_at=v_now
    where user_id=p_user_id and status='ACTIVE';

    insert into public.team_season_memberships(
      user_id,team_season_id,function_role,status,valid_from,valid_until,created_at,updated_at
    ) values (
      p_user_id,p_team_season_id,'JUGADOR','ACTIVE',v_now,null,v_now,v_now
    )
    on conflict (user_id,team_season_id,function_role) do update
      set status='ACTIVE', valid_from=v_now, valid_until=null, updated_at=v_now;
  else
    update public.team_season_memberships
    set status='INACTIVE', valid_until=v_now, updated_at=v_now
    where user_id=p_user_id and function_role='JUGADOR' and status='ACTIVE';
  end if;

  return jsonb_build_object(
    'user_id',p_user_id,
    'role',v_role,
    'linked_player_id',case when v_role='JUGADOR' then p_linked_player_id else null end,
    'team_season_id',case when v_role='JUGADOR' then p_team_season_id else null end,
    'team_id',case when v_role='JUGADOR' then v_player_team else null end
  );
end;
$function$;

revoke all on function public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid) from public, anon;
grant execute on function public.iq_v7_assign_user_role_context(uuid,text,uuid,uuid) to authenticated;

create or replace function public.iq_v7_assign_user_role_context(
  p_user_id uuid,
  p_role text,
  p_linked_player_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if upper(trim(coalesce(p_role,'')))='JUGADOR' then
    raise exception 'PLAYER_LINK_TEAM_SEASON_REQUIRED';
  end if;
  return public.iq_v7_assign_user_role_context(p_user_id,p_role,p_linked_player_id,null);
end;
$function$;

revoke all on function public.iq_v7_assign_user_role_context(uuid,text,uuid) from public, anon;
grant execute on function public.iq_v7_assign_user_role_context(uuid,text,uuid) to authenticated;

create or replace function public.iq_v7_assign_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.iq_v7_assign_user_role_context(p_user_id,p_role,null,null);
end;
$function$;

revoke all on function public.iq_v7_assign_user_role(uuid,text) from public, anon;
grant execute on function public.iq_v7_assign_user_role(uuid,text) to authenticated;
