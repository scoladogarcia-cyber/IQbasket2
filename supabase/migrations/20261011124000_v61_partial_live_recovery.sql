-- IQBasket V61.1 · safe partial live-capture recovery
-- Allows a client to rebase its remaining durable snapshots only when every
-- intervening V58 revision was written by the same authenticated actor.
-- The browser must additionally prove that the remote event log is a prefix of
-- its local capture before mutating the local outbox.

create or replace function public.iq_v61_game_capture_rebase_status(
  p_game_id uuid,
  p_base_revision bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_current bigint;
  v_play_state text;
  v_edit_state text;
  v_delta bigint;
  v_total bigint;
  v_owned bigint;
  v_can_rebase boolean;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_game_id is null or p_base_revision is null or p_base_revision < 0 then
    raise exception 'GAME_AND_BASE_REVISION_REQUIRED' using errcode='22023';
  end if;
  if not iq_v21_private.can_access_snapshot(p_game_id) then
    raise exception 'GAME_CAPTURE_REBASE_STATUS_DENIED' using errcode='42501';
  end if;

  select coalesce(g.capture_revision,0), upper(coalesce(g.play_state,'')),
         upper(coalesce(g.edit_state,'OPEN'))
  into v_current,v_play_state,v_edit_state
  from public.games g
  where g.id=p_game_id;

  if not found then
    raise exception 'GAME_NOT_FOUND' using errcode='P0002';
  end if;

  if p_base_revision > v_current then
    return jsonb_build_object(
      'game_id',p_game_id,
      'base_revision',p_base_revision,
      'capture_revision',v_current,
      'applied_since_base',0,
      'owned_since_base',0,
      'can_rebase',false,
      'reason','BASE_AHEAD_OF_SERVER',
      'play_state',v_play_state,
      'edit_state',v_edit_state
    );
  end if;

  v_delta:=v_current-p_base_revision;

  select count(*),
         count(*) filter (where r.actor_user_id=v_uid)
  into v_total,v_owned
  from iq_v58_private.game_capture_receipts r
  where r.game_id=p_game_id
    and r.applied_revision>p_base_revision
    and r.applied_revision<=v_current;

  v_can_rebase :=
    v_edit_state='OPEN'
    and v_play_state in ('PREPARED','LIVE')
    and (
      v_delta=0
      or (v_total=v_delta and v_owned=v_total)
    );

  return jsonb_build_object(
    'game_id',p_game_id,
    'base_revision',p_base_revision,
    'capture_revision',v_current,
    'applied_since_base',v_total,
    'owned_since_base',v_owned,
    'can_rebase',v_can_rebase,
    'reason',case
      when v_edit_state<>'OPEN' then 'GAME_LOCKED'
      when v_play_state not in ('PREPARED','LIVE') then 'GAME_NOT_LIVE'
      when v_delta=0 then 'NO_REMOTE_ADVANCE'
      when v_total<>v_delta then 'REVISION_HISTORY_INCOMPLETE'
      when v_owned<>v_total then 'OTHER_ACTOR_ADVANCED'
      else 'SAME_ACTOR_CONTINUITY'
    end,
    'play_state',v_play_state,
    'edit_state',v_edit_state
  );
end;
$$;

revoke all on function public.iq_v61_game_capture_rebase_status(uuid,bigint)
  from public,anon;

grant execute on function public.iq_v61_game_capture_rebase_status(uuid,bigint)
  to authenticated;
