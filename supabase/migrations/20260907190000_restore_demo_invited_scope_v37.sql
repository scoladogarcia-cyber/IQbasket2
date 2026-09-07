-- IQBasket V37 · Restore official demo INVITADO resource scope
-- Data-only, idempotent repair. This identifies the synthetic demo account only
-- to repair demo seed data; no authorization rule depends on an email identity.

begin;

do $repair$
declare
  v_user_id uuid;
  v_team_id uuid := 'd0000000-0000-4000-8000-000000000002'::uuid;
  v_team_season_id uuid := 'd0000000-0000-4000-8000-000000000005'::uuid;
  v_active_count integer;
begin
  select p.id
    into v_user_id
    from public.user_profiles p
   where lower(p.email) = 'test@test.com'
     and upper(coalesce(p.role, '')) = 'INVITADO'
   limit 1;

  if v_user_id is null then
    raise exception 'V37_DEMO_INVITADO_PROFILE_MISSING_OR_WRONG_ROLE';
  end if;

  if not exists (
    select 1
      from public.user_account_controls c
     where c.user_id = v_user_id
       and upper(coalesce(c.account_status, '')) = 'ACTIVE'
  ) then
    raise exception 'V37_DEMO_INVITADO_ACCOUNT_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
      from public.team_seasons ts
     where ts.id = v_team_season_id
       and ts.team_id = v_team_id
  ) then
    raise exception 'V37_DEMO_TEAM_SEASON_SCOPE_INVALID';
  end if;

  -- Never leave a transient role test (e.g. JUGADOR) active for the demo identity.
  update public.team_season_memberships
     set status = 'INACTIVE',
         valid_until = coalesce(valid_until, now()),
         updated_at = now()
   where user_id = v_user_id
     and team_season_id = v_team_season_id
     and upper(function_role) <> 'INVITADO'
     and upper(coalesce(status, 'ACTIVE')) = 'ACTIVE';

  insert into public.team_season_memberships (
    user_id,
    team_season_id,
    function_role,
    status,
    valid_from,
    valid_until
  ) values (
    v_user_id,
    v_team_season_id,
    'INVITADO',
    'ACTIVE',
    now(),
    null
  )
  on conflict (user_id, team_season_id, function_role)
  do update
     set status = 'ACTIVE',
         valid_from = coalesce(public.team_season_memberships.valid_from, excluded.valid_from),
         valid_until = null,
         updated_at = now();

  select count(*)
    into v_active_count
    from public.team_season_memberships m
   where m.user_id = v_user_id
     and m.team_season_id = v_team_season_id
     and upper(coalesce(m.status, 'ACTIVE')) = 'ACTIVE';

  if v_active_count <> 1 then
    raise exception 'V37_DEMO_INVITADO_ACTIVE_SCOPE_COUNT_INVALID:%', v_active_count;
  end if;

  if not exists (
    select 1
      from public.team_season_memberships m
     where m.user_id = v_user_id
       and m.team_season_id = v_team_season_id
       and upper(m.function_role) = 'INVITADO'
       and upper(coalesce(m.status, 'ACTIVE')) = 'ACTIVE'
       and m.valid_until is null
  ) then
    raise exception 'V37_DEMO_INVITADO_SCOPE_NOT_RESTORED';
  end if;
end
$repair$;

commit;
