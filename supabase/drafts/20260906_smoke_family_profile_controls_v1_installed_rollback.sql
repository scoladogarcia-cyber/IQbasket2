-- IQBasket V26 · installed functional smoke · FORCED ROLLBACK
begin;

do $seed$
declare
  v_superadmin uuid;
  v_family uuid;
  v_team_season uuid;
  v_player uuid;
  v_trainer uuid;
begin
  select p.id into v_superadmin
  from public.user_profiles p
  where upper(coalesce(p.global_role,p.role,''))='SUPERADMIN'
    and public.iq_account_is_active_for_user(p.id)
  order by p.created_at nulls last
  limit 1;
  if v_superadmin is null then raise exception 'V26_SMOKE_NO_SUPERADMIN'; end if;

  select p.id into v_family
  from public.user_profiles p
  where upper(coalesce(p.role,''))='FAMILIA_TUTOR'
    and public.iq_account_is_active_for_user(p.id)
  order by p.created_at nulls last
  limit 1;
  if v_family is null then raise exception 'V26_SMOKE_NO_FAMILY'; end if;

  select ts.id,rm.player_id into v_team_season,v_player
  from public.team_seasons ts
  join public.roster_memberships rm on rm.team_season_id=ts.id
  where upper(coalesce(ts.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(rm.status,'ACTIVE')) in ('ACTIVE','ACTIVO')
  order by ts.created_at desc nulls last
  limit 1;
  if v_team_season is null or v_player is null then raise exception 'V26_SMOKE_NO_ACTIVE_ROSTER'; end if;

  select m.user_id into v_trainer
  from public.team_season_memberships m
  where m.team_season_id=v_team_season
    and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(m.function_role,''))='ENTRENADOR'
    and public.iq_account_is_active_for_user(m.user_id)
  limit 1;

  perform set_config('iq.v26.superadmin',v_superadmin::text,true);
  perform set_config('iq.v26.family',v_family::text,true);
  perform set_config('iq.v26.team_season',v_team_season::text,true);
  perform set_config('iq.v26.player',v_player::text,true);
  perform set_config('iq.v26.trainer',coalesce(v_trainer::text,''),true);
end
$seed$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',current_setting('iq.v26.superadmin'),'role','authenticated')::text,
  true
);
set local role authenticated;

do $admin_smoke$
declare
  v_family uuid:=current_setting('iq.v26.family')::uuid;
  v_team_season uuid:=current_setting('iq.v26.team_season')::uuid;
  v_player uuid:=current_setting('iq.v26.player')::uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if auth.uid()<>current_setting('iq.v26.superadmin')::uuid then
    raise exception 'V26_SMOKE_ADMIN_AUTH_CONTEXT_FAILED';
  end if;

  v_before:=public.iq_v26_get_family_profile_config(v_family,v_team_season);
  if v_before->>'user_id'<>v_family::text then raise exception 'V26_SMOKE_GET_CONFIG_FAILED'; end if;

  v_after:=public.iq_v26_save_family_profile_config(
    v_family,v_team_season,array[v_player],false,false
  );
  if not (v_after->'player_ids' ? v_player::text) then raise exception 'V26_SMOKE_LINK_NOT_RETURNED'; end if;
  if (v_after->>'show_other_player_names')::boolean then raise exception 'V26_SMOKE_NAMES_PREF_FAILED'; end if;
  if (v_after->>'show_other_player_jerseys')::boolean then raise exception 'V26_SMOKE_JERSEYS_PREF_FAILED'; end if;

  begin
    perform iq_private.v26_can_manage_family_profile(v_team_season);
    raise exception 'V26_SMOKE_PRIVATE_HELPER_EXPOSED';
  exception when insufficient_privilege then null;
  end;
end
$admin_smoke$;

reset role;

do $postgres_verify$
declare
  v_family uuid:=current_setting('iq.v26.family')::uuid;
  v_team_season uuid:=current_setting('iq.v26.team_season')::uuid;
  v_player uuid:=current_setting('iq.v26.player')::uuid;
begin
  if not exists (
    select 1 from public.player360_subject_relationships r
    where r.user_id=v_family and r.player_id=v_player
      and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
  ) then raise exception 'V26_SMOKE_RELATIONSHIP_NOT_WRITTEN'; end if;

  if not exists (
    select 1 from public.family_profile_config_audit a
    where a.family_user_id=v_family and a.team_season_id=v_team_season
      and a.actor_user_id=current_setting('iq.v26.superadmin')::uuid
  ) then raise exception 'V26_SMOKE_AUDIT_NOT_WRITTEN'; end if;
end
$postgres_verify$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',current_setting('iq.v26.family'),'role','authenticated')::text,
  true
);
set local role authenticated;

do $family_scope_smoke$
declare
  v_player uuid:=current_setting('iq.v26.player')::uuid;
  v_scope jsonb;
begin
  v_scope:=public.iq_v17_family_authorization_scope();
  if not (v_scope->'linked_player_ids' ? v_player::text) then raise exception 'V26_SMOKE_RUNTIME_LINK_SCOPE_FAILED'; end if;
  if (v_scope->>'show_other_player_names')::boolean then raise exception 'V26_SMOKE_RUNTIME_NAMES_PREF_FAILED'; end if;
  if (v_scope->>'show_other_player_jerseys')::boolean then raise exception 'V26_SMOKE_RUNTIME_JERSEYS_PREF_FAILED'; end if;
end
$family_scope_smoke$;

reset role;

-- An ENTRENADOR on the same team-season must not gain Family administration.
do $trainer_smoke$
declare
  v_trainer text:=current_setting('iq.v26.trainer');
begin
  if v_trainer='' then return; end if;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_trainer,'role','authenticated')::text,
    true
  );
end
$trainer_smoke$;
set local role authenticated;

do $trainer_denied$
declare
  v_trainer text:=current_setting('iq.v26.trainer');
  v_family uuid:=current_setting('iq.v26.family')::uuid;
  v_team_season uuid:=current_setting('iq.v26.team_season')::uuid;
begin
  if v_trainer='' then return; end if;
  begin
    perform public.iq_v26_get_family_profile_config(v_family,v_team_season);
    raise exception 'V26_SMOKE_TRAINER_ADMIN_WIDENED';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm='FAMILY_PROFILE_SCOPE_DENIED' then null; else raise; end if;
  end;
end
$trainer_denied$;

reset role;

select
  'FAMILY_PROFILE_CONTROLS_V26_INSTALLED_SMOKE_ROLLBACK' as section,
  true as multi_player_link_write_ok,
  true as preferences_ok,
  true as family_runtime_scope_ok,
  true as audit_ok,
  true as private_helpers_closed,
  true as trainer_not_widened;

rollback;
