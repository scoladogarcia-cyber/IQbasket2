-- IQBasket v3 FULL REHEARSAL
-- =============================================================================
-- SAFE REHEARSAL: THIS SCRIPT ENDS IN ROLLBACK.
--
-- It creates the proposed v3 structures, maps the currently audited data,
-- installs the draft access workflow and draft RLS policies, runs validations,
-- and then rolls EVERYTHING back.
--
-- Running this file in Supabase SQL Editor must leave the database unchanged.
-- Do not replace the final ROLLBACK with COMMIT.
-- =============================================================================

begin;

-- Capture baseline counts inside the transaction before any rehearsal change.
create temporary table iq_v3_rehearsal_baseline (
    metric text primary key,
    value bigint not null
) on commit drop;

insert into iq_v3_rehearsal_baseline(metric, value)
values
    ('clubs', (select count(*) from public.clubs)),
    ('teams', (select count(*) from public.teams)),
    ('seasons', (select count(*) from public.seasons)),
    ('players', (select count(*) from public.players)),
    ('games', (select count(*) from public.games)),
    ('player_game_stats', (select count(*) from public.player_game_stats)),
    ('team_game_stats', (select count(*) from public.team_game_stats)),
    ('game_events', (select count(*) from public.game_events)),
    ('game_period_scores', (select count(*) from public.game_period_scores)),
    ('translations', (select count(*) from public.translations)),
    ('user_profiles', (select count(*) from public.user_profiles));

-- =============================================================================
-- A. ADDITIVE V3 STRUCTURE
-- =============================================================================

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
    updated_at timestamptz not null default now(),
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
    updated_at timestamptz not null default now(),
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
    updated_at timestamptz not null default now(),
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
    updated_at timestamptz not null default now(),
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
    created_by uuid references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
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
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
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
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
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

-- 11) Additive bridge columns on existing tables ------------------------------
-- Nullable columns only: existing rows remain untouched until explicit backfill.
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

-- Requests become explicitly scoped to a team-season. The existing team_id
-- remains during transition for compatibility and auditability.
alter table public.team_join_requests
    add column if not exists team_season_id uuid
    references public.team_seasons(id) on delete restrict;

create index if not exists idx_team_join_requests_team_season_id
    on public.team_join_requests(team_season_id);

create unique index if not exists uq_team_join_requests_pending_scope
    on public.team_join_requests(user_id, team_season_id)
    where team_season_id is not null
      and lower(coalesce(status, 'pending')) in ('pending', 'pendiente');

-- Separate global security role from contextual sporting functions.
-- No value is backfilled automatically in this structure draft.
alter table public.user_profiles
    add column if not exists global_role text;

-- Database-level protection for the unique master identity.
create unique index if not exists uq_user_profiles_single_global_superadmin
    on public.user_profiles ((upper(global_role)))
    where upper(coalesce(global_role, '')) = 'SUPERADMIN';

do $
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
end $;

-- IMPORTANT:
-- No legacy data is backfilled in this draft.
-- No existing table/column is changed.
-- RLS is intentionally NOT enabled here yet; policies must be designed and
-- tested after the membership backfill is validated, otherwise existing access
-- could be accidentally blocked.

-- =============================================================================
-- B. CURRENT-DATA BACKFILL
-- =============================================================================

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

-- =============================================================================
-- C. ATOMIC ACCESS WORKFLOW
-- =============================================================================

