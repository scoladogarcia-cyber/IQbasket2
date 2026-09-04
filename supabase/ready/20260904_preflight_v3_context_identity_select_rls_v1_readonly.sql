-- Read-only preflight for contextual identity SELECT RLS restoration V1.
\set ON_ERROR_STOP on

with target_tables(name) as (
  values ('team_season_memberships'),('club_season_memberships'),('user_player_links')
), table_state as (
  select
    t.name,
    c.relrowsecurity,
    c.relforcerowsecurity,
    has_table_privilege('authenticated',format('public.%I',t.name),'SELECT') as select_granted,
    (select count(*) from pg_policies p
      where p.schemaname='public' and p.tablename=t.name and p.cmd='SELECT') as select_policies
  from target_tables t
  left join pg_class c on c.relname=t.name
  left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
)
select
  'CONTEXT_IDENTITY_RLS_PREFLIGHT' as section,
  count(*) = 3 as tables_ok,
  bool_and(relrowsecurity) as rls_enabled_ok,
  bool_and(not relforcerowsecurity) as rls_not_forced_ok,
  bool_and(select_granted) as select_grants_ok,
  sum(select_policies) = 0 as missing_select_policies_confirmed
from table_state
where relrowsecurity is not null;

select
  'CONTEXT_IDENTITY_RLS_HELPERS' as section,
  coalesce((select p.prosecdef from pg_proc p where p.oid=to_regprocedure('public.iq_v3_has_team_season_role(uuid,text[])')),false) as team_role_helper_secure,
  coalesce((select p.prosecdef from pg_proc p where p.oid=to_regprocedure('public.iq_v3_is_superadmin()')),false) as superadmin_helper_secure,
  coalesce((select p.prosecdef from pg_proc p where p.oid=to_regprocedure('public.iq_v3_can_manage_player(uuid)')),false) as player_manager_helper_secure;
