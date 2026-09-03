-- IQBasket · SaaS tenant isolation audit · READ ONLY
-- Lists RLS state, policies and authenticated grants for production app tables.

with target_tables(tablename) as (
  values
    ('clubs'),('teams'),('players'),('games'),('user_profiles'),
    ('season_catalog'),('team_seasons'),
    ('team_season_memberships'),('club_season_memberships'),
    ('roster_memberships'),('roster_membership_stints'),('staff_assignments'),
    ('player_game_stats'),('team_game_stats'),('game_events'),
    ('game_period_scores'),('lineup_game_stats'),('play_by_play_events'),
    ('team_join_requests'),('roster_transfer_requests'),('roster_transfer_reviews'),
    ('game_lock_requests'),('game_lock_history'),
    ('team_season_freeze_requests'),('team_season_freeze_history'),
    ('training_sessions'),('training_attendance'),('external_player_development'),
    ('player_evaluations'),('player_objective_profiles'),('player_objective_targets'),
    ('player_longitudinal_snapshots'),('player_ai_insights'),
    ('player360_subject_relationships'),('player360_processing_authorizations'),
    ('player360_sensitive_access_grants'),('player360_sensitive_access_requests'),
    ('player360_wellness_entries')
),
inventory as (
  select
    t.tablename,
    c.oid is not null as exists_ok,
    coalesce(c.relrowsecurity,false) as rls_enabled,
    coalesce(c.relforcerowsecurity,false) as rls_forced,
    coalesce((
      select count(*) from pg_policies p
      where p.schemaname='public' and p.tablename=t.tablename
    ),0) as policy_count,
    coalesce((
      select string_agg(distinct p.cmd, ',' order by p.cmd)
      from pg_policies p
      where p.schemaname='public' and p.tablename=t.tablename
    ),'') as policy_commands,
    coalesce((
      select string_agg(distinct g.privilege_type, ',' order by g.privilege_type)
      from information_schema.role_table_grants g
      where g.table_schema='public'
        and g.table_name=t.tablename
        and g.grantee='authenticated'
    ),'') as authenticated_grants
  from target_tables t
  left join pg_class c
    on c.relname=t.tablename
   and c.relnamespace='public'::regnamespace
   and c.relkind in ('r','p')
)
select
  'TENANT_RLS_INVENTORY' as section,
  *,
  (
    exists_ok
    and (
      rls_enabled
      or authenticated_grants = ''
      or authenticated_grants = 'SELECT'
    )
  ) as no_unprotected_authenticated_write
from inventory
order by tablename;

select
  'TENANT_RLS_RISK' as section,
  c.relname as tablename,
  c.relrowsecurity as rls_enabled,
  string_agg(distinct g.privilege_type, ',' order by g.privilege_type) as authenticated_grants
from pg_class c
join information_schema.role_table_grants g
  on g.table_schema='public'
 and g.table_name=c.relname
 and g.grantee='authenticated'
where c.relnamespace='public'::regnamespace
  and c.relkind in ('r','p')
  and not c.relrowsecurity
  and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
group by c.relname,c.relrowsecurity
order by c.relname;

select
  'TENANT_PUBLIC_ANON_RISK' as section,
  g.grantee,
  g.table_name,
  string_agg(distinct g.privilege_type, ',' order by g.privilege_type) as grants
from information_schema.role_table_grants g
join pg_class c
  on c.relname=g.table_name
 and c.relnamespace='public'::regnamespace
where g.table_schema='public'
  and g.grantee in ('anon','PUBLIC')
  and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
group by g.grantee,g.table_name
order by g.grantee,g.table_name;

select
  'TENANT_POLICY_SUMMARY' as section,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles::text as roles,
  p.cmd,
  left(coalesce(p.qual,''),220) as using_qual,
  left(coalesce(p.with_check,''),220) as with_check
from pg_policies p
where p.schemaname='public'
  and p.tablename in (
    'clubs','teams','players','games','user_profiles',
    'season_catalog','team_seasons',
    'team_season_memberships','club_season_memberships',
    'roster_memberships','roster_membership_stints',
    'player_game_stats','team_game_stats','game_events',
    'game_period_scores','lineup_game_stats','play_by_play_events'
  )
order by p.tablename,p.cmd,p.policyname;
