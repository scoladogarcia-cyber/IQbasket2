-- IQBasket pre-v3 INTERNAL SAFETY SNAPSHOT
-- =============================================================================
-- READY FOR ONE-TIME EXECUTION AFTER THE EXTERNAL ENCRYPTED BACKUP EXISTS.
--
-- This script:
--   * DOES NOT delete, update or alter any current public table;
--   * copies the current public IQBasket data into a separate PostgreSQL schema;
--   * verifies the critical row counts before COMMIT;
--   * aborts and rolls back automatically if any expected count is different.
--
-- Keep this snapshot until v3 is fully validated.
-- =============================================================================

begin;

-- Fail instead of overwriting an earlier safety snapshot.
do $$
begin
    if exists (
        select 1
        from information_schema.schemata
        where schema_name = 'iqbackup_pre_v3_20260901'
    ) then
        raise exception 'Safety snapshot iqbackup_pre_v3_20260901 already exists. Nothing was changed.';
    end if;
end $$;

create schema iqbackup_pre_v3_20260901;

create table iqbackup_pre_v3_20260901.clubs as table public.clubs;
create table iqbackup_pre_v3_20260901.teams as table public.teams;
create table iqbackup_pre_v3_20260901.seasons as table public.seasons;
create table iqbackup_pre_v3_20260901.players as table public.players;
create table iqbackup_pre_v3_20260901.games as table public.games;

create table iqbackup_pre_v3_20260901.user_profiles as table public.user_profiles;
create table iqbackup_pre_v3_20260901.profiles as table public.profiles;
create table iqbackup_pre_v3_20260901.team_members as table public.team_members;
create table iqbackup_pre_v3_20260901.team_join_requests as table public.team_join_requests;
create table iqbackup_pre_v3_20260901.join_requests as table public.join_requests;
create table iqbackup_pre_v3_20260901.invitations as table public.invitations;

create table iqbackup_pre_v3_20260901.player_game_stats as table public.player_game_stats;
create table iqbackup_pre_v3_20260901.team_game_stats as table public.team_game_stats;
create table iqbackup_pre_v3_20260901.game_events as table public.game_events;
create table iqbackup_pre_v3_20260901.game_period_scores as table public.game_period_scores;
create table iqbackup_pre_v3_20260901.lineup_game_stats as table public.lineup_game_stats;
create table iqbackup_pre_v3_20260901.play_by_play_events as table public.play_by_play_events;
create table iqbackup_pre_v3_20260901.player_goals as table public.player_goals;
create table iqbackup_pre_v3_20260901.player_notes as table public.player_notes;
create table iqbackup_pre_v3_20260901.reports as table public.reports;

create table iqbackup_pre_v3_20260901.translations as table public.translations;

create table iqbackup_pre_v3_20260901.snapshot_meta (
    created_at timestamptz not null default now(),
    purpose text not null,
    source_games bigint not null,
    source_players bigint not null,
    source_player_game_stats bigint not null,
    source_game_events bigint not null,
    source_translations bigint not null
);

insert into iqbackup_pre_v3_20260901.snapshot_meta (
    purpose,
    source_games,
    source_players,
    source_player_game_stats,
    source_game_events,
    source_translations
)
select
    'IQBasket pre-v3 internal safety snapshot',
    (select count(*) from public.games),
    (select count(*) from public.players),
    (select count(*) from public.player_game_stats),
    (select count(*) from public.game_events),
    (select count(*) from public.translations);

-- Hard safety assertions based on the already-audited production baseline.
do $$
begin
    if (select count(*) from public.games) <> 14
       or (select count(*) from iqbackup_pre_v3_20260901.games) <> 14 then
        raise exception 'games count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.players) <> 17
       or (select count(*) from iqbackup_pre_v3_20260901.players) <> 17 then
        raise exception 'players count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.player_game_stats) <> 144
       or (select count(*) from iqbackup_pre_v3_20260901.player_game_stats) <> 144 then
        raise exception 'player_game_stats count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.team_game_stats) <> 12
       or (select count(*) from iqbackup_pre_v3_20260901.team_game_stats) <> 12 then
        raise exception 'team_game_stats count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.game_events) <> 36
       or (select count(*) from iqbackup_pre_v3_20260901.game_events) <> 36 then
        raise exception 'game_events count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.game_period_scores) <> 56
       or (select count(*) from iqbackup_pre_v3_20260901.game_period_scores) <> 56 then
        raise exception 'game_period_scores count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.translations) <> 2372
       or (select count(*) from iqbackup_pre_v3_20260901.translations) <> 2372 then
        raise exception 'translations count mismatch; snapshot aborted';
    end if;

    if (select count(*) from public.user_profiles) <> 3
       or (select count(*) from iqbackup_pre_v3_20260901.user_profiles) <> 3 then
        raise exception 'user_profiles count mismatch; snapshot aborted';
    end if;
end $$;

commit;

-- Expected result: every public/backup pair must match.
select 'games' as table_name,
       (select count(*) from public.games) as public_rows,
       (select count(*) from iqbackup_pre_v3_20260901.games) as backup_rows
union all
select 'players',
       (select count(*) from public.players),
       (select count(*) from iqbackup_pre_v3_20260901.players)
union all
select 'player_game_stats',
       (select count(*) from public.player_game_stats),
       (select count(*) from iqbackup_pre_v3_20260901.player_game_stats)
union all
select 'team_game_stats',
       (select count(*) from public.team_game_stats),
       (select count(*) from iqbackup_pre_v3_20260901.team_game_stats)
union all
select 'game_events',
       (select count(*) from public.game_events),
       (select count(*) from iqbackup_pre_v3_20260901.game_events)
union all
select 'game_period_scores',
       (select count(*) from public.game_period_scores),
       (select count(*) from iqbackup_pre_v3_20260901.game_period_scores)
union all
select 'translations',
       (select count(*) from public.translations),
       (select count(*) from iqbackup_pre_v3_20260901.translations)
union all
select 'user_profiles',
       (select count(*) from public.user_profiles),
       (select count(*) from iqbackup_pre_v3_20260901.user_profiles)
order by table_name;
