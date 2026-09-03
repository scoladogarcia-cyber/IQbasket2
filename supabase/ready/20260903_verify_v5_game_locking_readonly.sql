-- IQBasket V5 · Game locking verification (READ ONLY)
with checks as (
  select
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='edit_state') as edit_state_ok,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='locked_at') as locked_at_ok,
    to_regclass('public.game_lock_requests') is not null as requests_table_ok,
    to_regclass('public.game_lock_history') is not null as history_table_ok,
    to_regprocedure('public.iq_v5_can_manage_game_lock(uuid)') is not null as manage_helper_ok,
    to_regprocedure('public.iq_v5_can_request_game_lock(uuid)') is not null as request_helper_ok,
    to_regprocedure('public.iq_v5_request_game_lock(uuid,text)') is not null as request_rpc_ok,
    to_regprocedure('public.iq_v5_set_game_edit_state(uuid,text,text)') is not null as state_rpc_ok,
    to_regprocedure('public.iq_v5_resolve_game_lock_request(uuid,text,text)') is not null as resolve_rpc_ok,
    exists (
      select 1
      from pg_trigger
      where tgrelid='public.games'::regclass
        and tgname='trg_iq_v5_guard_game_lock_transition'
        and not tgisinternal
    ) as trigger_ok,
    position(
      'edit_state' in pg_get_functiondef('public.iq_v3_can_edit_game(uuid)'::regprocedure)
    ) > 0 as edit_guard_ok,
    position(
      'edit_state' in pg_get_functiondef('public.iq_v3_can_delete_game(uuid)'::regprocedure)
    ) > 0 as delete_guard_ok
)
select
  'GAME_LOCK_VERIFY' as section,
  *,
  (
    edit_state_ok and locked_at_ok and requests_table_ok and history_table_ok
    and manage_helper_ok and request_helper_ok and request_rpc_ok and state_rpc_ok
    and resolve_rpc_ok and trigger_ok and edit_guard_ok and delete_guard_ok
  ) as ok
from checks;

select
  'GAME_LOCK_STATE_COUNTS' as section,
  count(*) filter (where upper(coalesce(edit_state,'OPEN'))='OPEN') as open_games,
  count(*) filter (where upper(coalesce(edit_state,'OPEN'))='LOCKED') as locked_games,
  count(*) filter (where upper(coalesce(edit_state,'OPEN')) not in ('OPEN','LOCKED')) as invalid_states
from public.games;
