-- IQBasket V28 · guarded rollback
begin;

do $guard$
begin
  if to_regclass('public.game_live_session_events') is not null
     and exists (select 1 from public.game_live_session_events limit 1) then
    raise exception 'GAME_LIVE_WRITER_LEASE_V1_ROLLBACK_REFUSED_AUDIT_EXISTS';
  end if;
end
$guard$;

-- Restore V21 write boundary before removing V28.
grant execute on function iq_v21_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.iq_v21_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb) to authenticated;

drop function if exists public.iq_v28_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text);
drop function if exists public.iq_v28_accept_game_live_handoff(uuid,text);
drop function if exists public.iq_v28_create_game_live_handoff(uuid,text);
drop function if exists public.iq_v28_release_game_live_session(uuid,text,text);
drop function if exists public.iq_v28_heartbeat_game_live_session(uuid,text);
drop function if exists public.iq_v28_acquire_game_live_session(uuid,boolean);
drop function if exists public.iq_v28_game_live_session_status(uuid);

drop schema if exists iq_v28_private cascade;
drop table if exists public.game_live_handoffs;
drop table if exists public.game_live_session_events;
drop table if exists public.game_live_sessions;

commit;
