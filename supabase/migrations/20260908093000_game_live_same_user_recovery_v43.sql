-- =============================================================================
-- IQBasket · V43 same-user live lease recovery
-- Rotates a lost tab token only when the active lease belongs to auth.uid().
-- The previous token becomes invalid immediately, preserving single-writer.
-- =============================================================================
begin;

create schema if not exists iq_v43_private;
revoke all on schema iq_v43_private from public,anon,authenticated;
grant usage on schema iq_v43_private to authenticated;

create or replace function iq_v43_private.recover_own_game_live_session(
  p_game_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_current public.game_live_sessions%rowtype;
  v_token text;
  v_hash text;
  v_expiry timestamptz:=now()+interval '90 seconds';
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  if not iq_v28_private.can_record(p_game_id) then
    raise exception 'GAME_LIVE_LEASE_RECOVERY_DENIED' using errcode='42501';
  end if;

  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.play_state,'SCHEDULED')) not in ('READY','LIVE') then
    raise exception 'GAME_LIVE_LEASE_STATE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_game_id::text));

  select * into v_current
  from public.game_live_sessions
  where game_id=p_game_id
  for update;

  if v_current.game_id is null
     or v_current.released_at is not null
     or v_current.lease_expires_at<=now() then
    return iq_v28_private.acquire(p_game_id,false);
  end if;

  if v_current.writer_user_id<>auth.uid() then
    raise exception 'GAME_LIVE_LEASE_RECOVERY_NOT_MINE' using errcode='42501';
  end if;

  v_token:=gen_random_uuid()::text;
  v_hash:=iq_v28_private.token_hash(v_token);

  update public.game_live_sessions
  set lease_token_hash=v_hash,
      heartbeat_at=now(),
      lease_expires_at=v_expiry,
      released_at=null,
      release_reason=null,
      version=version+1,
      updated_at=now()
  where game_id=p_game_id;

  update public.game_live_handoffs
  set cancelled_at=now(),cancelled_by=auth.uid()
  where game_id=p_game_id
    and consumed_at is null
    and cancelled_at is null;

  insert into public.game_live_session_events(
    game_id,writer_user_id,actor_user_id,action,metadata
  ) values (
    p_game_id,auth.uid(),auth.uid(),'ACQUIRED',
    jsonb_build_object(
      'acquire_mode','SELF_RECOVERY',
      'previous_version',v_current.version,
      'previous_expires_at',v_current.lease_expires_at,
      'lease_expires_at',v_expiry
    )
  );

  return jsonb_build_object(
    'game_id',p_game_id,
    'active',true,
    'is_mine',true,
    'recovered',true,
    'lease_token',v_token,
    'lease_expires_at',v_expiry,
    'heartbeat_interval_seconds',30,
    'lease_ttl_seconds',90
  );
end
$function$;

create or replace function public.iq_v43_recover_own_game_live_session(
  p_game_id uuid
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select iq_v43_private.recover_own_game_live_session(p_game_id);
$function$;

revoke all on all functions in schema iq_v43_private from public,anon,authenticated;
grant execute on function iq_v43_private.recover_own_game_live_session(uuid) to authenticated;

revoke all on function public.iq_v43_recover_own_game_live_session(uuid)
  from public,anon,authenticated;
grant execute on function public.iq_v43_recover_own_game_live_session(uuid)
  to authenticated;

commit;
