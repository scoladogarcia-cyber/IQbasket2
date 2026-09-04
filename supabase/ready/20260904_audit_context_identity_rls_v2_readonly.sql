-- IQBasket contextual identity RLS V2 audit. READ ONLY.
\set ON_ERROR_STOP on
begin read only;

select 'CTX_RLS_TABLE' as section,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as auth_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as auth_delete,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
       (select count(*) from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('team_season_memberships','club_season_memberships','user_player_links')
order by c.relname;

select 'CTX_RLS_POLICY' as section,
       tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('team_season_memberships','club_season_memberships','user_player_links')
order by tablename, policyname;
select 'CTX_RLS_ROWS' as section,
       (select count(*) from public.club_season_memberships) as club_memberships,
       (select count(*) from public.user_player_links) as player_links;

select 'CTX_RLS_HELPER' as section,
       p.proname,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig,'|'),'') as config,
       pg_get_userbyid(p.proowner) as owner_name
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'iq_v3_can_manage_team_season',
    'iq_v3_can_read_team_season',
    'iq_v3_is_global_superadmin'
  )
order by p.proname;

rollback;


