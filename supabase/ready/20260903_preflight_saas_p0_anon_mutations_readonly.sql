-- IQBasket SaaS Security P0 · anon mutation grants · READ ONLY
with risky as (
  select
    table_name,
    string_agg(distinct privilege_type, ',' order by privilege_type) as privileges
  from information_schema.role_table_grants
  where table_schema='public'
    and grantee='anon'
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  group by table_name
)
select
  'ANON_MUTATION_PREFLIGHT' as section,
  count(*) as tables_with_anon_mutation,
  coalesce(sum(array_length(string_to_array(privileges,','),1)),0) as mutation_grant_entries
from risky;

select
  'ANON_MUTATION_TABLE' as section,
  table_name,
  privileges
from risky
order by table_name;

select
  'ANON_MUTATION_DOMAIN_BASELINE' as section,
  (select count(*) from public.clubs) as clubs,
  (select count(*) from public.teams) as teams,
  (select count(*) from public.players) as players,
  (select count(*) from public.games) as games,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events,
  (select count(*) from public.user_profiles) as user_profiles,
  (select count(*) from public.team_seasons) as team_seasons,
  (select count(*) from public.roster_memberships) as roster_memberships;
