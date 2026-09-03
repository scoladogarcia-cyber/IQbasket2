-- =============================================================================
-- IQBasket V5 · Game locking verification (READ ONLY)
-- =============================================================================

with checks as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='games' and column_name='edit_state'
    ) as edit_state_ok,
    exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='games' and column_name='locked_at'
    ) as locked_at_ok,
    to_regclass('public.game_lock_requests') is not null as requests_table_ok,
    to_regclass('public.game_lock_history') is not null as history_table_ok,
    to_regprocedure('public.iq_v5_can_manage_game_lock(uuid)') is not null as manage_helper_ok,
    to_regprocedure('public.iq_v5_can_request_game_lock(uuid)') is not null as request_helper_ok,
    to_regprocedure('public.iq_v5_request_game_lock(uuid,text)') is not null as request_rpc_ok,
    to_regprocedure('public.iq_v5_set_game_edit_state(uuid,text,text)') is not null as state_rpc_ok,
    to_regprocedure('public.iq_v5_resolve_game_lock_request(uuid,text,text)') is not null as resolve_rpc_ok,
    exists (
      select 1 from pg_trigger
      where tgrelid='public.games'::regclass
        and tgname='trg_iq_v5_guard_game_lock_transition'
        and not tgisinternal
    ) as game_update_trigger_ok,
    exists (
      select 1 from pg_trigger
      where tgrelid='public.games'::regclass
        and tgname='trg_iq_v5_guard_locked_game_delete'
        and not tgisinternal
    ) as game_delete_trigger_ok,
    (
      select count(*) = 6
      from pg_trigger t
      join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in (
          'player_game_stats','team_game_stats','game_events',
          'game_period_scores','lineup_game_stats','play_by_play_events'
        )
        and t.tgname = 'trg_iq_v5_lock_' || c.relname
        and not t.tgisinternal
    ) as child_triggers_ok,
    exists (
      select 1 from pg_policies
      where schemaname='public'
        and tablename='games'
        and policyname='v5 games open update guard'
        and permissive='RESTRICTIVE'
    ) as game_update_rls_guard_ok,
    exists (
      select 1 from pg_policies
      where schemaname='public'
        and tablename='games'
        and policyname='v5 games open delete guard'
        and permissive='RESTRICTIVE'
    ) as game_delete_rls_guard_ok,
    (
      select count(*) = 18
      from pg_policies
      where schemaname='public'
        and tablename in (
          'player_game_stats','team_game_stats','game_events',
          'game_period_scores','lineup_game_stats','play_by_play_events'
        )
        and policyname like 'v5 % open % guard'
        and permissive='RESTRICTIVE'
    ) as child_rls_guards_ok
)
select
  'GAME_LOCK_VERIFY' as section,
  *,
  (
    edit_state_ok
    and locked_at_ok
    and requests_table_ok
    and history_table_ok
    and manage_helper_ok
    and request_helper_ok
    and request_rpc_ok
    and state_rpc_ok
    and resolve_rpc_ok
    and game_update_trigger_ok
    and game_delete_trigger_ok
    and child_triggers_ok
    and game_update_rls_guard_ok
    and game_delete_rls_guard_ok
    and child_rls_guards_ok
  ) as ok
from checks;

select
  'GAME_LOCK_STATE_COUNTS' as section,
  count(*) filter (where upper(coalesce(edit_state,'OPEN'))='OPEN') as open_games,
  count(*) filter (where upper(coalesce(edit_state,'OPEN'))='LOCKED') as locked_games,
  count(*) filter (where upper(coalesce(edit_state,'OPEN')) not in ('OPEN','LOCKED')) as invalid_states
from public.games;
