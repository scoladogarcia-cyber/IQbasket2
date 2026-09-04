-- IQBasket Demo V1 - INVITADO runtime scope hotfix
-- DEMO-ONLY / ATOMIC / IDEMPOTENT
-- Converts the synthetic test account membership from ANALISTA to INVITADO so
-- the membership grants resource scope without elevating functional permissions.

begin;

do $fix$
declare
  v_user_id uuid;
  v_count integer;
begin
  select id into v_user_id
  from public.user_profiles
  where lower(email)='test@test.com'
  limit 1;

  if v_user_id is null then
    raise exception 'DEMO_INVITED_SCOPE_TEST_USER_MISSING';
  end if;

  if not exists (
    select 1 from public.team_seasons
    where id='d0000000-0000-4000-8000-000000000005'::uuid
  ) then
    raise exception 'DEMO_INVITED_SCOPE_TEAM_SEASON_MISSING';
  end if;

  select count(*) into v_count
  from public.team_season_memberships
  where user_id=v_user_id
    and team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
    and upper(coalesce(status,'ACTIVE'))='ACTIVE';

  if v_count <> 1 then
    raise exception 'DEMO_INVITED_SCOPE_UNEXPECTED_MEMBERSHIP_COUNT:%', v_count;
  end if;

  if exists (
    select 1 from public.team_season_memberships
    where user_id=v_user_id
      and team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(coalesce(status,'ACTIVE'))='ACTIVE'
      and upper(function_role) not in ('ANALISTA','INVITADO')
  ) then
    raise exception 'DEMO_INVITED_SCOPE_UNEXPECTED_FUNCTION_ROLE';
  end if;

  update public.team_season_memberships
  set function_role='INVITADO', updated_at=now()
  where user_id=v_user_id
    and team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
    and upper(coalesce(status,'ACTIVE'))='ACTIVE'
    and upper(function_role)='ANALISTA';

  if not exists (
    select 1 from public.team_season_memberships
    where user_id=v_user_id
      and team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(coalesce(status,'ACTIVE'))='ACTIVE'
      and upper(function_role)='INVITADO'
  ) then
    raise exception 'DEMO_INVITED_SCOPE_FINAL_ROLE_INVALID';
  end if;

  if exists (
    select 1 from public.user_profiles
    where id=v_user_id
      and (
        upper(coalesce(role,'INVITADO')) <> 'INVITADO'
        or upper(coalesce(global_role,'USER')) not in ('USER','INVITADO')
      )
  ) then
    raise exception 'DEMO_INVITED_SCOPE_IDENTITY_ESCALATED';
  end if;
end
$fix$;

commit;

select 'DEMO_INVITED_SCOPE_HOTFIX_OK' as marker;
