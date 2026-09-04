-- Read-only verification for contextual identity RLS V2.
\set ON_ERROR_STOP on

with target(name) as (
  values ('team_season_memberships'),('club_season_memberships'),('user_player_links')
)
select 'CTX_RLS_V2_PRIVILEGES' as section,
       bool_and(has_table_privilege('authenticated',format('public.%I',name),'SELECT')) as auth_select,
       bool_and(not has_table_privilege('authenticated',format('public.%I',name),'INSERT')) as no_insert,
       bool_and(not has_table_privilege('authenticated',format('public.%I',name),'UPDATE')) as no_update,
       bool_and(not has_table_privilege('authenticated',format('public.%I',name),'DELETE')) as no_delete,
       bool_and(not has_table_privilege('anon',format('public.%I',name),'SELECT')) as anon_no_select
from target;

select 'CTX_RLS_V2_POLICIES' as section,
       count(*) filter (where tablename='team_season_memberships' and cmd='SELECT')=1 as team_read,
       count(*) filter (where tablename='club_season_memberships' and policyname='v3 club memberships own read' and cmd='SELECT')=1 as club_read,
       count(*) filter (where tablename='user_player_links' and policyname='v3 user player links own read' and cmd='SELECT')=1 as player_link_read,
       count(*) filter (where cmd in ('INSERT','UPDATE','DELETE'))=0 as no_write_policies
from pg_policies
where schemaname='public'
  and tablename in ('team_season_memberships','club_season_memberships','user_player_links');
select 'CTX_RLS_V2_POLICY_SHAPE' as section,
       bool_and(position('user_id = auth.uid()' in coalesce(qual,'')) > 0) as own_only
from pg_policies
where schemaname='public'
  and (
    (tablename='club_season_memberships' and policyname='v3 club memberships own read')
    or (tablename='user_player_links' and policyname='v3 user player links own read')
  );