-- Helper: can the authenticated user manage a team-season?
create or replace function public.iq_v3_can_manage_team_season(
    target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
    with caller as (
        select
            up.id,
            upper(coalesce(up.global_role, up.role, 'USER')) as global_role
        from public.user_profiles up
        where up.id = auth.uid()
    ),
    target as (
        select
            ts.id,
            ts.team_id,
            ts.season_id,
            t.club_id
        from public.team_seasons ts
        join public.teams t on t.id = ts.team_id
        where ts.id = target_team_season_id
    )
    select exists (
        select 1
        from caller c
        where c.global_role = 'SUPERADMIN'
           or (
               c.global_role = 'ADMIN'
               and (
                   exists (
                       select 1
                       from public.team_season_memberships m
                       where m.user_id = c.id
                         and m.team_season_id = target_team_season_id
                         and upper(m.status) = 'ACTIVE'
                         and upper(m.function_role) in ('ADMIN', 'COORDINADOR', 'DIRECTOR_DEPORTIVO')
                   )
                   or exists (
                       select 1
                       from target x
                       join public.club_season_memberships cm
                         on cm.club_id = x.club_id
                        and cm.season_id = x.season_id
                       where cm.user_id = c.id
                         and upper(cm.status) = 'ACTIVE'
                         and upper(cm.function_role) in ('ADMIN', 'COORDINADOR', 'DIRECTOR_DEPORTIVO')
                   )
               )
           )
    );
$$;

revoke all on function public.iq_v3_can_manage_team_season(uuid) from public;
grant execute on function public.iq_v3_can_manage_team_season(uuid) to authenticated;

-- Request access to one team-season.
create or replace function public.iq_v3_request_team_access(
    target_team_season_id uuid,
    requested_function_role text default 'VISOR'
)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    caller_id uuid := auth.uid();
    target_team_id uuid;
    normalized_role text := upper(trim(coalesce(requested_function_role, 'VISOR')));
    existing_request public.team_join_requests;
    created_request public.team_join_requests;
begin
    if caller_id is null then
        raise exception 'AUTH_REQUIRED';
    end if;

    if normalized_role not in (
        'ENTRENADOR',
        'AYUDANTE',
        'ANALISTA',
        'PREPARADOR_FISICO',
        'JUGADOR',
        'FAMILIA_TUTOR',
        'VISOR'
    ) then
        raise exception 'INVALID_REQUESTED_ROLE';
    end if;

    select ts.team_id
      into target_team_id
      from public.team_seasons ts
     where ts.id = target_team_season_id
       and upper(ts.status) = 'ACTIVE';

    if target_team_id is null then
        raise exception 'TEAM_SEASON_NOT_FOUND';
    end if;

    select r.*
      into existing_request
      from public.team_join_requests r
     where r.user_id = caller_id
       and r.team_season_id = target_team_season_id
       and lower(coalesce(r.status, 'pending')) in ('pending', 'pendiente')
     order by r.created_at desc
     limit 1;

    if existing_request.id is not null then
        return existing_request;
    end if;

    insert into public.team_join_requests (
        user_id,
        team_id,
        team_season_id,
        requested_role,
        status
    )
    values (
        caller_id,
        target_team_id,
        target_team_season_id,
        normalized_role,
        'pending'
    )
    returning * into created_request;

    return created_request;
end;
$$;

revoke all on function public.iq_v3_request_team_access(uuid, text) from public;
grant execute on function public.iq_v3_request_team_access(uuid, text) to authenticated;

-- Review a request atomically.
-- Approval:
--   1) locks request;
--   2) validates caller scope;
--   3) creates contextual membership;
--   4) updates legacy assigned_team_ids for temporary app compatibility;
--   5) marks request approved;
-- all in a single database transaction.
create or replace function public.iq_v3_review_team_access(
    request_id uuid,
    approve_request boolean
)
returns public.team_join_requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    req public.team_join_requests;
    target_team_id uuid;
    normalized_role text;
    updated_request public.team_join_requests;
begin
    if auth.uid() is null then
        raise exception 'AUTH_REQUIRED';
    end if;

    select r.*
      into req
      from public.team_join_requests r
     where r.id = request_id
     for update;

    if req.id is null then
        raise exception 'REQUEST_NOT_FOUND';
    end if;

    if req.team_season_id is null then
        raise exception 'REQUEST_HAS_NO_TEAM_SEASON_SCOPE';
    end if;

    if lower(coalesce(req.status, 'pending')) not in ('pending', 'pendiente') then
        raise exception 'REQUEST_ALREADY_REVIEWED';
    end if;

    if not public.iq_v3_can_manage_team_season(req.team_season_id) then
        raise exception 'FORBIDDEN';
    end if;

    if not approve_request then
        update public.team_join_requests
           set status = 'rejected'
         where id = req.id
         returning * into updated_request;

        return updated_request;
    end if;

    normalized_role := upper(trim(coalesce(req.requested_role, 'VISOR')));

    if normalized_role not in (
        'ENTRENADOR',
        'AYUDANTE',
        'ANALISTA',
        'PREPARADOR_FISICO',
        'JUGADOR',
        'FAMILIA_TUTOR',
        'VISOR'
    ) then
        raise exception 'INVALID_REQUESTED_ROLE';
    end if;

    select ts.team_id
      into target_team_id
      from public.team_seasons ts
     where ts.id = req.team_season_id
       and upper(ts.status) = 'ACTIVE';

    if target_team_id is null then
        raise exception 'TEAM_SEASON_NOT_FOUND';
    end if;

    insert into public.team_season_memberships (
        user_id,
        team_season_id,
        function_role,
        status,
        valid_from
    )
    values (
        req.user_id,
        req.team_season_id,
        normalized_role,
        'ACTIVE',
        now()
    )
    on conflict (user_id, team_season_id, function_role)
    do update
       set status = 'ACTIVE',
           valid_from = coalesce(public.team_season_memberships.valid_from, now()),
           valid_until = null,
           updated_at = now();

    -- Temporary compatibility with the current application while reads migrate
    -- from assigned_team_ids to normalized memberships.
    update public.user_profiles up
       set assigned_team_ids = (
           select array(
               select distinct x
               from unnest(
                   coalesce(up.assigned_team_ids, '{}'::uuid[])
                   || array[target_team_id]::uuid[]
               ) as x
           )
       )
     where up.id = req.user_id;

    update public.team_join_requests
       set status = 'approved'
     where id = req.id
     returning * into updated_request;

    return updated_request;
