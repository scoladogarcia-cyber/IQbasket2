-- IQBasket V62 · persisted live lineups and recoverable minutes
-- Stores the lineup timeline independently from statistical PBP so minutes can
-- survive reloads, offline recovery and device changes without exposing direct
-- table writes to authenticated clients.

create schema if not exists iq_v62_private;
revoke all on schema iq_v62_private from public, anon, authenticated;

create table if not exists public.game_lineup_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  client_event_key text not null,
  event_sequence integer not null,
  event_kind text not null default 'SUBSTITUTION',
  period integer not null check (period >= 1),
  game_clock text not null,
  remaining_seconds integer not null check (remaining_seconds >= 0 and remaining_seconds <= 3600),
  players_in uuid[] not null default '{}'::uuid[],
  players_out uuid[] not null default '{}'::uuid[],
  on_court_player_ids uuid[] not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(game_id, client_event_key),
  unique(game_id, event_sequence),
  check (cardinality(on_court_player_ids) = 5)
);

create index if not exists game_lineup_events_game_period_idx
  on public.game_lineup_events(game_id, period, event_sequence);

revoke all on table public.game_lineup_events from anon, authenticated;

create or replace function iq_v62_private.uuid_array(p_value jsonb)
returns uuid[]
language sql
immutable
set search_path=''
as $$
  select coalesce(array_agg(value::uuid order by ordinality), '{}'::uuid[])
  from jsonb_array_elements_text(
    case when jsonb_typeof(p_value)='array' then p_value else '[]'::jsonb end
  ) with ordinality;
$$;

create or replace function iq_v62_private.replace_lineups(
  p_game_id uuid,
  p_lineups jsonb
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_item jsonb;
  v_ord bigint;
  v_on_court uuid[];
  v_in uuid[];
  v_out uuid[];
  v_key text;
  v_period integer;
  v_remaining integer;
  v_clock text;
begin
  if p_lineups is null then return; end if;
  if jsonb_typeof(p_lineups)<>'array' then
    raise exception 'GAME_LINEUPS_ARRAY_REQUIRED' using errcode='22023';
  end if;

  delete from public.game_lineup_events where game_id=p_game_id;

  for v_item,v_ord in
    select value,ordinality
    from jsonb_array_elements(p_lineups) with ordinality
  loop
    if jsonb_typeof(v_item->'on_court')<>'array' then
      raise exception 'GAME_LINEUP_ON_COURT_REQUIRED' using errcode='22023';
    end if;

    v_on_court:=iq_v62_private.uuid_array(v_item->'on_court');
    v_in:=iq_v62_private.uuid_array(coalesce(v_item->'players_in','[]'::jsonb));
    v_out:=iq_v62_private.uuid_array(coalesce(v_item->'players_out','[]'::jsonb));

    if cardinality(v_on_court)<>5
       or (select count(distinct player_id) from unnest(v_on_court) player_id)<>5 then
      raise exception 'GAME_LINEUP_FIVE_DISTINCT_REQUIRED' using errcode='22023';
    end if;

    if exists (
      select 1
      from unnest(v_on_court || v_in || v_out) player_id
      where not iq_v21_private.player_eligible(p_game_id,player_id)
    ) then
      raise exception 'GAME_LINEUP_PLAYER_NOT_ELIGIBLE' using errcode='42501';
    end if;

    v_key:=coalesce(
      nullif(trim(v_item->>'id'),''),
      'lineup-'||v_ord::text
    );
    v_period:=greatest(coalesce((v_item->>'period')::integer,1),1);
    v_remaining:=greatest(coalesce((v_item->>'remaining_seconds')::integer,0),0);
    if v_remaining>3600 then
      raise exception 'GAME_LINEUP_CLOCK_OUT_OF_RANGE' using errcode='22023';
    end if;
    v_clock:=coalesce(
      nullif(trim(v_item->>'game_clock'),''),
      lpad((v_remaining/60)::text,2,'0')||':'||lpad((v_remaining%60)::text,2,'0')
    );

    insert into public.game_lineup_events(
      game_id,client_event_key,event_sequence,event_kind,period,game_clock,
      remaining_seconds,players_in,players_out,on_court_player_ids,created_by
    ) values (
      p_game_id,v_key,v_ord::integer,
      coalesce(nullif(trim(v_item->>'type'),''),'SUBSTITUTION'),
      v_period,v_clock,v_remaining,v_in,v_out,v_on_court,auth.uid()
    );
  end loop;
end;
$$;

create or replace function iq_v62_private.snapshot(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select iq_v59_private.snapshot(p_game_id)
    || jsonb_build_object(
      'lineups',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',le.client_event_key,
            'event_sequence',le.event_sequence,
            'type',le.event_kind,
            'period',le.period,
            'game_clock',le.game_clock,
            'remaining_seconds',le.remaining_seconds,
            'players_in',to_jsonb(le.players_in),
            'players_out',to_jsonb(le.players_out),
            'on_court',to_jsonb(le.on_court_player_ids)
          )
          order by le.event_sequence
        )
        from public.game_lineup_events le
        where le.game_id=p_game_id
      ),'[]'::jsonb)
    );
$$;

create or replace function public.iq_v62_game_capture_snapshot(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select iq_v62_private.snapshot(p_game_id);
$$;

revoke all on function public.iq_v62_game_capture_snapshot(uuid) from public, anon;
grant execute on function public.iq_v62_game_capture_snapshot(uuid) to authenticated;

create or replace function public.iq_v62_save_game_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null,
  p_lineups jsonb default null,
  p_lease_token text default null,
  p_client_operation_id uuid default null,
  p_base_revision bigint default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_capture jsonb;
  v_replayed boolean;
begin
  v_capture:=iq_v58_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,p_stats,p_periods,p_events,
    p_lease_token,p_client_operation_id,p_base_revision
  );

  v_replayed:=coalesce((v_capture->>'replayed')::boolean,false);
  if not v_replayed and p_lineups is not null then
    perform iq_v62_private.replace_lineups(p_game_id,p_lineups);
  end if;

  return iq_v62_private.snapshot(p_game_id)
    || jsonb_build_object(
      'ok',true,
      'replayed',v_replayed,
      'capture_revision',v_capture->'capture_revision',
      'client_operation_id',v_capture->'client_operation_id'
    );
end;
$$;

revoke all on function public.iq_v62_save_game_capture(
  uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,jsonb,text,uuid,bigint
) from public, anon;

grant execute on function public.iq_v62_save_game_capture(
  uuid,integer,integer,uuid[],jsonb,jsonb,jsonb,jsonb,text,uuid,bigint
) to authenticated;
