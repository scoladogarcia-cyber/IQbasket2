-- =============================================================================
-- IQBasket V5 · Non-destructive game locking rollback
-- Disables enforcement while preserving additive lifecycle/audit data.
-- =============================================================================

begin;

drop trigger if exists trg_iq_v5_guard_game_lock_transition on public.games;
drop trigger if exists trg_iq_v5_guard_locked_game_delete on public.games;

do $child_triggers$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array[
    'player_game_stats',
    'team_game_stats',
    'game_events',
    'game_period_scores',
    'lineup_game_stats',
    'play_by_play_events'
  ]
  loop
    v_trigger := 'trg_iq_v5_lock_' || v_table;
    execute format('drop trigger if exists %I on public.%I', v_trigger, v_table);
  end loop;
end
$child_triggers$;

drop policy if exists "v5 games open update guard" on public.games;
drop policy if exists "v5 games open delete guard" on public.games;

do $child_policies$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array[
    'player_game_stats',
    'team_game_stats',
    'game_events',
    'game_period_scores',
    'lineup_game_stats',
    'play_by_play_events'
  ]
  loop
    foreach v_policy in array array[
      'v5 ' || v_table || ' open insert guard',
      'v5 ' || v_table || ' open update guard',
      'v5 ' || v_table || ' open delete guard'
    ]
    loop
      execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    end loop;
  end loop;
end
$child_policies$;

revoke execute on function public.iq_v5_current_email() from authenticated;
revoke execute on function public.iq_v5_current_role() from authenticated;
revoke execute on function public.iq_v5_can_access_team(uuid) from authenticated;
revoke execute on function public.iq_v5_role_for_game(uuid) from authenticated;
revoke execute on function public.iq_v5_can_manage_game_lock(uuid) from authenticated;
revoke execute on function public.iq_v5_can_request_game_lock(uuid) from authenticated;
revoke execute on function public.iq_v5_request_game_lock(uuid,text) from authenticated;
revoke execute on function public.iq_v5_set_game_edit_state(uuid,text,text) from authenticated;
revoke execute on function public.iq_v5_resolve_game_lock_request(uuid,text,text) from authenticated;

commit;
