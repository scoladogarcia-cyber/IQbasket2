-- IQBasket V3 team-season membership SELECT RLS restoration V1.
-- Restores canonical contextual scope reads without changing membership data.
-- No INSERT/UPDATE/DELETE policy or role assignment is added.

begin;

do $preflight$
begin
  if to_regclass('public.team_season_memberships') is null then
    raise exception 'TEAM_MEMBERSHIP_RLS_TABLE_MISSING';
  end if;

  if to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null then
    raise exception 'TEAM_MEMBERSHIP_RLS_HELPER_MISSING';
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
    or public.iq_v3_can_manage_team_season(team_season_id)
  );

commit;
