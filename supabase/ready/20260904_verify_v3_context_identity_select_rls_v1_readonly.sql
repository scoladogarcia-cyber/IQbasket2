-- Read-only verification for V3 contextual identity SELECT RLS restoration V1.
\set ON_ERROR_STOP on

select
  'CONTEXT_IDENTITY_RLS_POLICIES' as section,
  count(*) filter (
    where tablename='team_season_memberships'
      and policyname='v3 team memberships scoped read' and cmd='SELECT'
  ) = 1 as team_membership_policy_ok,
  count(*) filter (
    where tablename='club_season_memberships'
      and policyname='v3 club memberships own or superadmin read' and cmd='SELECT'
  ) = 1 as club_membership_policy_ok,
  count(*) filter (
    where tablename='user_player_links'
      and policyname='v3 user player links own or manager read' and cmd='SELECT'
  ) = 1 as player_link_policy_ok
from pg_policies
where schemaname='public';

select
  'CONTEXT_IDENTITY_RLS_WRITES' as section,
  count(*) = 0 as no_new_write_policies
from pg_policies
where schemaname='public'
  and tablename in ('team_season_memberships','club_season_memberships','user_player_links')
  and cmd in ('INSERT','UPDATE','DELETE');
