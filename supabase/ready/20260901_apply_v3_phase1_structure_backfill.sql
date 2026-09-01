-- IQBasket v3 PHASE 1 - STRUCTURE + BACKFILL
-- =============================================================================
-- PRODUCTION-READY FIRST COMMIT.
--
-- Preconditions already completed:
--   * encrypted external backup stored outside Supabase;
--   * internal safety snapshot iqbackup_pre_v3_20260901 validated;
--   * full v3 rehearsal completed successfully with ROLLBACK.
--
-- This phase is ADDITIVE:
--   * creates v3 tables;
--   * adds nullable bridge columns;
--   * creates one global 2025/2026 season;
--   * creates team-season contexts for current audited teams;
--   * backfills games.team_season_id;
--   * creates roster history from current players;
--   * separates global security role from contextual sporting function.
--
-- This phase DOES NOT:
--   * delete legacy rows;
--   * change player IDs or game IDs;
--   * drop or rename legacy tables/columns;
--   * enable RLS;
--   * change current app authorization behavior.
--
-- Any failed assertion aborts the whole transaction.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. PRE-FLIGHT: require validated internal safety snapshot
-- -----------------------------------------------------------------------------

do $$
begin
    if to_regclass('iqbackup_pre_v3_20260901.games') is null
       or to_regclass('iqbackup_pre_v3_20260901.players') is null
       or to_regclass('iqbackup_pre_v3_20260901.user_profiles') is null then
        raise exception 'Pre-v3 internal safety snapshot is missing. Phase 1 aborted.';
    end if;

    if (select count(*) from public.games)
       <> (select count(*) from iqbackup_pre_v3_20260901.games) then
        raise exception 'games changed since safety snapshot. Phase 1 aborted.';
    end if;

    if (select count(*) from public.players)
       <> (select count(*) from iqbackup_pre_v3_20260901.players) then
        raise exception 'players changed since safety snapshot. Phase 1 aborted.';
    end if;

    if (select count(*) from public.player_game_stats)
       <> (select count(*) from iqbackup_pre_v3_20260901.player_game_stats) then
        raise exception 'player_game_stats changed since safety snapshot. Phase 1 aborted.';
    end if;

    if (select count(*) from public.game_events)
       <> (select count(*) from iqbackup_pre_v3_20260901.game_events) then
        raise exception 'game_events changed since safety snapshot. Phase 1 aborted.';
    end if;

    if (select count(*) from public.translations)
       <> (select count(*) from iqbackup_pre_v3_20260901.translations) then
        raise exception 'translations changed since safety snapshot. Phase 1 aborted.';
    end if;
end $$;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. GLOBAL SEASON CATALOG
-- -----------------------------------------------------------------------------

create table if not exists public.season_catalog (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    name text not null,
    start_date date,
    end_date date,
    status text not null default 'ACTIVE',
    is_test boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint season_catalog_code_key unique (code)
);

comment on table public.season_catalog is
'Global IQBasket seasons. A season exists once and can be linked to many teams.';

-- -----------------------------------------------------------------------------
-- 2. TEAM + GLOBAL SEASON CONTEXT
-- -----------------------------------------------------------------------------

create table if not exists public.team_seasons (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete restrict,
    season_id uuid not null references public.season_catalog(id) on delete restrict,
    legacy_season_id uuid references public.seasons(id) on delete set null,
    status text not null default 'ACTIVE',
    data_status text not null default 'ACTIVE',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint team_seasons_team_season_key unique (team_id, season_id)
);

create index if not exists idx_team_seasons_team_id
    on public.team_seasons(team_id);
create index if not exists idx_team_seasons_season_id
    on public.team_seasons(season_id);
create index if not exists idx_team_seasons_legacy_season_id
    on public.team_seasons(legacy_season_id);

comment on table public.team_seasons is
'Context that joins a team to a global season. This becomes the scope for roster, staff, games and analytics.';

-- -----------------------------------------------------------------------------
-- 3. HISTORICAL ROSTER
-- -----------------------------------------------------------------------------

create table if not exists public.roster_memberships (
    id uuid primary key default gen_random_uuid(),
    player_id uuid not null references public.players(id) on delete restrict,
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    jersey integer,
    primary_position text,
    secondary_positions text[] not null default '{}',
    status text not null default 'ACTIVE',
    joined_at timestamptz,
    left_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint roster_memberships_player_team_season_key
        unique (player_id, team_season_id)
);

