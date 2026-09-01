-- IQBasket data model v3 (DRAFT)
-- -----------------------------------------------------------------------------
-- DO NOT EXECUTE IN PRODUCTION YET.
-- This file intentionally lives under supabase/drafts/ (not migrations/)
-- because the current database must first be backed up and the backfill plan
-- validated. The script is additive: no DROP, no DELETE, no destructive ALTER.
-- -----------------------------------------------------------------------------

begin;

create extension if not exists pgcrypto;

-- 1) Global season catalog -----------------------------------------------------
create table if not exists public.season_catalog (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    name text not null,
    start_date date,
    end_date date,
    status text not null default 'ACTIVE',
    is_test boolean not null default false,
    created_at timestamptz not null default now(),
    constraint season_catalog_code_key unique (code)
);

comment on table public.season_catalog is
'Global IQBasket seasons. A season exists once and can be linked to many teams.';

-- 2) Team participation in a global season -----------------------------------
create table if not exists public.team_seasons (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams(id) on delete restrict,
    season_id uuid not null references public.season_catalog(id) on delete restrict,
    legacy_season_id uuid references public.seasons(id) on delete set null,
    status text not null default 'ACTIVE',
    data_status text not null default 'ACTIVE',
    created_at timestamptz not null default now(),
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

-- 3) Historical roster membership --------------------------------------------
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
    constraint roster_memberships_player_team_season_key
        unique (player_id, team_season_id)
);

create index if not exists idx_roster_memberships_team_season_id
    on public.roster_memberships(team_season_id);
create index if not exists idx_roster_memberships_player_id
    on public.roster_memberships(player_id);

comment on table public.roster_memberships is
'Historical player membership. players.id remains the permanent identity used by existing statistics.';

-- 4) User access / sporting function per team-season --------------------------
create table if not exists public.team_season_memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profiles(id) on delete restrict,
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    function_role text not null,
    status text not null default 'ACTIVE',
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz not null default now(),
    constraint team_season_memberships_unique
        unique (user_id, team_season_id, function_role)
);

create index if not exists idx_team_season_memberships_user_id
    on public.team_season_memberships(user_id);
create index if not exists idx_team_season_memberships_scope
    on public.team_season_memberships(team_season_id, status);

comment on table public.team_season_memberships is
'Contextual team-season functions for authenticated users. Global security role remains separate.';

-- 5) Optional club-season functions (coordinator / sporting director, etc.) ---
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
    constraint club_season_memberships_unique
        unique (user_id, club_id, season_id, function_role)
);

create index if not exists idx_club_season_memberships_user_id
    on public.club_season_memberships(user_id);
create index if not exists idx_club_season_memberships_scope
    on public.club_season_memberships(club_id, season_id, status);

-- 6) Normalized user-player links ---------------------------------------------
create table if not exists public.user_player_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profiles(id) on delete restrict,
    player_id uuid not null references public.players(id) on delete restrict,
    relation_type text not null,
    status text not null default 'ACTIVE',
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz not null default now(),
    constraint user_player_links_unique unique (user_id, player_id, relation_type)
);

create index if not exists idx_user_player_links_user_id
    on public.user_player_links(user_id);
create index if not exists idx_user_player_links_player_id
    on public.user_player_links(player_id);

-- 7) Analytics execution trace ------------------------------------------------
create table if not exists public.analytics_runs (
    id uuid primary key default gen_random_uuid(),
    team_season_id uuid not null references public.team_seasons(id) on delete restrict,
    calculation_version text not null,
    trigger_type text not null default 'MANUAL',
    source_revision text,
    status text not null default 'COMPLETED',
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    created_by uuid references public.user_profiles(id) on delete set null
);

create index if not exists idx_analytics_runs_scope_version
    on public.analytics_runs(team_season_id, calculation_version, started_at desc);

-- 8) Persisted player-season metrics ------------------------------------------
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
    constraint player_season_metrics_unique
        unique (team_season_id, player_id, calculation_version)
);

create index if not exists idx_player_season_metrics_scope
    on public.player_season_metrics(team_season_id, player_id);
create index if not exists idx_player_season_metrics_metrics_gin
    on public.player_season_metrics using gin(metrics);

-- 9) Persisted team-season metrics --------------------------------------------
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
    constraint team_season_metrics_unique
        unique (team_season_id, calculation_version)
);

create index if not exists idx_team_season_metrics_scope
    on public.team_season_metrics(team_season_id);
create index if not exists idx_team_season_metrics_metrics_gin
    on public.team_season_metrics using gin(metrics);

-- 10) Persisted lineup-season metrics -----------------------------------------
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
    constraint lineup_season_metrics_unique
        unique (team_season_id, lineup_key, calculation_version)
);

create index if not exists idx_lineup_season_metrics_scope
    on public.lineup_season_metrics(team_season_id);
create index if not exists idx_lineup_season_metrics_players_gin
    on public.lineup_season_metrics using gin(lineup_player_ids);
create index if not exists idx_lineup_season_metrics_metrics_gin
    on public.lineup_season_metrics using gin(metrics);

-- IMPORTANT:
-- No legacy data is backfilled in this draft.
-- No existing table/column is changed.
-- RLS is intentionally NOT enabled here yet; policies must be designed and
-- tested after the membership backfill is validated, otherwise existing access
-- could be accidentally blocked.

rollback;

-- The final executable migration will replace ROLLBACK with COMMIT only after:
-- 1) backup,
-- 2) staging validation,
-- 3) approved backfill mapping,
-- 4) RLS test matrix,
-- 5) explicit production approval.
