-- IQBasket v3 PHASE 1 ROLLBACK PLAN
-- =============================================================================
-- DO NOT EXECUTE unless Phase 1 must explicitly be reverted.
--
-- This rollback removes ONLY objects introduced by v3 Phase 1.
-- It does not delete or rewrite legacy IQBasket rows.
-- The internal pre-v3 safety snapshot is intentionally kept.
-- =============================================================================

begin;

-- Remove additive bridge fields/indexes first.
drop index if exists public.uq_team_join_requests_pending_scope;
drop index if exists public.idx_team_join_requests_team_season_id;
alter table public.team_join_requests drop column if exists team_season_id;

drop index if exists public.idx_reports_team_season_id;
alter table public.reports drop column if exists team_season_id;

drop index if exists public.idx_games_team_season_id;
alter table public.games drop column if exists team_season_id;

alter table public.user_profiles
    drop constraint if exists user_profiles_superadmin_email_guard;
drop index if exists public.uq_user_profiles_single_global_superadmin;
alter table public.user_profiles drop column if exists global_role;

-- Remove v3-only derived/context tables in dependency-safe order.
drop table if exists public.lineup_season_metrics;
drop table if exists public.team_season_metrics;
drop table if exists public.player_season_metrics;
drop table if exists public.analytics_runs;
drop table if exists public.user_player_links;
drop table if exists public.club_season_memberships;
drop table if exists public.team_season_memberships;
drop table if exists public.roster_memberships;
drop table if exists public.team_seasons;
drop table if exists public.season_catalog;

commit;

-- Legacy tables and the safety snapshot remain untouched.
