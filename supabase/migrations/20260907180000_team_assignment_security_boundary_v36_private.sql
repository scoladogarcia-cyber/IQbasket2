-- =============================================================================
-- IQBasket V36 · User team-assignment security boundary · private implementation
--
-- Reuses the non-exposed administrative schema introduced by V35. This phase
-- is behavior-neutral because it does not replace the public RPC yet.
-- =============================================================================

begin;

create or replace function iq_v35_private.set_user_team_assignments(
  p_user_id uuid,
  p_team_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_actor_teams uuid[];
  v_target_role text;
  v_target_teams uuid[];
  v_requested uuid[];
  v_final uuid[];
  v_is_super boolean := false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED';
  end if;
  if p_user_id is null then
    raise exception 'TEAM_ASSIGNMENT_TARGET_REQUIRED';
  end if;

  select coalesce(array_agg(distinct x),'{}'::uuid[])
    into v_requested
  from unnest(coalesce(p_team_ids,'{}'::uuid[])) x;

  if exists(
    select 1
    from unnest(v_requested) x
    where not exists(select 1 from public.teams t where t.id=x)
  ) then
    raise exception 'TEAM_ASSIGNMENT_UNKNOWN_TEAM';
  end if;

  select upper(coalesce(up.global_role,up.role,'USER')),
         coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_actor_role, v_actor_teams
  from public.user_profiles up
  where up.id=auth.uid();

  select upper(coalesce(up.global_role,up.role,'USER')),
         coalesce(up.assigned_team_ids,'{}'::uuid[])
    into v_target_role, v_target_teams
  from public.user_profiles up
  where up.id=p_user_id;

  if v_target_role is null then
    raise exception 'TEAM_ASSIGNMENT_USER_NOT_FOUND';
  end if;

  v_is_super := public.iq_v3_is_global_superadmin();

  if not v_is_super and v_target_role='SUPERADMIN' then
    raise exception 'MASTER_IDENTITY_PROTECTED';
  end if;
  if not v_is_super and v_target_role='ADMIN' then
    raise exception 'TEAM_ASSIGNMENT_PRIVILEGED_TARGET_DENIED';
  end if;

  if v_is_super then
    v_final := v_requested;
  elsif v_actor_role='ADMIN' then
    if cardinality(v_actor_teams)=0 then
      raise exception 'TEAM_ASSIGNMENT_SCOPE_DENIED';
    end if;
    if exists(
      select 1
      from unnest(v_requested) x
      where not (x=any(v_actor_teams))
    ) then
      raise exception 'TEAM_ASSIGNMENT_SCOPE_DENIED';
    end if;

    select coalesce(array_agg(distinct q.team_id),'{}'::uuid[])
      into v_final
    from (
      select x as team_id
      from unnest(v_target_teams) x
      where not (x=any(v_actor_teams))
      union
      select x
      from unnest(v_requested) x
    ) q;
  else
    raise exception 'TEAM_ASSIGNMENT_ADMIN_REQUIRED';
  end if;

  perform set_config('iqbasket.profile_admin_rpc','1',true);
  update public.user_profiles
  set assigned_team_ids=v_final
  where id=p_user_id;
  perform set_config('iqbasket.profile_admin_rpc','0',true);

  return jsonb_build_object(
    'user_id',p_user_id,
    'assigned_team_ids',to_jsonb(v_final)
  );
end;
$function$;

revoke all on function iq_v35_private.set_user_team_assignments(uuid,uuid[])
  from public, anon, authenticated;
grant execute on function iq_v35_private.set_user_team_assignments(uuid,uuid[])
  to authenticated;

commit;