end;
$$;

revoke all on function public.iq_v3_review_team_access(uuid, boolean) from public;
grant execute on function public.iq_v3_review_team_access(uuid, boolean) to authenticated;

-- =============================================================================
-- D. RLS V3
-- =============================================================================

-- ============================================================================
-- 1. AUTHORIZATION HELPERS
-- ============================================================================

create or replace function public.iq_v3_is_superadmin()
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
          and lower(up.email) = 'scolado@nechigroup.com'
          and upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
    );
$$;

create or replace function public.iq_v3_global_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when public.iq_v3_is_superadmin() then 'SUPERADMIN'
        else upper(coalesce(up.global_role, 'USER'))
    end
    from public.user_profiles up
    where up.id = auth.uid();
$$;

create or replace function public.iq_v3_has_team_season_access(
    target_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = target_team_season_id
              and upper(m.status) = 'ACTIVE'
        )
        or exists (
            select 1
            from public.team_seasons ts
            join public.teams t on t.id = ts.team_id
            join public.club_season_memberships cm
              on cm.club_id = t.club_id
             and cm.season_id = ts.season_id
            where ts.id = target_team_season_id
              and cm.user_id = auth.uid()
              and upper(cm.status) = 'ACTIVE'
        );
$$;

create or replace function public.iq_v3_has_team_season_role(
    target_team_season_id uuid,
    allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = target_team_season_id
              and upper(m.status) = 'ACTIVE'
              and upper(m.function_role) = any (
                    select upper(x)
                    from unnest(allowed_roles) as x
              )
        )
        or exists (
            select 1
            from public.team_seasons ts
            join public.teams t on t.id = ts.team_id
            join public.club_season_memberships cm
              on cm.club_id = t.club_id
             and cm.season_id = ts.season_id
            where ts.id = target_team_season_id
              and cm.user_id = auth.uid()
              and upper(cm.status) = 'ACTIVE'
              and upper(cm.function_role) = any (
                    select upper(x)
                    from unnest(allowed_roles) as x
              )
        );
$$;

create or replace function public.iq_v3_can_manage_club(
    target_club_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.club_season_memberships cm
            where cm.user_id = auth.uid()
              and cm.club_id = target_club_id
              and upper(cm.status) = 'ACTIVE'
              and upper(cm.function_role) in (
                  'ADMIN',
                  'COORDINADOR',
                  'DIRECTOR_DEPORTIVO'
              )
        );
$$;

create or replace function public.iq_v3_can_manage_team(
    target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.teams t
            where t.id = target_team_id
              and public.iq_v3_can_manage_club(t.club_id)
        )
        or exists (
            select 1
            from public.team_seasons ts
            where ts.team_id = target_team_id
              and public.iq_v3_has_team_season_role(
                    ts.id,
                    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
              )
        );
$$;

create or replace function public.iq_v3_can_read_game(
    target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where g.id = target_game_id
          and g.team_season_id is not null
          and public.iq_v3_has_team_season_access(g.team_season_id)
    );
$$;

create or replace function public.iq_v3_can_edit_game(
    target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where g.id = target_game_id
          and g.team_season_id is not null
          and public.iq_v3_has_team_season_role(
              g.team_season_id,
              array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
          )
    );
$$;

create or replace function public.iq_v3_can_delete_game(
    target_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.games g
        where g.id = target_game_id
          and g.team_season_id is not null
          and public.iq_v3_has_team_season_role(
              g.team_season_id,
              array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
          )
    );
$$;

