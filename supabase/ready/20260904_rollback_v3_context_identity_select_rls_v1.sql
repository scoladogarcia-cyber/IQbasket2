-- Emergency rollback for team-season membership SELECT RLS restoration V1.
-- Returns only this table to the previous deny-all SELECT RLS state.

begin;

drop policy if exists "v3 team memberships scoped read"
  on public.team_season_memberships;

commit;
