-- IQBasket v3 - FIX SELECT RLS FOR SEASON CATALOG + TEAM SEASONS
-- =============================================================================
-- SECURITY-ONLY / NON-DESTRUCTIVE.
-- Restores authenticated read access to v3 season context without disabling RLS.
-- Does NOT modify application data.
-- Does NOT grant anonymous visibility through RLS.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Global SUPERADMIN helper
-- Phase 3A will create/replace the same helper later.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_is_global_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
  );
$$;

revoke all on function public.iq_v3_is_global_superadmin() from public;
grant execute on function public.iq_v3_is_global_superadmin() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Central read authorization helper for a team-season context
-- Supports canonical v3 memberships plus legacy/team and linked-player bridges
-- during the transition.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_can_read_team_season(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.team_seasons ts
      where ts.id = p_team_season_id
        and (
          public.iq_v3_is_global_superadmin()

          or exists (
            select 1
            from public.team_season_memberships tsm
            where tsm.user_id = auth.uid()
              and tsm.team_season_id = ts.id
              and upper(coalesce(tsm.status, 'ACTIVE')) = 'ACTIVE'
              and (tsm.valid_from is null or tsm.valid_from <= now())
              and (tsm.valid_until is null or tsm.valid_until > now())
          )

          or exists (
            select 1
            from public.user_profiles up
            cross join lateral jsonb_array_elements_text(
              coalesce(to_jsonb(up.assigned_team_ids), '[]'::jsonb)
            ) assigned(team_id)
            where up.id = auth.uid()
              and assigned.team_id = ts.team_id::text
          )

          or exists (
            select 1
            from public.user_player_links upl
            join public.roster_memberships rm
              on rm.player_id = upl.player_id
             and rm.team_season_id = ts.id
            where upl.user_id = auth.uid()
              and upper(coalesce(upl.status, 'ACTIVE')) = 'ACTIVE'
              and upper(coalesce(rm.status, 'ACTIVE')) = 'ACTIVE'
              and (upl.valid_from is null or upl.valid_from <= now())
              and (upl.valid_until is null or upl.valid_until > now())
          )
        )
    );
$$;

revoke all on function public.iq_v3_can_read_team_season(uuid) from public;
grant execute on function public.iq_v3_can_read_team_season(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. SELECT policies
-- -----------------------------------------------------------------------------
drop policy if exists iq_v3_team_seasons_select_authorized
  on public.team_seasons;

create policy iq_v3_team_seasons_select_authorized
  on public.team_seasons
  for select
  to authenticated
  using (
    public.iq_v3_can_read_team_season(id)
  );

drop policy if exists iq_v3_season_catalog_select_authorized
  on public.season_catalog;

create policy iq_v3_season_catalog_select_authorized
  on public.season_catalog
  for select
  to authenticated
  using (
    public.iq_v3_is_global_superadmin()
    or exists (
      select 1
      from public.team_seasons ts
      where ts.season_id = season_catalog.id
        and public.iq_v3_can_read_team_season(ts.id)
    )
  );

commit;

-- -----------------------------------------------------------------------------
-- 4. Verification: expected 2 SELECT policies
-- -----------------------------------------------------------------------------
select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('season_catalog', 'team_seasons')
order by tablename, policyname;