create or replace function public.iq_v3_can_read_player(
    target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.user_player_links upl
            where upl.user_id = auth.uid()
              and upl.player_id = target_player_id
              and upper(upl.status) = 'ACTIVE'
        )
        or exists (
            select 1
            from public.roster_memberships rm
            where rm.player_id = target_player_id
              and public.iq_v3_has_team_season_access(rm.team_season_id)
        );
$$;

create or replace function public.iq_v3_can_manage_player(
    target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.roster_memberships rm
            where rm.player_id = target_player_id
              and public.iq_v3_has_team_season_role(
                  rm.team_season_id,
                  array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
              )
        );
$$;

create or replace function public.iq_v3_can_read_private_player_data(
    target_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.user_player_links upl
            where upl.user_id = auth.uid()
              and upl.player_id = target_player_id
              and upper(upl.status) = 'ACTIVE'
              and upper(upl.relation_type) = 'SELF'
        )
        or exists (
            select 1
            from public.roster_memberships rm
            where rm.player_id = target_player_id
              and public.iq_v3_has_team_season_role(
                  rm.team_season_id,
                  array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
              )
        );
$$;

create or replace function public.iq_v3_can_view_user_profile(
    target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        target_user_id = auth.uid()
        or public.iq_v3_is_superadmin()
        or exists (
            select 1
            from public.team_season_memberships manager
            join public.team_season_memberships target
              on target.team_season_id = manager.team_season_id
            where manager.user_id = auth.uid()
              and target.user_id = target_user_id
              and upper(manager.status) = 'ACTIVE'
              and upper(target.status) = 'ACTIVE'
              and upper(manager.function_role) in (
                  'ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'
              )
        );
$$;

revoke all on function public.iq_v3_is_superadmin() from public;
revoke all on function public.iq_v3_global_role() from public;
revoke all on function public.iq_v3_has_team_season_access(uuid) from public;
revoke all on function public.iq_v3_has_team_season_role(uuid,text[]) from public;
revoke all on function public.iq_v3_can_manage_club(uuid) from public;
revoke all on function public.iq_v3_can_manage_team(uuid) from public;
revoke all on function public.iq_v3_can_read_game(uuid) from public;
revoke all on function public.iq_v3_can_edit_game(uuid) from public;
revoke all on function public.iq_v3_can_delete_game(uuid) from public;
revoke all on function public.iq_v3_can_read_player(uuid) from public;
revoke all on function public.iq_v3_can_manage_player(uuid) from public;
revoke all on function public.iq_v3_can_read_private_player_data(uuid) from public;
revoke all on function public.iq_v3_can_view_user_profile(uuid) from public;

grant execute on function public.iq_v3_is_superadmin() to authenticated;
grant execute on function public.iq_v3_global_role() to authenticated;
grant execute on function public.iq_v3_has_team_season_access(uuid) to authenticated;
grant execute on function public.iq_v3_has_team_season_role(uuid,text[]) to authenticated;
grant execute on function public.iq_v3_can_manage_club(uuid) to authenticated;
grant execute on function public.iq_v3_can_manage_team(uuid) to authenticated;
grant execute on function public.iq_v3_can_read_game(uuid) to authenticated;
grant execute on function public.iq_v3_can_edit_game(uuid) to authenticated;
grant execute on function public.iq_v3_can_delete_game(uuid) to authenticated;
grant execute on function public.iq_v3_can_read_player(uuid) to authenticated;
grant execute on function public.iq_v3_can_manage_player(uuid) to authenticated;
grant execute on function public.iq_v3_can_read_private_player_data(uuid) to authenticated;
grant execute on function public.iq_v3_can_view_user_profile(uuid) to authenticated;

-- ============================================================================
-- 2. REMOVE KNOWN PERMISSIVE LEGACY POLICIES INSIDE THIS REHEARSAL TRANSACTION
-- ============================================================================

drop policy if exists "Permitir actualizacion solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir borrado solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir insercion solo a roles autorizados" on public.game_events;
drop policy if exists "Permitir lectura a usuarios autenticados" on public.game_events;
drop policy if exists "Permitir todo a usuarios autenticados y anon en game_events" on public.game_events;
drop policy if exists "Permitir todo en game_events" on public.game_events;
drop policy if exists "Permitir todo a usuarios autenticados y anon en game_period_sco" on public.game_period_scores;
drop policy if exists "Permitir todo a usuarios autenticados y anon en games" on public.games;
drop policy if exists "Permitir todo a usuarios autenticados y anon en player_game_sta" on public.player_game_stats;
drop policy if exists "Permitir update publico player_game_stats" on public.player_game_stats;
drop policy if exists "Permitir update publico players" on public.players;
drop policy if exists "Escritura de traducciones" on public.translations;
drop policy if exists "Lectura pública de traducciones" on public.translations;

-- ============================================================================
-- 3. ENABLE RLS
-- ============================================================================

alter table public.clubs enable row level security;
alter table public.teams enable row level security;
alter table public.season_catalog enable row level security;
alter table public.team_seasons enable row level security;
alter table public.user_profiles enable row level security;
alter table public.roster_memberships enable row level security;
alter table public.team_season_memberships enable row level security;
alter table public.club_season_memberships enable row level security;
alter table public.user_player_links enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.player_game_stats enable row level security;
alter table public.team_game_stats enable row level security;
alter table public.game_events enable row level security;
alter table public.game_period_scores enable row level security;
alter table public.lineup_game_stats enable row level security;
alter table public.play_by_play_events enable row level security;
alter table public.player_goals enable row level security;
alter table public.player_notes enable row level security;
alter table public.reports enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.analytics_runs enable row level security;
alter table public.player_season_metrics enable row level security;
alter table public.team_season_metrics enable row level security;
alter table public.lineup_season_metrics enable row level security;
alter table public.translations enable row level security;

-- Legacy/transition tables are locked down as well.
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.team_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.invitations enable row level security;

-- ============================================================================
-- 4. DIRECTORY / CATALOG POLICIES
-- ============================================================================

create policy "v3 clubs authenticated read"
on public.clubs for select
to authenticated
using (true);

create policy "v3 clubs managed update"
on public.clubs for update
to authenticated
using (public.iq_v3_can_manage_club(id))
with check (public.iq_v3_can_manage_club(id));

create policy "v3 clubs superadmin insert"
on public.clubs for insert
to authenticated
with check (public.iq_v3_is_superadmin());

create policy "v3 clubs superadmin delete"
on public.clubs for delete
to authenticated
using (public.iq_v3_is_superadmin());

create policy "v3 teams authenticated read"
on public.teams for select
to authenticated
using (true);

create policy "v3 teams managed insert"
on public.teams for insert
to authenticated
with check (
    public.iq_v3_is_superadmin()
    or public.iq_v3_can_manage_club(club_id)
);

create policy "v3 teams managed update"
on public.teams for update
to authenticated
using (public.iq_v3_can_manage_team(id))
with check (public.iq_v3_can_manage_club(club_id));

create policy "v3 teams managed delete"
on public.teams for delete
to authenticated
using (
    public.iq_v3_is_superadmin()
    or public.iq_v3_can_manage_team(id)
);

create policy "v3 season catalog authenticated read"
on public.season_catalog for select
to authenticated
using (true);

create policy "v3 season catalog superadmin write"
on public.season_catalog for all
to authenticated
using (public.iq_v3_is_superadmin())
with check (public.iq_v3_is_superadmin());

create policy "v3 team seasons authenticated read"
on public.team_seasons for select
to authenticated
using (true);

create policy "v3 team seasons managed insert"
on public.team_seasons for insert
to authenticated
with check (public.iq_v3_can_manage_team(team_id));

create policy "v3 team seasons managed update"
on public.team_seasons for update
to authenticated
using (public.iq_v3_can_manage_team(team_id))
with check (public.iq_v3_can_manage_team(team_id));

create policy "v3 team seasons managed delete"
on public.team_seasons for delete
to authenticated
using (public.iq_v3_can_manage_team(team_id));

-- ============================================================================
-- 5. USER / MEMBERSHIP POLICIES
-- ============================================================================

create policy "v3 user profiles scoped read"
on public.user_profiles for select
to authenticated
using (public.iq_v3_can_view_user_profile(id));

-- Security-sensitive user_profiles writes are intentionally NOT granted here.
-- Own-profile edits and role/access changes must go through dedicated RPC/Edge
-- functions with column-level validation.

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

create policy "v3 club memberships own or superadmin read"
on public.club_season_memberships for select
to authenticated
using (
    user_id = auth.uid()
    or public.iq_v3_is_superadmin()
);

create policy "v3 user player links own or manager read"
on public.user_player_links for select
to authenticated
using (
    user_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
);

-- Membership and user-player-link writes are intentionally RPC-only.

-- ============================================================================
-- 6. ROSTER / PLAYER POLICIES
-- ============================================================================

create policy "v3 roster scoped read"
on public.roster_memberships for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 roster managed insert"
on public.roster_memberships for insert
to authenticated
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
    )
);

