-- =============================================================================
-- IQBasket · guarded rollback · Game Play State V2
-- Refuses destructive rollback once real transition audit exists.
-- =============================================================================

begin;

do $guard$
begin
  if to_regclass('public.game_play_state_transitions') is not null
     and exists (select 1 from public.game_play_state_transitions limit 1) then
    raise exception 'GAME_PLAY_STATE_V2_ROLLBACK_REFUSED_AUDIT_EXISTS';
  end if;
end
$guard$;

drop trigger if exists trg_iq_v13_guard_lock_live_game on public.games;
drop trigger if exists trg_iq_v13_sync_game_legacy_status on public.games;

drop function if exists public.iq_v13_game_play_state_snapshot(uuid);
drop function if exists public.iq_v13_set_game_play_state(uuid,text,text);
drop function if exists iq_private.guard_lock_live_game_v2();
drop function if exists iq_private.sync_game_play_state_legacy_status_v2();
drop function if exists iq_private.game_play_state_actor_allowed(uuid,text);
drop function if exists iq_private.game_play_state_action_for_target(text);
drop function if exists iq_private.game_play_state_transition_allowed(text,text);
drop function if exists iq_private.game_legacy_status_for_play_state(text);

drop table if exists public.game_play_state_transitions;

drop index if exists public.games_play_state_idx;
drop index if exists public.games_play_state_changed_by_fk_idx;

alter table public.games drop constraint if exists games_play_state_check;
alter table public.games
  drop column if exists play_state_reason,
  drop column if exists play_state_changed_by,
  drop column if exists play_state_changed_at,
  drop column if exists play_state;

commit;

select 'GAME_PLAY_STATE_V2_ROLLBACK_OK' result;
