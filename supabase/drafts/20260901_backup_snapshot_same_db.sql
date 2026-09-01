-- IQBasket same-database safety snapshot (DRAFT / ROLLBACK BY DEFAULT)
-- -----------------------------------------------------------------------------
-- PURPOSE
--   Create a point-in-time copy of the current source tables before the first
--   committed v3 migration.
--
-- IMPORTANT
--   This draft ends in ROLLBACK and therefore creates NO persistent backup yet.
--   It is kept in drafts/ intentionally. A production copy will only switch to
--   COMMIT after external backup and explicit approval.
--
-- This snapshot is NOT a substitute for an external pg_dump/Dropbox copy.
-- It is an additional fast rollback/reference layer inside PostgreSQL.
-- -----------------------------------------------------------------------------

begin;

create schema if not exists iqbackup_20260901;

-- Metadata about the snapshot.
create table if not exists iqbackup_20260901.snapshot_meta (
    snapshot_id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    description text not null,
    source_schema text not null default 'public'
);

insert into iqbackup_20260901.snapshot_meta(description)
values ('Pre-IQBasket-v3 safety snapshot');

-- Source-of-truth / identity / access tables.
create table iqbackup_20260901.clubs as table public.clubs;
create table iqbackup_20260901.teams as table public.teams;
create table iqbackup_20260901.seasons as table public.seasons;
create table iqbackup_20260901.players as table public.players;
create table iqbackup_20260901.games as table public.games;
create table iqbackup_20260901.user_profiles as table public.user_profiles;
create table iqbackup_20260901.profiles as table public.profiles;
create table iqbackup_20260901.team_members as table public.team_members;
create table iqbackup_20260901.team_join_requests as table public.team_join_requests;
create table iqbackup_20260901.join_requests as table public.join_requests;
create table iqbackup_20260901.invitations as table public.invitations;

-- Sporting facts / statistics.
create table iqbackup_20260901.player_game_stats as table public.player_game_stats;
create table iqbackup_20260901.team_game_stats as table public.team_game_stats;
create table iqbackup_20260901.game_events as table public.game_events;
create table iqbackup_20260901.game_period_scores as table public.game_period_scores;
create table iqbackup_20260901.lineup_game_stats as table public.lineup_game_stats;
create table iqbackup_20260901.play_by_play_events as table public.play_by_play_events;
create table iqbackup_20260901.player_goals as table public.player_goals;
create table iqbackup_20260901.player_notes as table public.player_notes;
create table iqbackup_20260901.reports as table public.reports;

-- App configuration/content.
create table iqbackup_20260901.translations as table public.translations;

-- Quick verification.
select 'public.games' as source, count(*) as rows from public.games
union all
select 'backup.games', count(*) from iqbackup_20260901.games
union all
select 'public.players', count(*) from public.players
union all
select 'backup.players', count(*) from iqbackup_20260901.players
union all
select 'public.player_game_stats', count(*) from public.player_game_stats
union all
select 'backup.player_game_stats', count(*) from iqbackup_20260901.player_game_stats
union all
select 'public.game_events', count(*) from public.game_events
union all
select 'backup.game_events', count(*) from iqbackup_20260901.game_events
union all
select 'public.translations', count(*) from public.translations
union all
select 'backup.translations', count(*) from iqbackup_20260901.translations;

rollback;

-- DO NOT change the final ROLLBACK to COMMIT until:
-- 1) external backup exists;
-- 2) current fingerprints have been saved;
-- 3) explicit approval has been given.