create policy "v3 roster managed update"
on public.roster_memberships for update
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR']::text[]
    )
);

create policy "v3 roster managed delete"
on public.roster_memberships for delete
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
    )
);

create policy "v3 players scoped read"
on public.players for select
to authenticated
using (public.iq_v3_can_read_player(id));

create policy "v3 players managed insert"
on public.players for insert
to authenticated
with check (public.iq_v3_is_superadmin());

create policy "v3 players managed update"
on public.players for update
to authenticated
using (public.iq_v3_can_manage_player(id))
with check (public.iq_v3_can_manage_player(id));

create policy "v3 players superadmin delete"
on public.players for delete
to authenticated
using (public.iq_v3_is_superadmin());

-- ============================================================================
-- 7. GAME / STATS / EVENTS POLICIES
-- ============================================================================

create policy "v3 games scoped read"
on public.games for select
to authenticated
using (
    team_season_id is not null
    and public.iq_v3_has_team_season_access(team_season_id)
);

create policy "v3 games scoped insert"
on public.games for insert
to authenticated
with check (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
    )
);

create policy "v3 games scoped update"
on public.games for update
to authenticated
using (public.iq_v3_can_edit_game(id))
with check (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA']::text[]
    )
);

create policy "v3 games restricted delete"
on public.games for delete
to authenticated
using (public.iq_v3_can_delete_game(id));

