-- IQBasket V61 · live capture sync security hotfix
-- Keeps iq_v58_private closed to authenticated clients while allowing the
-- public RPC wrapper to invoke the SECURITY DEFINER private boundary as owner.

create or replace function public.iq_v58_save_game_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null,
  p_lease_token text default null,
  p_client_operation_id uuid default null,
  p_base_revision bigint default null
) returns jsonb
language sql
security definer
set search_path=''
as $$
  select iq_v58_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,p_stats,p_periods,p_events,
    p_lease_token,p_client_operation_id,p_base_revision
  );
$$;

revoke all on function public.iq_v58_save_game_capture(
  uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text,uuid,bigint
) from public, anon;

grant execute on function public.iq_v58_save_game_capture(
  uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,text,uuid,bigint
) to authenticated;