create index if not exists idx_roster_memberships_team_season_id
    on public.roster_memberships(team_season_id);
create index if not exists idx_roster_memberships_player_id
    on public.roster_memberships(player_id);

comment on table public.roster_memberships is
'Historical player membership. players.id remains the permanent identity used by existing statistics.';

-- -----------------------------------------------------------------------------
-- 4. CONTEXTUAL USER MEMBERSHIPS
-- -----------------------------------------------------------------------------

create table if not exists public.team_season_memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profiles(id) on delete restrict,
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    function_role text not null,
    status text not null default 'ACTIVE',
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint team_season_memberships_unique
        unique (user_id, team_season_id, function_role)
);

create index if not exists idx_team_season_memberships_user_id
    on public.team_season_memberships(user_id);
create index if not exists idx_team_season_memberships_scope
    on public.team_season_memberships(team_season_id, status);

create table if not exists public.club_season_memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profiles(id) on delete restrict,
    club_id uuid not null references public.clubs(id) on delete restrict,
    season_id uuid not null references public.season_catalog(id) on delete restrict,
    function_role text not null,
    status text not null default 'ACTIVE',
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint club_season_memberships_unique
        unique (user_id, club_id, season_id, function_role)
);

create index if not exists idx_club_season_memberships_user_id
    on public.club_season_memberships(user_id);
create index if not exists idx_club_season_memberships_scope
    on public.club_season_memberships(club_id, season_id, status);

create table if not exists public.user_player_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profiles(id) on delete restrict,
    player_id uuid not null references public.players(id) on delete restrict,
    relation_type text not null,
    status text not null default 'ACTIVE',
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_player_links_unique unique (user_id, player_id, relation_type)
);

create index if not exists idx_user_player_links_user_id
    on public.user_player_links(user_id);
create index if not exists idx_user_player_links_player_id
    on public.user_player_links(player_id);

-- -----------------------------------------------------------------------------
-- 5. PERSISTED ANALYTICS
-- -----------------------------------------------------------------------------