-- Game child tables: same scope as the parent game.
create policy "v3 player game stats read"
on public.player_game_stats for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 player game stats insert"
on public.player_game_stats for insert
to authenticated
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 player game stats update"
on public.player_game_stats for update
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 player game stats delete"
on public.player_game_stats for delete
to authenticated
using (public.iq_v3_can_edit_game(game_id));

create policy "v3 team game stats read"
on public.team_game_stats for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 team game stats insert"
on public.team_game_stats for insert
to authenticated
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 team game stats update"
on public.team_game_stats for update
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 team game stats delete"
on public.team_game_stats for delete
to authenticated
using (public.iq_v3_can_edit_game(game_id));

create policy "v3 game events read"
on public.game_events for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 game events insert"
on public.game_events for insert
to authenticated
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 game events update"
on public.game_events for update
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 game events delete"
on public.game_events for delete
to authenticated
using (public.iq_v3_can_edit_game(game_id));

create policy "v3 period scores read"
on public.game_period_scores for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 period scores write"
on public.game_period_scores for all
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 lineup stats read"
on public.lineup_game_stats for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 lineup stats write"
on public.lineup_game_stats for all
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

create policy "v3 play by play read"
on public.play_by_play_events for select
to authenticated
using (public.iq_v3_can_read_game(game_id));

create policy "v3 play by play write"
on public.play_by_play_events for all
to authenticated
using (public.iq_v3_can_edit_game(game_id))
with check (public.iq_v3_can_edit_game(game_id));

-- ============================================================================
-- 8. PLAYER NOTES / GOALS / REPORTS
-- ============================================================================

create policy "v3 player goals scoped read"
on public.player_goals for select
to authenticated
using (public.iq_v3_can_read_player(player_id));

create policy "v3 player goals managed write"
on public.player_goals for all
to authenticated
using (public.iq_v3_can_manage_player(player_id))
with check (public.iq_v3_can_manage_player(player_id));

create policy "v3 player notes scoped read"
on public.player_notes for select
to authenticated
using (
    public.iq_v3_can_read_player(player_id)
    and (
        not is_private
        or author_id = auth.uid()
        or public.iq_v3_can_read_private_player_data(player_id)
    )
);

create policy "v3 player notes staff insert"
on public.player_notes for insert
to authenticated
with check (
    author_id = auth.uid()
    and public.iq_v3_can_read_private_player_data(player_id)
);

create policy "v3 player notes author update"
on public.player_notes for update
to authenticated
using (
    author_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
)
with check (
    author_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
);

create policy "v3 player notes author delete"
on public.player_notes for delete
to authenticated
using (
    author_id = auth.uid()
    or public.iq_v3_can_manage_player(player_id)
);

create policy "v3 reports scoped read"
on public.reports for select
to authenticated
using (
    (team_season_id is not null and public.iq_v3_has_team_season_access(team_season_id))
    or (game_id is not null and public.iq_v3_can_read_game(game_id))
    or (player_id is not null and public.iq_v3_can_read_player(player_id))
);

create policy "v3 reports staff write"
on public.reports for all
to authenticated
using (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
)
with check (
    team_season_id is not null
    and public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
);

-- ============================================================================
-- 9. ANALYTICS POLICIES
-- ============================================================================

