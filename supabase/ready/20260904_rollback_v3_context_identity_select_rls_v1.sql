-- Emergency rollback for V3 contextual identity SELECT RLS restoration V1.
-- Returns the three contextual identity tables to the previous deny-all RLS state.

begin;

drop policy if exists "v3 team memberships scoped read"
  on public.team_season_memberships;

drop policy if exists "v3 club memberships own or superadmin read"
  on public.club_season_memberships;

drop policy if exists "v3 user player links own or manager read"
  on public.user_player_links;

commit;
