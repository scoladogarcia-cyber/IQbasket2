-- IQBasket INVITADO mobile runtime scope V2 diagnostic.
-- READ ONLY: verifies persisted scope and what the authenticated RLS context can read.
\set ON_ERROR_STOP on

begin read only;

select
  'INVITED_SCOPE_ADMIN' as section,
  upper(coalesce(up.role,'INVITADO')) as profile_role,
  upper(coalesce(up.global_role,'USER')) as global_role,
  upper(coalesce(up.status,'ACTIVE')) as profile_status,
  ('d0000000-0000-4000-8000-000000000002'::uuid = any(coalesce(up.assigned_team_ids,'{}'::uuid[]))) as legacy_team_scope,
  count(m.id) filter (where upper(coalesce(m.status,'ACTIVE'))='ACTIVE') as active_memberships,
  count(m.id) filter (
    where m.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
  ) as demo_memberships,
  bool_or(
    m.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
    and upper(coalesce(m.status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(m.function_role,''))='INVITADO'
  ) as demo_invited_scope
from public.user_profiles up
left join public.team_season_memberships m on m.user_id=up.id
where lower(up.email)='test@test.com'
group by up.id,up.role,up.global_role,up.status,up.assigned_team_ids;
-- Build the same JWT claims Supabase exposes to an authenticated request.
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',up.id::text,'email',up.email,'role','authenticated')::text,
  true
) as jwt_claims
from public.user_profiles up
where lower(up.email)='test@test.com'
\gset

set local role authenticated;

select
  'INVITED_SCOPE_RLS' as section,
  auth.uid() is not null as auth_uid_ok,
  count(*) filter (
    where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
      and upper(coalesce(status,'ACTIVE'))='ACTIVE'
  ) as visible_demo_memberships,
  bool_or(
    team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
    and upper(coalesce(status,'ACTIVE'))='ACTIVE'
    and upper(coalesce(function_role,''))='INVITADO'
  ) as visible_invited_scope
from public.team_season_memberships;

select
  'INVITED_TEAM_SEASON_RLS' as section,
  count(*) = 1 as demo_team_season_visible
from public.team_seasons
where id='d0000000-0000-4000-8000-000000000005'::uuid;

rollback;

-- This runs after rollback as the DB connection owner, to explain RLS behavior.
select
  'INVITED_MEMBERSHIP_POLICY' as section,
  policyname,
  cmd,
  array_to_string(roles, '|') as roles,
  coalesce(qual,'') as using_expression
from pg_policies
where schemaname='public'
  and tablename='team_season_memberships'
order by policyname;

select
  'INVITED_MEMBERSHIP_TABLE_SECURITY' as section,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('authenticated','public.team_season_memberships','SELECT') as authenticated_select_granted
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='team_season_memberships';

select
  'CONTEXT_TABLE_SECURITY' as section,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  has_table_privilege('authenticated',format('public.%I',c.relname),'SELECT') as authenticated_select_granted,
  (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.cmd='SELECT') as select_policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('team_season_memberships','club_season_memberships','user_player_links')
order by c.relname;

select
  'CONTEXT_HELPER_METADATA' as section,
  p.proname,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig,'|'),'') as function_config,
  pg_get_userbyid(p.proowner) as owner_name
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.oid in (
    to_regprocedure('public.iq_v3_has_team_season_role(uuid,text[])'),
    to_regprocedure('public.iq_v3_is_superadmin()'),
    to_regprocedure('public.iq_v3_can_manage_player(uuid)')
  )
order by p.proname;

select
  'CONTEXT_HELPER_DEFINITION' as section,
  p.proname,
  encode(convert_to(pg_get_functiondef(p.oid),'UTF8'),'base64') as definition_base64
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.oid in (
    to_regprocedure('public.iq_v3_has_team_season_role(uuid,text[])'),
    to_regprocedure('public.iq_v3_is_superadmin()'),
    to_regprocedure('public.iq_v3_can_manage_player(uuid)')
  )
order by p.proname;