create table if not exists public.analytics_runs (
    id uuid primary key default gen_random_uuid(),
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    calculation_version text not null,
    trigger_type text not null default 'MANUAL',
    source_revision text,
    status text not null default 'COMPLETED',
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_by uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_analytics_runs_scope_version
    on public.analytics_runs(team_season_id, calculation_version, started_at desc);

create table if not exists public.player_season_metrics (
    id uuid primary key default gen_random_uuid(),
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    player_id uuid not null references public.players(id) on delete restrict,
    calculation_version text not null,
    source_revision text,
    games_played integer not null default 0,
    minutes numeric,
    points numeric,
    ppg numeric,
    rpg numeric,
    apg numeric,
    pir numeric,
    true_shooting_pct numeric,
    efg_pct numeric,
    usage_pct numeric,
    offensive_rating numeric,
    defensive_rating numeric,
    net_rating numeric,
    metrics jsonb not null default '{}'::jsonb,
    calculated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint player_season_metrics_unique
        unique (team_season_id, player_id, calculation_version)
);

create index if not exists idx_player_season_metrics_scope
    on public.player_season_metrics(team_season_id, player_id);
create index if not exists idx_player_season_metrics_metrics_gin
    on public.player_season_metrics using gin(metrics);

create table if not exists public.team_season_metrics (
    id uuid primary key default gen_random_uuid(),
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    calculation_version text not null,
    source_revision text,
    games_played integer not null default 0,
    wins integer not null default 0,
    losses integer not null default 0,
    points_for numeric,
    points_against numeric,
    pace numeric,
    offensive_rating numeric,
    defensive_rating numeric,
    net_rating numeric,
    efg_pct numeric,
    metrics jsonb not null default '{}'::jsonb,
    calculated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint team_season_metrics_unique
        unique (team_season_id, calculation_version)
);

create index if not exists idx_team_season_metrics_scope
    on public.team_season_metrics(team_season_id);
create index if not exists idx_team_season_metrics_metrics_gin
    on public.team_season_metrics using gin(metrics);

create table if not exists public.lineup_season_metrics (
    id uuid primary key default gen_random_uuid(),
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    lineup_player_ids uuid[] not null,
    lineup_key text not null,
    calculation_version text not null,
    source_revision text,
    possessions numeric,
    minutes numeric,
    points_for numeric,
    points_against numeric,
    plus_minus numeric,
    offensive_rating numeric,
    defensive_rating numeric,
    net_rating numeric,
    metrics jsonb not null default '{}'::jsonb,
    calculated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint lineup_season_metrics_unique
        unique (team_season_id, lineup_key, calculation_version)
);

create index if not exists idx_lineup_season_metrics_scope
    on public.lineup_season_metrics(team_season_id);
create index if not exists idx_lineup_season_metrics_players_gin
    on public.lineup_season_metrics using gin(lineup_player_ids);
create index if not exists idx_lineup_season_metrics_metrics_gin
    on public.lineup_season_metrics using gin(metrics);

-- -----------------------------------------------------------------------------
-- 6. ADDITIVE BRIDGE COLUMNS
-- -----------------------------------------------------------------------------

alter table public.games
    add column if not exists team_season_id uuid
    references public.team_seasons(id) on delete restrict;

create index if not exists idx_games_team_season_id
    on public.games(team_season_id);

alter table public.reports
    add column if not exists team_season_id uuid
    references public.team_seasons(id) on delete restrict;

create index if not exists idx_reports_team_season_id
    on public.reports(team_season_id);

alter table public.team_join_requests
    add column if not exists team_season_id uuid
    references public.team_seasons(id) on delete restrict;

create index if not exists idx_team_join_requests_team_season_id
    on public.team_join_requests(team_season_id);

create unique index if not exists uq_team_join_requests_pending_scope
    on public.team_join_requests(user_id, team_season_id)
    where team_season_id is not null
      and lower(coalesce(status, 'pending')) in ('pending', 'pendiente');

alter table public.user_profiles
    add column if not exists global_role text;

create unique index if not exists uq_user_profiles_single_global_superadmin
    on public.user_profiles ((upper(global_role)))
    where upper(coalesce(global_role, '')) = 'SUPERADMIN';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'user_profiles_superadmin_email_guard'
          and conrelid = 'public.user_profiles'::regclass
    ) then
        alter table public.user_profiles
            add constraint user_profiles_superadmin_email_guard
            check (
                upper(coalesce(global_role, 'USER')) <> 'SUPERADMIN'
                or lower(email) = 'scolado@nechigroup.com'
            )
            not valid;
    end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. GLOBAL SECURITY ROLE BACKFILL
-- -----------------------------------------------------------------------------

update public.user_profiles
set global_role = case
    when lower(email) = 'scolado@nechigroup.com' then 'SUPERADMIN'
    when upper(coalesce(role, '')) = 'ADMIN' then 'ADMIN'
    else 'USER'
end
where global_role is distinct from case
    when lower(email) = 'scolado@nechigroup.com' then 'SUPERADMIN'
    when upper(coalesce(role, '')) = 'ADMIN' then 'ADMIN'
    else 'USER'
end;

-- -----------------------------------------------------------------------------
-- 8. GLOBAL 2025/2026 SEASON + CURRENT TEAM CONTEXTS
-- -----------------------------------------------------------------------------

insert into public.season_catalog (
    code, name, start_date, end_date, status, is_test
)
values (
    '2025-2026', '2025/2026', null, null, 'ACTIVE', false
)
on conflict (code) do update
set name = excluded.name,
    updated_at = now();

