-- IQBasket v3 current-data backfill (DRAFT / ROLLBACK ONLY)
-- -----------------------------------------------------------------------------
-- DO NOT EXECUTE AS A PRODUCTION MIGRATION.
-- This script models the currently audited data and ends with ROLLBACK.
--
-- It does NOT modify legacy identifiers or legacy relationships.
-- It only populates v3 tables/bridge columns created by the v3 structure draft.
--
-- Current audited interpretation:
--   * d7a70e68... ("2025 - 2026") = Manyanet data for global 2025/2026
--   * dbc588fb... ("2025") = temporary/test legacy season used to separate
--     Mini Femenino heatmap data, but belongs to the SAME global 2025/2026
--   * Existing games, player IDs and legacy season IDs remain untouched.
-- -----------------------------------------------------------------------------

begin;

-- Safety: require v3 structure to exist.
do $$
begin
    if to_regclass('public.season_catalog') is null
       or to_regclass('public.team_seasons') is null
       or to_regclass('public.roster_memberships') is null then
        raise exception 'V3 structure is not present. Run/test the structure draft first.';
    end if;
end $$;

-- 0) Separate global security role from contextual sporting role.
-- Only the audited master account becomes SUPERADMIN globally.
-- Existing role/status columns are not changed.
update public.user_profiles
set
    global_role = case
        when lower(email) = 'scolado@nechigroup.com' then 'SUPERADMIN'
        when upper(coalesce(role, '')) = 'ADMIN' then 'ADMIN'
        else 'USER'
    end
where global_role is distinct from case
        when lower(email) = 'scolado@nechigroup.com' then 'SUPERADMIN'
        when upper(coalesce(role, '')) = 'ADMIN' then 'ADMIN'
        else 'USER'
    end;

-- Guard validation in rehearsal.
select
    'global_superadmin_count' as check_name,
    count(*) as actual,
    1 as expected
from public.user_profiles
where upper(coalesce(global_role, '')) = 'SUPERADMIN';

select
    'master_is_global_superadmin' as check_name,
    count(*) as actual,
    1 as expected
from public.user_profiles
where lower(email) = 'scolado@nechigroup.com'
  and upper(coalesce(global_role, '')) = 'SUPERADMIN';

-- 1) Create the single global season represented by the two legacy rows.
insert into public.season_catalog (
    code,
    name,
    start_date,
    end_date,
    status,
    is_test
)
values (
    '2025-2026',
    '2025/2026',
    null,
    null,
    'ACTIVE',
    false
)
on conflict (code) do update
set
    name = excluded.name,
    updated_at = now();

-- 2) Link each current team to that global season.
-- Manyanet -> real legacy season.
insert into public.team_seasons (
    team_id,
    season_id,
    legacy_season_id,
    status,
    data_status
)
select
    'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid,
    sc.id,
    'd7a70e68-d3d1-4ae9-b590-3d3291bd8a4d'::uuid,
    'ACTIVE',
    'ACTIVE'
from public.season_catalog sc
where sc.code = '2025-2026'
on conflict (team_id, season_id) do update
set
    legacy_season_id = excluded.legacy_season_id,
    updated_at = now();

-- Mini Femenino -> temporary legacy season that actually contains its games.
insert into public.team_seasons (
    team_id,
    season_id,
    legacy_season_id,
    status,
    data_status
)
select
    '8a75c9a8-f933-42fa-8bb4-22b3cf2db845'::uuid,
    sc.id,
    'dbc588fb-9ed3-4801-ab33-f014b5361dee'::uuid,
    'ACTIVE',
    'ACTIVE'
from public.season_catalog sc
where sc.code = '2025-2026'
on conflict (team_id, season_id) do update
set
    legacy_season_id = excluded.legacy_season_id,
    updated_at = now();

-- 3) Populate NEW games.team_season_id only.
-- Legacy team_id and season_id remain exactly as they are.
update public.games g
set team_season_id = ts.id
from public.team_seasons ts
join public.season_catalog sc on sc.id = ts.season_id
where
    sc.code = '2025-2026'
    and ts.team_id = g.team_id
    and (
        (g.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
         and g.season_id = 'd7a70e68-d3d1-4ae9-b590-3d3291bd8a4d'::uuid)
        or
        (g.team_id = '8a75c9a8-f933-42fa-8bb4-22b3cf2db845'::uuid
         and g.season_id = 'dbc588fb-9ed3-4801-ab33-f014b5361dee'::uuid)
    );

-- 4) Build roster history from current player.team_id.
-- No player row is edited or duplicated.
insert into public.roster_memberships (
    player_id,
    team_season_id,
    jersey,
    primary_position,
    secondary_positions,
    status,
    joined_at
)
select
    p.id,
    ts.id,
    p.jersey,
    p.primary_position,
    coalesce(p.secondary_positions, '{}'::text[]),
    p.status,
    p.joined_at
from public.players p
join public.team_seasons ts on ts.team_id = p.team_id
join public.season_catalog sc on sc.id = ts.season_id
where sc.code = '2025-2026'
on conflict (player_id, team_season_id) do update
set
    jersey = excluded.jersey,
    primary_position = excluded.primary_position,
    secondary_positions = excluded.secondary_positions,
    status = excluded.status,
    joined_at = excluded.joined_at,
    updated_at = now();

-- 5) Validation ---------------------------------------------------------------

-- Must be one global season for this code.
select
    'global_season_count' as check_name,
    count(*) as actual,
    1 as expected
from public.season_catalog
where code = '2025-2026';

-- Must be exactly two team-season contexts for current audited teams.
select
    'team_seasons_count' as check_name,
    count(*) as actual,
    2 as expected
from public.team_seasons ts
join public.season_catalog sc on sc.id = ts.season_id
where sc.code = '2025-2026'
  and ts.team_id in (
      'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid,
      '8a75c9a8-f933-42fa-8bb4-22b3cf2db845'::uuid
  );

-- Current audit had 14 games. Every one should now have the NEW bridge populated.
select
    'games_with_team_season' as check_name,
    count(*) as actual,
    14 as expected
from public.games
where team_season_id is not null;

-- Current audit had 17 players. Each should have one roster membership.
select
    'roster_memberships' as check_name,
    count(*) as actual,
    17 as expected
from public.roster_memberships rm
join public.team_seasons ts on ts.id = rm.team_season_id
join public.season_catalog sc on sc.id = ts.season_id
where sc.code = '2025-2026';

-- No game should point to a team_season from another team.
select
    'game_team_scope_mismatches' as check_name,
    count(*) as issues,
    0 as expected
from public.games g
join public.team_seasons ts on ts.id = g.team_season_id
where g.team_id <> ts.team_id;

-- Legacy columns are intentionally preserved. This query should still show the
-- two known legacy mismatches for Mini Femenino until legacy season_id is retired.
select
    g.id as legacy_mismatch_game_id,
    g.team_id as game_team_id,
    g.season_id as legacy_season_id,
    s.team_id as legacy_season_team_id,
    g.team_season_id
from public.games g
join public.seasons s on s.id = g.season_id
where g.team_id <> s.team_id
order by g.date, g.id;

-- 6) Explicit rollback --------------------------------------------------------
rollback;

-- Production version will only replace ROLLBACK with COMMIT after:
-- - external backup;
-- - pre-migration snapshot saved;
-- - structure draft tested;
-- - all validation checks match expected counts;
-- - application v3 compatibility tests pass;
-- - explicit approval.
