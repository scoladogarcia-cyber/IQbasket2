-- IQBasket pre-migration snapshot (READ ONLY)
-- Run before any v3 database migration and save the output externally.
-- This script performs SELECT statements only.

-- 1) Exact row counts ----------------------------------------------------------
select 'clubs' as table_name, count(*) as rows from public.clubs
union all select 'game_events', count(*) from public.game_events
union all select 'game_period_scores', count(*) from public.game_period_scores
union all select 'games', count(*) from public.games
union all select 'invitations', count(*) from public.invitations
union all select 'join_requests', count(*) from public.join_requests
union all select 'lineup_game_stats', count(*) from public.lineup_game_stats
union all select 'play_by_play_events', count(*) from public.play_by_play_events
union all select 'player_game_stats', count(*) from public.player_game_stats
union all select 'player_goals', count(*) from public.player_goals
union all select 'player_notes', count(*) from public.player_notes
union all select 'players', count(*) from public.players
union all select 'profiles', count(*) from public.profiles
union all select 'reports', count(*) from public.reports
union all select 'seasons', count(*) from public.seasons
union all select 'team_game_stats', count(*) from public.team_game_stats
union all select 'team_join_requests', count(*) from public.team_join_requests
union all select 'team_members', count(*) from public.team_members
union all select 'teams', count(*) from public.teams
union all select 'translations', count(*) from public.translations
union all select 'user_profiles', count(*) from public.user_profiles
order by table_name;

-- 2) Orphan checks -------------------------------------------------------------
select 'player_game_stats_without_game' as check_name, count(*) as issues
from public.player_game_stats pgs
left join public.games g on g.id = pgs.game_id
where g.id is null
union all
select 'player_game_stats_without_player', count(*)
from public.player_game_stats pgs
left join public.players p on p.id = pgs.player_id
where p.id is null
union all
select 'game_events_without_game', count(*)
from public.game_events ge
left join public.games g on g.id = ge.game_id
where g.id is null
union all
select 'game_events_without_player_when_player_present', count(*)
from public.game_events ge
left join public.players p on p.id = ge.player_id
where ge.player_id is not null and p.id is null
union all
select 'period_scores_without_game', count(*)
from public.game_period_scores gps
left join public.games g on g.id = gps.game_id
where g.id is null
union all
select 'team_stats_without_game', count(*)
from public.team_game_stats tgs
left join public.games g on g.id = tgs.game_id
where g.id is null;

-- 3) Legacy season/team mismatch ----------------------------------------------
select
    g.id as game_id,
    g.team_id as game_team_id,
    g.season_id,
    s.team_id as legacy_season_team_id,
    g.date,
    g.opponent
from public.games g
join public.seasons s on s.id = g.season_id
where g.team_id <> s.team_id
order by g.date, g.id;

-- 4) Current season inventory --------------------------------------------------
select
    s.id,
    s.team_id,
    t.name as team_name,
    s.name,
    s.start_date,
    s.end_date,
    s.coach_name,
    count(g.id) as games_count
from public.seasons s
left join public.teams t on t.id = s.team_id
left join public.games g on g.season_id = s.id
group by s.id, s.team_id, t.name, s.name, s.start_date, s.end_date, s.coach_name
order by s.name, t.name;

-- 5) Player identity / context snapshot ---------------------------------------
select
    p.id,
    p.first_name,
    p.last_name,
    p.birth_date,
    p.team_id,
    t.name as team_name,
    p.season_id,
    p.jersey,
    p.primary_position,
    p.status
from public.players p
left join public.teams t on t.id = p.team_id
order by p.first_name, p.last_name, p.id;

-- 6) Auth profile alignment ----------------------------------------------------
select
    au.id as auth_user_id,
    au.email,
    up.id as user_profiles_id,
    up.role,
    up.status,
    up.assigned_team_ids,
    up.linked_player_id,
    p.id as legacy_profiles_id,
    p.role as legacy_profiles_role
from auth.users au
left join public.user_profiles up on lower(up.email) = lower(au.email)
left join public.profiles p on lower(p.email) = lower(au.email)
order by au.email;

-- 7) Duplicate protection checks ----------------------------------------------
select game_id, player_id, count(*) as rows
from public.player_game_stats
group by game_id, player_id
having count(*) > 1;

select game_id, period_number, count(*) as rows
from public.game_period_scores
group by game_id, period_number
having count(*) > 1;