create policy "v3 analytics runs scoped read"
on public.analytics_runs for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 analytics runs staff write"
on public.analytics_runs for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
);

create policy "v3 player season metrics read"
on public.player_season_metrics for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 player season metrics staff write"
on public.player_season_metrics for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']::text[]
    )
);

create policy "v3 team season metrics read"
on public.team_season_metrics for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 team season metrics staff write"
on public.team_season_metrics for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
);

create policy "v3 lineup season metrics read"
on public.lineup_season_metrics for select
to authenticated
using (public.iq_v3_has_team_season_access(team_season_id));

create policy "v3 lineup season metrics staff write"
on public.lineup_season_metrics for all
to authenticated
using (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
)
with check (
    public.iq_v3_has_team_season_role(
        team_season_id,
        array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','ANALISTA']::text[]
    )
);

-- ============================================================================
-- 10. ACCESS REQUESTS
-- ============================================================================

create policy "v3 team requests own read"
on public.team_join_requests for select
to authenticated
using (
    user_id = auth.uid()
    or (
        team_season_id is not null
        and public.iq_v3_has_team_season_role(
            team_season_id,
            array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO']::text[]
        )
    )
);

create policy "v3 team requests own insert"
on public.team_join_requests for insert
to authenticated
with check (
    user_id = auth.uid()
    and team_season_id is not null
);

-- UPDATE/DELETE intentionally omitted: request review is RPC-only.

-- ============================================================================
-- 11. TRANSLATIONS
-- ============================================================================

create policy "v3 translations public read"
on public.translations for select
to anon, authenticated
using (true);

create policy "v3 translations superadmin insert"
on public.translations for insert
to authenticated
with check (public.iq_v3_is_superadmin());

create policy "v3 translations superadmin update"
on public.translations for update
to authenticated
using (public.iq_v3_is_superadmin())
with check (public.iq_v3_is_superadmin());

create policy "v3 translations superadmin delete"
on public.translations for delete
to authenticated
using (public.iq_v3_is_superadmin());

-- ============================================================================
-- 12. LEGACY TABLE TRANSITION POLICIES
-- ============================================================================

create policy "v3 legacy seasons scoped read"
on public.seasons for select
to authenticated
using (
    public.iq_v3_is_superadmin()
    or exists (
        select 1
        from public.team_seasons ts
        where ts.legacy_season_id = seasons.id
          and public.iq_v3_has_team_season_access(ts.id)
    )
);

