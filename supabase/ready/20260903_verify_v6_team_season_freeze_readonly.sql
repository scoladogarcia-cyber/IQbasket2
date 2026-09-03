-- IQBasket V6 · TEAM-SEASON FREEZE VERIFY · READ ONLY
with checks as (
  select
    to_regclass('public.team_season_freeze_requests') is not null as requests_table_ok,
    to_regclass('public.team_season_freeze_history') is not null as history_table_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='team_seasons' and column_name='freeze_token'
    ) as freeze_token_ok,
    to_regprocedure('public.iq_v6_role_for_team_season(uuid)') is not null as role_helper_ok,
    to_regprocedure('public.iq_v6_can_manage_team_season_freeze(uuid)') is not null as manage_helper_ok,
    to_regprocedure('public.iq_v6_can_request_team_season_freeze(uuid)') is not null as request_helper_ok,
    to_regprocedure('public.iq_v6_request_team_season_freeze(uuid,text)') is not null as request_rpc_ok,
    to_regprocedure('public.iq_v6_set_team_season_data_state(uuid,text,text)') is not null as state_rpc_ok,
    to_regprocedure('public.iq_v6_resolve_team_season_freeze_request(uuid,text,text)') is not null as resolve_rpc_ok,
    position(
      'data_status' in pg_get_functiondef(to_regprocedure('public.iq_v3_can_manage_roster(uuid)'))
    ) > 0 as roster_helper_frozen_guard_ok,
    exists (
      select 1 from pg_trigger
      where tgrelid='public.games'::regclass
        and tgname='trg_iq_v6_guard_frozen_team_season_game'
        and not tgisinternal
    ) as game_trigger_ok,
    exists (
      select 1 from pg_trigger
      where tgrelid='public.roster_memberships'::regclass
        and tgname='trg_iq_v6_guard_frozen_roster_membership'
        and not tgisinternal
    ) as membership_trigger_ok,
    exists (
      select 1 from pg_trigger
      where tgrelid='public.roster_membership_stints'::regclass
        and tgname='trg_iq_v6_guard_frozen_roster_stint'
        and not tgisinternal
    ) as stint_trigger_ok,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='games'
        and policyname='v6 games unfrozen insert guard'
    ) as game_insert_rls_ok,
    not exists (
      select 1 from public.team_seasons
      where upper(coalesce(data_status,'ACTIVE')) not in ('ACTIVE','FROZEN')
    ) as status_domain_ok
)
select
  'TEAM_SEASON_FREEZE_VERIFY' as section,
  *,
  requests_table_ok and history_table_ok and freeze_token_ok
    and role_helper_ok and manage_helper_ok and request_helper_ok
    and request_rpc_ok and state_rpc_ok and resolve_rpc_ok
    and roster_helper_frozen_guard_ok
    and game_trigger_ok and membership_trigger_ok and stint_trigger_ok
    and game_insert_rls_ok and status_domain_ok as all_ok
from checks;
