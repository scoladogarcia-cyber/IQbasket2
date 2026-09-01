-- IQBasket integrity fingerprints (READ ONLY)
-- -----------------------------------------------------------------------------
-- Save the output before migration and compare it after migration.
-- The hashes cover the CURRENT source-of-truth tables and help prove that
-- identifiers/content were not accidentally changed.
-- No writes are performed.
-- -----------------------------------------------------------------------------

with fingerprints as (
    select
        'clubs' as table_name,
        count(*)::bigint as row_count,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) as fingerprint
    from public.clubs x

    union all
    select
        'teams',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.teams x

    union all
    select
        'seasons',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.seasons x

    union all
    select
        'players',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.players x

    union all
    select
        'games',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.games x

    union all
    select
        'player_game_stats',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.player_game_stats x

    union all
    select
        'team_game_stats',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.team_game_stats x

    union all
    select
        'game_events',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.game_events x

    union all
    select
        'game_period_scores',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.game_period_scores x

    union all
    select
        'user_profiles',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.user_profiles x

    union all
    select
        'profiles',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.profiles x

    union all
    select
        'team_members',
        count(*)::bigint,
        md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), ''))
    from public.team_members x

    union all
    select
        'translations',
        count(*)::bigint,
        md5(coalesce(
            string_agg(
                row_to_json(x)::text,
                '|'
                order by x.key, x.language_code
            ),
            ''
        ))
    from public.translations x
)
select *
from fingerprints
order by table_name;

-- Stable relationship counts that should remain unchanged during the additive
-- v3 migration.
select
    (select count(*) from public.games) as games,
    (select count(*) from public.players) as players,
    (select count(*) from public.player_game_stats) as player_game_stats,
    (select count(*) from public.team_game_stats) as team_game_stats,
    (select count(*) from public.game_events) as game_events,
    (select count(*) from public.game_period_scores) as game_period_scores,
    (
        select count(*)
        from public.player_game_stats s
        join public.games g on g.id = s.game_id
        join public.players p on p.id = s.player_id
    ) as valid_player_stat_links,
    (
        select count(*)
        from public.game_events e
        join public.games g on g.id = e.game_id
        left join public.players p on p.id = e.player_id
        where e.player_id is null or p.id is not null
    ) as valid_event_links;