insert into public.team_seasons (
    team_id, season_id, legacy_season_id, status, data_status
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
set legacy_season_id = excluded.legacy_season_id,
    updated_at = now();

insert into public.team_seasons (
    team_id, season_id, legacy_season_id, status, data_status
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
set legacy_season_id = excluded.legacy_season_id,
    updated_at = now();

-- -----------------------------------------------------------------------------
-- 9. GAME BRIDGE BACKFILL - legacy team_id/season_id remain unchanged
-- -----------------------------------------------------------------------------

update public.games g
set team_season_id = ts.id
from public.team_seasons ts
join public.season_catalog sc on sc.id = ts.season_id
where sc.code = '2025-2026'
  and ts.team_id = g.team_id
  and (
      (
          g.team_id = 'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid
          and g.season_id = 'd7a70e68-d3d1-4ae9-b590-3d3291bd8a4d'::uuid
      )
      or
      (
          g.team_id = '8a75c9a8-f933-42fa-8bb4-22b3cf2db845'::uuid
          and g.season_id = 'dbc588fb-9ed3-4801-ab33-f014b5361dee'::uuid
      )
  );

-- -----------------------------------------------------------------------------
-- 10. ROSTER BACKFILL - no existing player row is modified
-- -----------------------------------------------------------------------------

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
set jersey = excluded.jersey,
    primary_position = excluded.primary_position,
    secondary_positions = excluded.secondary_positions,
    status = excluded.status,
    joined_at = excluded.joined_at,
    updated_at = now();

-- -----------------------------------------------------------------------------
-- 11. HARD VALIDATION - any problem aborts COMMIT
-- -----------------------------------------------------------------------------

do $$
declare
    issue_count bigint;
begin
    if (select count(*) from public.season_catalog where code = '2025-2026') <> 1 then
        raise exception 'Expected exactly one global 2025-2026 season';
    end if;

    if (
        select count(*)
        from public.team_seasons ts
        join public.season_catalog sc on sc.id = ts.season_id
        where sc.code = '2025-2026'
          and ts.team_id in (
              'e7f88dd1-7b8e-4b60-acbd-d5b40b5acd22'::uuid,
              '8a75c9a8-f933-42fa-8bb4-22b3cf2db845'::uuid
          )
    ) <> 2 then
        raise exception 'Expected exactly two current team-season contexts';
    end if;

    if (select count(*) from public.games where team_season_id is null) <> 0 then
        raise exception 'At least one current game has no v3 team-season bridge';
    end if;

    if (select count(*) from public.roster_memberships)
       <> (select count(*) from public.players) then
        raise exception 'Roster membership count does not match current player count';
    end if;

    select count(*)
    into issue_count
    from public.games g
    join public.team_seasons ts on ts.id = g.team_season_id
    where g.team_id <> ts.team_id;

    if issue_count <> 0 then
        raise exception 'Game/team-season scope mismatch detected: %', issue_count;
    end if;

    if (
        select count(*)
        from public.user_profiles
        where upper(coalesce(global_role, '')) = 'SUPERADMIN'
    ) <> 1 then
        raise exception 'Expected exactly one global SUPERADMIN';
    end if;

    if not exists (
        select 1
        from public.user_profiles
        where lower(email) = 'scolado@nechigroup.com'
          and upper(coalesce(global_role, '')) = 'SUPERADMIN'
    ) then
        raise exception 'Expected master account is not the global SUPERADMIN';
    end if;

    -- Existing legacy game content must match the safety snapshot when the new
    -- bridge column is ignored.
    select count(*)
    into issue_count
    from (
        select to_jsonb(g) - 'team_season_id' as row_data
        from public.games g
        except all
        select to_jsonb(b) as row_data
        from iqbackup_pre_v3_20260901.games b
    ) x;

    if issue_count <> 0 then
        raise exception 'Legacy game data changed unexpectedly: % differing rows', issue_count;
    end if;

    -- Existing user-profile content must match the safety snapshot when the new
    -- global_role column is ignored.
    select count(*)
    into issue_count
    from (
        select to_jsonb(up) - 'global_role' as row_data
        from public.user_profiles up
        except all
        select to_jsonb(b) as row_data
        from iqbackup_pre_v3_20260901.user_profiles b
    ) x;

    if issue_count <> 0 then
        raise exception 'Legacy user_profile data changed unexpectedly: % differing rows', issue_count;
    end if;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- 12. POST-COMMIT REPORT
-- -----------------------------------------------------------------------------

select 'global_seasons' as check_name, count(*) as actual, 1 as expected
from public.season_catalog
where code = '2025-2026'

union all
select 'team_seasons', count(*), 2
from public.team_seasons ts
join public.season_catalog sc on sc.id = ts.season_id
where sc.code = '2025-2026'

union all
select 'games_bridged', count(*), (select count(*) from public.games)
from public.games
where team_season_id is not null

union all
select 'roster_memberships', count(*), (select count(*) from public.players)
from public.roster_memberships

union all
select 'global_superadmins', count(*), 1
from public.user_profiles
where upper(coalesce(global_role, '')) = 'SUPERADMIN'

order by check_name;

-- IMPORTANT: RLS remains unchanged in Phase 1.
