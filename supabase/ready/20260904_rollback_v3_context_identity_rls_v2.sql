-- Emergency rollback to the privilege/policy state observed before V2 hardening.
begin;

drop policy if exists "v3 club memberships own read"
  on public.club_season_memberships;
drop policy if exists "v3 user player links own read"
  on public.user_player_links;

grant select on table public.team_season_memberships to anon;
grant select on table public.club_season_memberships to anon;
grant select on table public.user_player_links to anon;

grant all privileges on table public.team_season_memberships to authenticated;
grant all privileges on table public.club_season_memberships to authenticated;
grant all privileges on table public.user_player_links to authenticated;

commit;
