-- Read-only preflight for team-season membership SELECT RLS restoration V1.
-- Safe to run before the first apply and before later idempotent re-applies.
\set ON_ERROR_STOP on

select
  'TEAM_MEMBERSHIP_RLS_PREFLIGHT' as section,
  c.relrowsecurity as rls_enabled,
  not c.relforcerowsecurity as rls_not_forced,
  has_table_privilege('authenticated','public.team_season_memberships','SELECT') as select_granted,
  (select count(*) from pg_policies p
    where p.schemaname='public'
      and p.tablename='team_season_memberships'
      and p.cmd='SELECT') <= 1 as select_policy_state_safe
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='team_season_memberships';

select
  'TEAM_MEMBERSHIP_RLS_HELPER' as section,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig,'|'),'') = 'search_path=""' as hardened_search_path,
  has_function_privilege('authenticated','public.iq_v3_can_manage_team_season(uuid)','EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.oid=to_regprocedure('public.iq_v3_can_manage_team_season(uuid)');
