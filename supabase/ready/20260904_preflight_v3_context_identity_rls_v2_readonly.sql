-- Read-only preflight for contextual identity RLS V2.
\set ON_ERROR_STOP on

with target(name) as (
  values ('team_season_memberships'),('club_season_memberships'),('user_player_links')
), state as (
  select t.name, c.relrowsecurity
  from target t
  join pg_class c on c.relname=t.name
  join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
)
select 'CTX_RLS_V2_PREFLIGHT' as section,
       count(*)=3 as tables_ok,
       bool_and(relrowsecurity) as rls_enabled,
       exists (
         select 1 from pg_policies
         where schemaname='public'
           and tablename='team_season_memberships'
           and policyname='v3 team memberships scoped read'
           and cmd='SELECT'
       ) as team_policy_ok
from state;

select 'CTX_RLS_V2_HELPER' as section,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig,'|'),'')='search_path=""' as hardened
from pg_proc p
where p.oid=to_regprocedure('public.iq_v3_can_manage_team_season(uuid)');
