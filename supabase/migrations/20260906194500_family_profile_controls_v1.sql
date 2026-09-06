-- IQBasket V25 - Family profile controls V1
-- Multi-player guardian assignment + family identity visibility preferences.
begin;

alter table public.user_profiles
  add column if not exists family_show_other_player_names boolean not null default true,
  add column if not exists family_show_other_player_jerseys boolean not null default true;

create or replace function iq_private.v25_family_profile_actor_allowed(p_team_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.iq_account_is_active()
    and (
      public.iq_v3_is_global_superadmin()
      or iq_private.can_mutate_team_season(p_team_season_id)
    );
$$;

revoke all on function iq_private.v25_family_profile_actor_allowed(uuid)
  from public,anon,authenticated;

create or replace function public.iq_v25_get_family_profile_config(
  p_user_id uuid,
  p_team_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text;
  v_names boolean;
  v_jerseys boolean;
  v_player_ids uuid[] := '{}'::uuid[];
begin
  if auth.uid() is null or not iq_private.v25_family_profile_actor_allowed(p_team_season_id) then
    raise exception 'FAMILY_PROFILE_SCOPE_DENIED' using errcode='42501';
  end if;

  select upper(coalesce(global_role,role,'')),
         family_show_other_player_names,
         family_show_other_player_jerseys
    into v_role,v_names,v_jerseys
  from public.user_profiles
  where id=p_user_id;

  if v_role is distinct from 'FAMILIA_TUTOR' then
    raise exception 'FAMILY_PROFILE_TARGET_REQUIRED';
  end if;

  select coalesce(array_agg(distinct r.player_id),'{}'::uuid[])
    into v_player_ids
  from public.player360_subject_relationships r
  join public.roster_memberships rm on rm.player_id=r.player_id
  where r.user_id=p_user_id
    and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE'
    and r.valid_from<=now()
    and (r.valid_until is null or r.valid_until>now())
    and rm.team_season_id=p_team_season_id;

  return jsonb_build_object(
    'user_id',p_user_id,
    'team_season_id',p_team_season_id,
    'player_ids',to_jsonb(v_player_ids),
    'show_other_player_names',coalesce(v_names,true),
    'show_other_player_jerseys',coalesce(v_jerseys,true)
  );
end;
$$;

create or replace function public.iq_v25_save_family_profile_config(
  p_user_id uuid,
  p_team_season_id uuid,
  p_player_ids uuid[],
  p_show_other_player_names boolean,
  p_show_other_player_jerseys boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  v_player_id uuid;
  v_selected uuid[] := coalesce(p_player_ids,'{}'::uuid[]);
begin
  if auth.uid() is null or not iq_private.v25_family_profile_actor_allowed(p_team_season_id) then
    raise exception 'FAMILY_PROFILE_SCOPE_DENIED' using errcode='42501';
  end if;

  select upper(coalesce(global_role,role,'')) into v_role
  from public.user_profiles where id=p_user_id for update;
  if v_role is distinct from 'FAMILIA_TUTOR' then
    raise exception 'FAMILY_PROFILE_TARGET_REQUIRED';
  end if;

  foreach v_player_id in array v_selected loop
    if not exists (
      select 1 from public.roster_memberships rm
      where rm.team_season_id=p_team_season_id
        and rm.player_id=v_player_id
        and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
    ) then
      raise exception 'FAMILY_PROFILE_PLAYER_OUT_OF_SCOPE';
    end if;
  end loop;

  update public.player360_subject_relationships r
     set status='REVOKED', revoked_at=now(), revoked_by=auth.uid(),
         valid_until=coalesce(r.valid_until,now()),
         revocation_reason='FAMILY_PROFILE_ADMIN_UPDATE', updated_at=now()
   where r.user_id=p_user_id
     and r.relationship_type='GUARDIAN'
     and r.status='ACTIVE'
     and exists (
       select 1 from public.roster_memberships rm
       where rm.team_season_id=p_team_season_id and rm.player_id=r.player_id
     )
     and not (r.player_id=any(v_selected));

  foreach v_player_id in array v_selected loop
    if not exists (
      select 1 from public.player360_subject_relationships r
      where r.user_id=p_user_id and r.player_id=v_player_id
        and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
        and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    ) then
      insert into public.player360_subject_relationships(
        user_id,player_id,relationship_type,status,verification_source,verified_by
      ) values (
        p_user_id,v_player_id,'GUARDIAN','ACTIVE','FAMILY_PROFILE_ADMIN_V25',auth.uid()
      );
    end if;
  end loop;

  update public.user_profiles
     set family_show_other_player_names=coalesce(p_show_other_player_names,true),
         family_show_other_player_jerseys=coalesce(p_show_other_player_jerseys,true)
   where id=p_user_id;

  return public.iq_v25_get_family_profile_config(p_user_id,p_team_season_id);
end;
$$;

revoke all on function public.iq_v25_get_family_profile_config(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.iq_v25_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.iq_v25_get_family_profile_config(uuid,uuid) to authenticated;
grant execute on function public.iq_v25_save_family_profile_config(uuid,uuid,uuid[],boolean,boolean) to authenticated;

-- Extend the existing Family authorization payload with identity-visibility preferences.
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
  v_names boolean := true;
  v_jerseys boolean := true;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  select coalesce(family_show_other_player_names,true),
         coalesce(family_show_other_player_jerseys,true)
    into v_names,v_jerseys
  from public.user_profiles where id=auth.uid();

  select coalesce(array_agg(distinct r.player_id), '{}'::uuid[])
    into v_player_ids
  from public.player360_subject_relationships r
  where r.user_id=auth.uid() and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE' and r.valid_from<=now()
    and (r.valid_until is null or r.valid_until>now());

  select coalesce(array_agg(distinct ts.team_id), '{}'::uuid[]),
         coalesce(array_agg(distinct rm.team_season_id), '{}'::uuid[]),
         coalesce(array_agg(distinct ts.season_id), '{}'::uuid[])
    into v_team_ids,v_team_season_ids,v_season_ids
  from public.player360_subject_relationships r
  join public.roster_memberships rm on rm.player_id=r.player_id
  join public.team_seasons ts on ts.id=rm.team_season_id
  where r.user_id=auth.uid() and r.relationship_type='GUARDIAN'
    and r.status='ACTIVE' and r.valid_from<=now()
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
      'relationship_id',r.id,'player_id',r.player_id,
      'relationship_type',r.relationship_type,'valid_from',r.valid_from,
      'valid_until',r.valid_until,
      'player_name',trim(concat_ws(' ',p.first_name,p.last_name))
    ) item,
    trim(concat_ws(' ',p.first_name,p.last_name)) player_name
    from public.player360_subject_relationships r
    join public.players p on p.id=r.player_id
    where r.user_id=auth.uid() and r.relationship_type='GUARDIAN'
      and r.status='ACTIVE' and r.valid_from<=now()
      and (r.valid_until is null or r.valid_until>now())
  ) scoped;

  return jsonb_build_object(
    'version','FAMILY_SCOPED_PLAYER_SUPPORT_V1',
    'linked_player_ids',to_jsonb(v_player_ids),
    'allowed_team_ids',to_jsonb(v_team_ids),
    'allowed_team_season_ids',to_jsonb(v_team_season_ids),
    'allowed_global_season_ids',to_jsonb(v_season_ids),
    'relationships',v_relationships,
    'show_other_player_names',v_names,
    'show_other_player_jerseys',v_jerseys
  );
end;
$function$;

revoke all on function public.iq_v17_family_authorization_scope()
  from public,anon,authenticated;
grant execute on function public.iq_v17_family_authorization_scope() to authenticated;

commit;