-- IQBasket V3 contextual identity SELECT RLS restoration V1.
-- Restores only read policies intended by the V3 RLS design.
-- No write policy, role assignment, membership data or product data is changed.

begin;

do $preflight$
begin
  if to_regclass('public.team_season_memberships') is null
     or to_regclass('public.club_season_memberships') is null
     or to_regclass('public.user_player_links') is null then
    raise exception 'CONTEXT_IDENTITY_RLS_TABLES_MISSING';
  end if;

  if to_regprocedure('public.iq_v3_has_team_season_role(uuid,text[])') is null
     or to_regprocedure('public.iq_v3_is_superadmin()') is null
     or to_regprocedure('public.iq_v3_can_manage_player(uuid)') is null then
    raise exception 'CONTEXT_IDENTITY_RLS_HELPERS_MISSING';
  end if;
end
$preflight$;

drop policy if exists "v3 team memberships scoped read"
  on public.team_season_memberships;
create policy "v3 team memberships scoped read"
  on public.team_season_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.iq_v3_has_team_season_role(
      team_season_id,
      array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
    )
  );

drop policy if exists "v3 club memberships own or superadmin read"
  on public.club_season_memberships;
create policy "v3 club memberships own or superadmin read"
  on public.club_season_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.iq_v3_is_superadmin()
  );

drop policy if exists "v3 user player links own or manager read"
  on public.user_player_links;
create policy "v3 user player links own or manager read"
  on public.user_player_links for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
  );

commit;
