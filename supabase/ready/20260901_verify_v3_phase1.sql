-- IQBasket v3 PHASE 1 POST-COMMIT VERIFICATION
-- =============================================================================
-- READ ONLY. Run after Phase 1.
-- Confirms that legacy source data still matches the internal pre-v3 snapshot
-- and that RLS remains disabled until the dedicated security phase.
-- =============================================================================

with checks as (
    select
        'games_legacy_data_unchanged' as check_name,
        (
            select count(*)
            from (
                select to_jsonb(g) - 'team_season_id' as row_data
                from public.games g
                except all
                select to_jsonb(b) as row_data
                from iqbackup_pre_v3_20260901.games b
            ) x
        ) = 0
        and
        (
            select count(*)
            from (
                select to_jsonb(b) as row_data
                from iqbackup_pre_v3_20260901.games b
                except all
                select to_jsonb(g) - 'team_season_id' as row_data
                from public.games g
            ) x
        ) = 0 as ok

    union all
    select
        'user_profiles_legacy_data_unchanged',
        (
            select count(*)
            from (
                select to_jsonb(up) - 'global_role' as row_data
                from public.user_profiles up
                except all
                select to_jsonb(b) as row_data
                from iqbackup_pre_v3_20260901.user_profiles b
            ) x
        ) = 0
        and
        (
            select count(*)
            from (
                select to_jsonb(b) as row_data
                from iqbackup_pre_v3_20260901.user_profiles b
                except all
                select to_jsonb(up) - 'global_role' as row_data
                from public.user_profiles up
            ) x
        ) = 0

    union all
    select 'players_unchanged',
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from public.players x)
        =
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from iqbackup_pre_v3_20260901.players x)

    union all
    select 'player_game_stats_unchanged',
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from public.player_game_stats x)
        =
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from iqbackup_pre_v3_20260901.player_game_stats x)

    union all
    select 'team_game_stats_unchanged',
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from public.team_game_stats x)
        =
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from iqbackup_pre_v3_20260901.team_game_stats x)

    union all
    select 'game_events_unchanged',
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from public.game_events x)
        =
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from iqbackup_pre_v3_20260901.game_events x)

    union all
    select 'game_period_scores_unchanged',
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from public.game_period_scores x)
        =
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.id::text), '')) from iqbackup_pre_v3_20260901.game_period_scores x)

    union all
    select 'translations_unchanged',
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.key, x.language_code), '')) from public.translations x)
        =
        (select md5(coalesce(string_agg(row_to_json(x)::text, '|' order by x.key, x.language_code), '')) from iqbackup_pre_v3_20260901.translations x)

    union all
    select 'all_games_have_team_season',
        (select count(*) from public.games where team_season_id is null) = 0

    union all
    select 'exactly_one_global_superadmin',
        (select count(*) from public.user_profiles where upper(coalesce(global_role,''))='SUPERADMIN') = 1

    union all
    select 'master_is_global_superadmin',
        exists (
            select 1
            from public.user_profiles
            where lower(email)='scolado@nechigroup.com'
              and upper(coalesce(global_role,''))='SUPERADMIN'
        )

    union all
    select 'rls_still_disabled_games',
        not (
            select c.relrowsecurity
            from pg_class c
            join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname='games'
        )

    union all
    select 'rls_still_disabled_players',
        not (
            select c.relrowsecurity
            from pg_class c
            join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname='players'
        )
)
select
    check_name,
    case when ok then 'OK' else 'ERROR' end as result
from checks
order by check_name;
