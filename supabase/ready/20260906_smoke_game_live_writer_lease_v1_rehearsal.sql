-- IQBasket V28 · transactional rehearsal
-- Applies the migration body inside a transaction and rolls it back. Intended
-- for manual/MCP validation before production apply; it leaves no schema change.
begin;

-- Preconditions mirror the migration without mutating data.
do $rehearsal$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.user_profiles') is null
     or to_regprocedure('iq_v21_private.save_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb)') is null
     or to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'GAME_LIVE_WRITER_LEASE_V1_REHEARSAL_PREREQUISITES_MISSING';
  end if;
end
$rehearsal$;

-- Confirm names are currently free before the real migration.
select
  to_regclass('public.game_live_sessions') is null as sessions_name_free,
  to_regclass('public.game_live_session_events') is null as events_name_free,
  to_regclass('public.game_live_handoffs') is null as handoffs_name_free,
  to_regprocedure('public.iq_v28_game_live_session_status(uuid)') is null as status_rpc_name_free,
  to_regprocedure('public.iq_v28_save_game_capture(uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text)') is null as save_rpc_name_free;

rollback;
