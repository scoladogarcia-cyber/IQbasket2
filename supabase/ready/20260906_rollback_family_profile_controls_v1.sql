-- IQBasket V26 · Family Profile Controls V1 · emergency rollback
-- Fail-closed: this rollback is only safe before any real V26 Family configuration
-- has been saved. If V26-managed relationships, preference changes or audit rows
-- exist, manual recovery is required to avoid destroying legitimate authorization history.

begin;

do $guard$
begin
  if exists (
    select 1
    from public.user_profiles p
    where coalesce(p.family_show_other_player_names,true) is distinct from true
       or coalesce(p.family_show_other_player_jerseys,true) is distinct from true
  ) then
    raise exception 'V26_ROLLBACK_BLOCKED_FAMILY_PREFERENCES_CHANGED';
  end if;

  if to_regclass('public.family_profile_config_audit') is not null
     and exists (select 1 from public.family_profile_config_audit) then
    raise exception 'V26_ROLLBACK_BLOCKED_AUDIT_DATA_PRESENT';
  end if;

  if exists (
    select 1
    from public.player360_subject_relationships r
    where coalesce(r.verification_source,'')='FAMILY_PROFILE_ADMIN_V26'
       or coalesce(r.revocation_reason,'')='FAMILY_PROFILE_ADMIN_UPDATE_V26'
  ) then
    raise exception 'V26_ROLLBACK_BLOCKED_GUARDIAN_HISTORY_CHANGED';
  end if;
end
$guard$;

revoke all on function public.iq_v26_get_family_profile_config(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.iq_v26_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean)
  from public,anon,authenticated;

drop function if exists public.iq_v26_get_family_profile_config(uuid,uuid);
drop function if exists public.iq_v26_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean);
drop function if exists iq_private.v26_family_config_payload(uuid,uuid);
drop function if exists iq_private.v26_is_family_user(uuid);
drop function if exists iq_private.v26_can_manage_family_profile(uuid);

drop policy if exists family_profile_config_audit_direct_deny
  on public.family_profile_config_audit;
drop table if exists public.family_profile_config_audit;

-- Restore the exact pre-V26 V17 Family scope contract.
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
grant execute on function public.iq_v17_family_authorization_scope() to authenticated;

alter table public.user_profiles
  drop column if exists family_show_other_player_names,
  drop column if exists family_show_other_player_jerseys;

commit;
