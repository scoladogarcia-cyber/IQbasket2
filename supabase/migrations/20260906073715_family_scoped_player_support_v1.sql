-- IQBasket V17 - Family Scoped Player Support V1
-- Authoritative multi-player guardian scope for application authorization.
-- No data migration: active GUARDIAN relationships remain the source of truth.
begin;

do $v17_prereq$
begin
  if to_regclass('public.player360_subject_relationships') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.players') is null
     or to_regprocedure('public.iq_account_is_active()') is null then
    raise exception 'FAMILY_SCOPED_PLAYER_SUPPORT_V1_PREREQUISITES_MISSING';
  end if;
end
$v17_prereq$;

create or replace function public.iq_v17_family_authorization_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_player_ids uuid[] := '{}'::uuid[];
  v_team_ids uuid[] := '{}'::uuid[];
  v_team_season_ids uuid[] := '{}'::uuid[];
  v_season_ids uuid[] := '{}'::uuid[];
  v_relationships jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  select coalesce(array_agg(distinct r.player_id), '{}'::uuid[])
    into v_player_ids
  from public.player360_subject_relationships r
  where r.user_id=(select auth.uid())
    and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE'
    and r.valid_from<=now()
    and (r.valid_until is null or r.valid_until>now());

  select
    coalesce(array_agg(distinct ts.team_id), '{}'::uuid[]),
    coalesce(array_agg(distinct rm.team_season_id), '{}'::uuid[]),
    coalesce(array_agg(distinct ts.season_id), '{}'::uuid[])
  into v_team_ids,v_team_season_ids,v_season_ids
  from public.player360_subject_relationships r
  join public.roster_memberships rm on rm.player_id=r.player_id
  join public.team_seasons ts on ts.id=rm.team_season_id
  where r.user_id=(select auth.uid())
    and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE'
    and r.valid_from<=now()
    and (r.valid_until is null or r.valid_until>now())
    and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
    and (rm.joined_at is null or rm.joined_at<=current_date)
    and (rm.left_at is null or rm.left_at>current_date)
    and upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE';

  select coalesce(jsonb_agg(item order by player_name),'[]'::jsonb)
    into v_relationships
  from (
    select jsonb_build_object(
      'relationship_id',r.id,
      'player_id',r.player_id,
      'relationship_type',r.relationship_type,
      'valid_from',r.valid_from,
      'valid_until',r.valid_until,
      'player_name',trim(concat_ws(' ',p.first_name,p.last_name))
    ) item,
    trim(concat_ws(' ',p.first_name,p.last_name)) player_name
    from public.player360_subject_relationships r
    join public.players p on p.id=r.player_id
    where r.user_id=(select auth.uid())
      and r.relationship_type='GUARDIAN'
      and r.status='ACTIVE'
      and r.valid_from<=now()
      and (r.valid_until is null or r.valid_until>now())
  ) scoped;
  return jsonb_build_object(
    'version','FAMILY_SCOPED_PLAYER_SUPPORT_V1',
    'linked_player_ids',to_jsonb(v_player_ids),
    'allowed_team_ids',to_jsonb(v_team_ids),
    'allowed_team_season_ids',to_jsonb(v_team_season_ids),
    'allowed_global_season_ids',to_jsonb(v_season_ids),
    'relationships',v_relationships
  );
end;
$function$;

revoke all on function public.iq_v17_family_authorization_scope()
  from public,anon,authenticated;
grant execute on function public.iq_v17_family_authorization_scope()
  to authenticated;

do $v17_verify$
begin
  if has_function_privilege(
    'anon','public.iq_v17_family_authorization_scope()','EXECUTE'
  ) then raise exception 'FAMILY_SCOPED_PLAYER_SUPPORT_V1_ANON_RPC_OPEN'; end if;

  if not has_function_privilege(
    'authenticated','public.iq_v17_family_authorization_scope()','EXECUTE'
  ) then raise exception 'FAMILY_SCOPED_PLAYER_SUPPORT_V1_AUTH_RPC_CLOSED'; end if;
end
$v17_verify$;

commit;
