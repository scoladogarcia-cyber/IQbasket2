-- IQBasket V3 contextual identity RLS hardening V2.
-- Browser roles receive read-only access; all mutations remain RPC/backend-only.
-- Existing team-season membership read policy is preserved.
begin;

do $preflight$
begin
  if to_regclass('public.team_season_memberships') is null
     or to_regclass('public.club_season_memberships') is null
     or to_regclass('public.user_player_links') is null then
    raise exception 'CONTEXT_IDENTITY_TABLES_MISSING';
  end if;
  if to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null then
    raise exception 'CONTEXT_IDENTITY_HELPER_MISSING';
  end if;
end
$preflight$;

alter table public.team_season_memberships enable row level security;
alter table public.club_season_memberships enable row level security;
alter table public.user_player_links enable row level security;

revoke all on table public.team_season_memberships from anon, authenticated;
revoke all on table public.club_season_memberships from anon, authenticated;
revoke all on table public.user_player_links from anon, authenticated;
grant select on table public.team_season_memberships to authenticated;
grant select on table public.club_season_memberships to authenticated;
grant select on table public.user_player_links to authenticated;

drop policy if exists "v3 club memberships own read"
  on public.club_season_memberships;
create policy "v3 club memberships own read"
  on public.club_season_memberships for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "v3 user player links own read"
  on public.user_player_links;
create policy "v3 user player links own read"
  on public.user_player_links for select
  to authenticated
  using (user_id = auth.uid());

commit;
