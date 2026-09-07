-- IQBasket V37 · Read-only verification for official demo INVITADO scope
with demo as (
  select p.id
  from public.user_profiles p
  where lower(p.email)='test@test.com'
    and upper(coalesce(p.role,''))='INVITADO'
  limit 1
), checks as (
  select 'profile_is_invited' as check_name,
         exists(select 1 from demo) as ok
  union all
  select 'account_is_active',
         exists(
           select 1 from public.user_account_controls c join demo d on d.id=c.user_id
           where upper(coalesce(c.account_status,''))='ACTIVE'
         )
  union all
  select 'exactly_one_active_demo_membership',
         1 = (
           select count(*) from public.team_season_memberships m join demo d on d.id=m.user_id
           where m.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
             and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
         )
  union all
  select 'active_membership_is_invited_only',
         exists(
           select 1 from public.team_season_memberships m join demo d on d.id=m.user_id
           where m.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
             and upper(m.function_role)='INVITADO'
             and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
             and m.valid_until is null
         )
         and not exists(
           select 1 from public.team_season_memberships m join demo d on d.id=m.user_id
           where m.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
             and upper(m.function_role)<>'INVITADO'
             and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
         )
)
select * from checks order by check_name;