create policy "v3 legacy team members own read"
on public.team_members for select
to authenticated
using (
    public.iq_v3_is_superadmin()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- profiles/join_requests/invitations intentionally receive NO access policies.
-- With RLS enabled they become inaccessible to client roles and can be retired
-- only after final migration validation.

-- ============================================================================
-- 13. GRANTS
-- ============================================================================

-- Remove anonymous writes from operational data.
revoke insert, update, delete on
    public.clubs,
    public.teams,
    public.games,
    public.players,
    public.player_game_stats,
    public.team_game_stats,
    public.game_events,
    public.game_period_scores,
    public.lineup_game_stats,
    public.play_by_play_events,
    public.player_goals,
    public.player_notes,
    public.reports,
    public.team_join_requests,
    public.translations
from anon;

-- Runtime authenticated access is still row-filtered by RLS.
grant select on
    public.clubs,
    public.teams,
    public.season_catalog,
    public.team_seasons,
    public.user_profiles,
    public.roster_memberships,
    public.team_season_memberships,
    public.club_season_memberships,
    public.user_player_links,
    public.games,
    public.players,
    public.player_game_stats,
    public.team_game_stats,
    public.game_events,
    public.game_period_scores,
    public.lineup_game_stats,
    public.play_by_play_events,
    public.player_goals,
    public.player_notes,
    public.reports,
    public.team_join_requests,
    public.analytics_runs,
    public.player_season_metrics,
    public.team_season_metrics,
    public.lineup_season_metrics,
    public.translations,
    public.seasons,
    public.team_members
to authenticated;

grant insert, update, delete on
    public.clubs,
    public.teams,
    public.season_catalog,
    public.team_seasons,
    public.roster_memberships,
    public.games,
    public.players,
    public.player_game_stats,
    public.team_game_stats,
    public.game_events,
    public.game_period_scores,
    public.lineup_game_stats,
    public.play_by_play_events,
    public.player_goals,
    public.player_notes,
    public.reports,
    public.team_join_requests,
    public.analytics_runs,
    public.player_season_metrics,
    public.team_season_metrics,
    public.lineup_season_metrics,
    public.translations
to authenticated;

grant select on public.translations to anon;

-- Security-sensitive tables remain read-only to authenticated clients.
revoke insert, update, delete on
    public.user_profiles,
    public.team_season_memberships,
    public.club_season_memberships,
    public.user_player_links
from authenticated;

-- ============================================================================
-- 14. POLICY INVENTORY FOR REVIEW
-- ============================================================================

select
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ============================================================================
-- 15. EXPLICIT ROLLBACK
-- ============================================================================

-- =============================================================================
-- E. FINAL REHEARSAL VALIDATION
-- =============================================================================

-- Source tables must keep the same row counts.
with current_counts(metric, value) as (
    values
        ('clubs', (select count(*)::bigint from public.clubs)),
        ('teams', (select count(*)::bigint from public.teams)),
        ('seasons', (select count(*)::bigint from public.seasons)),
        ('players', (select count(*)::bigint from public.players)),
        ('games', (select count(*)::bigint from public.games)),
        ('player_game_stats', (select count(*)::bigint from public.player_game_stats)),
        ('team_game_stats', (select count(*)::bigint from public.team_game_stats)),
        ('game_events', (select count(*)::bigint from public.game_events)),
        ('game_period_scores', (select count(*)::bigint from public.game_period_scores)),
        ('translations', (select count(*)::bigint from public.translations)),
        ('user_profiles', (select count(*)::bigint from public.user_profiles))
)
select
    b.metric,
    b.value as before_rows,
    c.value as during_rehearsal_rows,
    case when b.value = c.value then 'OK' else 'ERROR' end as result
from iq_v3_rehearsal_baseline b
join current_counts c using(metric)
order by b.metric;

-- Every current game must keep its existing ID/team/legacy season and gain only
-- an additive team_season bridge during the rehearsal.
select
    count(*) as games_total,
    count(team_season_id) as games_with_v3_scope,
    case
        when count(*) = count(team_season_id) then 'OK'
        else 'REVIEW'
    end as v3_scope_result
from public.games;

-- No new orphan relationships may appear.
select 'player_game_stats_without_game' as check_name, count(*) as issues
from public.player_game_stats s
left join public.games g on g.id = s.game_id
where g.id is null
union all
select 'player_game_stats_without_player', count(*)
from public.player_game_stats s
left join public.players p on p.id = s.player_id
where p.id is null
union all
select 'game_events_without_game', count(*)
from public.game_events e
left join public.games g on g.id = e.game_id
where g.id is null
union all
select 'period_scores_without_game', count(*)
from public.game_period_scores ps
left join public.games g on g.id = ps.game_id
where g.id is null;

-- Unique global master check.
select
    count(*) as global_superadmins,
    bool_and(lower(email) = 'scolado@nechigroup.com') as only_expected_email
from public.user_profiles
where upper(coalesce(global_role, '')) = 'SUPERADMIN';

-- V3 object counts.
select 'season_catalog' as object_name, count(*) as rows from public.season_catalog
union all select 'team_seasons', count(*) from public.team_seasons
union all select 'roster_memberships', count(*) from public.roster_memberships
union all select 'team_season_memberships', count(*) from public.team_season_memberships
union all select 'club_season_memberships', count(*) from public.club_season_memberships
union all select 'user_player_links', count(*) from public.user_player_links
union all select 'player_season_metrics', count(*) from public.player_season_metrics
union all select 'team_season_metrics', count(*) from public.team_season_metrics
union all select 'lineup_season_metrics', count(*) from public.lineup_season_metrics
order by object_name;

-- Confirm RLS is enabled inside the rehearsal.
select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
      'user_profiles',
      'team_seasons',
      'roster_memberships',
      'team_season_memberships',
      'games',
      'players',
      'player_game_stats',
      'game_events',
      'translations'
  )
order by c.relname;

-- Confirm no known public ALL policy survives in the rehearsal.
select
    tablename,
    policyname,
    roles,
    cmd
from pg_policies
where schemaname = 'public'
  and (
      policyname ilike '%Permitir todo%'
      or (
          roles::text like '%public%'
          and cmd = 'ALL'
      )
  )
order by tablename, policyname;

-- =============================================================================
-- F. NOTHING PERSISTS
-- =============================================================================

rollback;

-- Expected after execution:
--   * all validation queries return expected/OK results;
--   * Supabase shows "Success";
--   * a new query after this script will NOT find season_catalog/team_seasons,
--     because the final ROLLBACK removed the rehearsal transaction.
