-- Read-only verification for team-season membership SELECT RLS restoration V1.
\set ON_ERROR_STOP on

select
  'TEAM_MEMBERSHIP_RLS_POLICY' as section,
  count(*) filter (
    where policyname='v3 team memberships scoped read' and cmd='SELECT'
  ) = 1 as scoped_read_policy_ok,
  count(*) filter (where cmd in ('INSERT','UPDATE','DELETE')) = 0 as no_write_policies
from pg_policies
where schemaname='public'
  and tablename='team_season_memberships';

select
  'TEAM_MEMBERSHIP_RLS_POLICY_SHAPE' as section,
  position('user_id = auth.uid()' in replace(coalesce(qual,''),'  ',' ')) > 0 as own_scope_present,
  position('iq_v3_can_manage_team_season' in coalesce(qual,'')) > 0 as manager_scope_present
from pg_policies
where schemaname='public'
  and tablename='team_season_memberships'
  and policyname='v3 team memberships scoped read'
  and cmd='SELECT';
