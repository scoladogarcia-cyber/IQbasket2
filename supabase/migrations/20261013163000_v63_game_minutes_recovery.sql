-- IQBasket V63 · isolated game-minute recovery editor
-- The RPC modifies only player_game_stats.minutes and, in LINEUPS mode, the
-- V62 lineup timeline. It never rewrites PBP, scores or any other box-score field.

create schema if not exists iq_v63_private;
revoke all on schema iq_v63_private from public, anon, authenticated;

create table if not exists public.game_minutes_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_user_id uuid not null,
  mode text not null check (mode in ('DIRECT','LINEUPS')),
  expected_team_minutes integer not null,
  before_minutes jsonb not null,
  after_minutes jsonb not null,
  before_lineups jsonb not null default '[]'::jsonb,
  after_lineups jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

alter table public.game_minutes_recovery_audit enable row level security;
revoke all on table public.game_minutes_recovery_audit from anon, authenticated;

create index if not exists game_minutes_recovery_audit_game_created_idx
  on public.game_minutes_recovery_audit(game_id, created_at desc);

create or replace function iq_v63_private.expected_team_minutes(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select (
    greatest(coalesce(g.periods_count,4),1) * greatest(coalesce(g.period_minutes,10),1)
    + greatest(coalesce(g.overtime_count,0),0) * 5
  ) * 5
  from public.games g
  where g.id=p_game_id;
$$;

create or replace function iq_v63_private.assert_can_edit(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game public.games;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  select * into v_game
  from public.games
  where id=p_game_id
  for update;

  if v_game.id is null then
    raise exception 'GAME_NOT_FOUND' using errcode='P0002';
  end if;

  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_MINUTES_RECOVERY_LOCKED' using errcode='42501';
  end if;

  if v_game.team_season_id is not null and exists (
    select 1
    from public.team_seasons ts
    where ts.id=v_game.team_season_id
      and upper(coalesce(ts.data_status,'ACTIVE'))<>'ACTIVE'
  ) then
    raise exception 'GAME_MINUTES_RECOVERY_SEASON_FROZEN' using errcode='42501';
  end if;

  v_allowed:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'EDIT_BOXSCORE');

  if not v_allowed then
    raise exception 'GAME_MINUTES_RECOVERY_DENIED' using errcode='42501';
  end if;

  return v_game;
end;
$$;

create or replace function public.iq_v63_save_game_minutes_recovery(
  p_game_id uuid,
  p_mode text,
  p_minutes jsonb default null,
  p_lineups jsonb default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game public.games;
  v_mode text:=upper(trim(coalesce(p_mode,'')));
  v_expected integer;
  v_actual_periods integer;
  v_period integer;
  v_period_seconds integer;
  v_first_remaining integer;
  v_input_count integer;
  v_distinct_count integer;
  v_stats_count integer;
  v_input_total integer;
  v_total_seconds bigint;
  v_after_total integer;
  v_before_minutes jsonb;
  v_after_minutes jsonb;
  v_before_lineups jsonb;
  v_after_lineups jsonb;
  v_audit_id uuid;
begin
  v_game:=iq_v63_private.assert_can_edit(p_game_id);
  v_expected:=iq_v63_private.expected_team_minutes(p_game_id);

  if v_mode not in ('DIRECT','LINEUPS') then
    raise exception 'GAME_MINUTES_RECOVERY_MODE_INVALID' using errcode='22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('player_id',s.player_id,'minutes',coalesce(s.minutes,0))
      order by s.player_id::text
    ),
    '[]'::jsonb
  )
  into v_before_minutes
  from public.player_game_stats s
  where s.game_id=p_game_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',le.client_event_key,
        'event_sequence',le.event_sequence,
        'period',le.period,
        'game_clock',le.game_clock,
        'remaining_seconds',le.remaining_seconds,
        'on_court',to_jsonb(le.on_court_player_ids)
      )
      order by le.event_sequence
    ),
    '[]'::jsonb
  )
  into v_before_lineups
  from public.game_lineup_events le
  where le.game_id=p_game_id;

  if v_mode='DIRECT' then
    if p_minutes is null or jsonb_typeof(p_minutes)<>'array' then
      raise exception 'GAME_MINUTES_ARRAY_REQUIRED' using errcode='22023';
    end if;

    select count(*)::integer,
           count(distinct x.player_id)::integer,
           coalesce(sum(x.minutes),0)::integer
    into v_input_count,v_distinct_count,v_input_total
    from jsonb_to_recordset(p_minutes) as x(player_id uuid,minutes integer);

    select count(*)::integer into v_stats_count
    from public.player_game_stats
    where game_id=p_game_id;

    if v_input_count<>v_distinct_count then
      raise exception 'GAME_MINUTES_DUPLICATE_PLAYER' using errcode='22023';
    end if;

    if v_input_count<>v_stats_count then
      raise exception 'GAME_MINUTES_ALL_PLAYERS_REQUIRED expected=% actual=%',v_stats_count,v_input_count
        using errcode='22023';
    end if;

    if v_input_total<>v_expected then
      raise exception 'GAME_MINUTES_TOTAL_INVALID expected=% actual=%',v_expected,v_input_total
        using errcode='22023';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_minutes) as x(player_id uuid,minutes integer)
      left join public.player_game_stats s
        on s.game_id=p_game_id and s.player_id=x.player_id
      where s.player_id is null
         or x.minutes is null
         or x.minutes<0
         or x.minutes>(
           greatest(coalesce(v_game.periods_count,4),1) * greatest(coalesce(v_game.period_minutes,10),1)
           + greatest(coalesce(v_game.overtime_count,0),0) * 5
         )
    ) then
      raise exception 'GAME_MINUTES_PLAYER_VALUE_INVALID' using errcode='22023';
    end if;

    update public.player_game_stats s
    set minutes=x.minutes
    from jsonb_to_recordset(p_minutes) as x(player_id uuid,minutes integer)
    where s.game_id=p_game_id
      and s.player_id=x.player_id;

  else
    if p_lineups is null or jsonb_typeof(p_lineups)<>'array' or jsonb_array_length(p_lineups)=0 then
      raise exception 'GAME_LINEUPS_REQUIRED' using errcode='22023';
    end if;

    perform iq_v62_private.replace_lineups(p_game_id,p_lineups);

    v_actual_periods:=greatest(coalesce(v_game.periods_count,4),1)
      + greatest(coalesce(v_game.overtime_count,0),0);

    for v_period in 1..v_actual_periods loop
      v_period_seconds:=case
        when v_period<=greatest(coalesce(v_game.periods_count,4),1)
          then greatest(coalesce(v_game.period_minutes,10),1)*60
        else 300
      end;

      select le.remaining_seconds
      into v_first_remaining
      from public.game_lineup_events le
      where le.game_id=p_game_id and le.period=v_period
      order by le.event_sequence
      limit 1;

      if v_first_remaining is null then
        raise exception 'GAME_LINEUPS_PERIOD_MISSING period=%',v_period using errcode='22023';
      end if;

      if v_first_remaining<>v_period_seconds then
        raise exception 'GAME_LINEUPS_PERIOD_START_INVALID period=% expected=% actual=%',
          v_period,v_period_seconds,v_first_remaining using errcode='22023';
      end if;

      if exists (
        select 1
        from (
          select le.remaining_seconds,
                 lead(le.remaining_seconds) over(order by le.event_sequence) as next_remaining
          from public.game_lineup_events le
          where le.game_id=p_game_id and le.period=v_period
        ) ordered
        where ordered.next_remaining>ordered.remaining_seconds
      ) then
        raise exception 'GAME_LINEUPS_CLOCK_ORDER_INVALID period=%',v_period using errcode='22023';
      end if;
    end loop;

    if exists (
      select 1
      from public.game_lineup_events le
      cross join lateral unnest(le.on_court_player_ids) player_id
      left join public.player_game_stats s
        on s.game_id=p_game_id and s.player_id=player_id
      where le.game_id=p_game_id
        and s.player_id is null
    ) then
      raise exception 'GAME_LINEUPS_PLAYER_MISSING_FROM_BOXSCORE' using errcode='22023';
    end if;

    with spans as (
      select le.period,
             le.on_court_player_ids,
             le.remaining_seconds
               - coalesce(
                   lead(le.remaining_seconds) over(
                     partition by le.period order by le.event_sequence
                   ),
                   0
                 ) as seconds_played
      from public.game_lineup_events le
      where le.game_id=p_game_id
    )
    select coalesce(sum(seconds_played * cardinality(on_court_player_ids)),0)
    into v_total_seconds
    from spans;

    if v_total_seconds<>v_expected::bigint*60 then
      raise exception 'GAME_LINEUPS_TOTAL_INVALID expected_seconds=% actual_seconds=%',
        v_expected::bigint*60,v_total_seconds using errcode='22023';
    end if;

    with spans as (
      select le.period,
             le.on_court_player_ids,
             le.remaining_seconds
               - coalesce(
                   lead(le.remaining_seconds) over(
                     partition by le.period order by le.event_sequence
                   ),
                   0
                 ) as seconds_played
      from public.game_lineup_events le
      where le.game_id=p_game_id
    ),
    player_seconds as (
      select player_id,sum(seconds_played)::numeric as seconds_played
      from spans
      cross join lateral unnest(on_court_player_ids) player_id
      group by player_id
    ),
    exact as (
      select s.player_id,
             coalesce(ps.seconds_played,0)/60.0 as exact_minutes
      from public.player_game_stats s
      left join player_seconds ps on ps.player_id=s.player_id
      where s.game_id=p_game_id
    ),
    ranked as (
      select player_id,
             floor(exact_minutes)::integer as base_minutes,
             row_number() over(
               order by (exact_minutes-floor(exact_minutes)) desc,player_id::text
             ) as remainder_rank
      from exact
    ),
    totals as (
      select v_expected-coalesce(sum(base_minutes),0)::integer as remainder
      from ranked
    ),
    final_minutes as (
      select r.player_id,
             r.base_minutes + case when r.remainder_rank<=t.remainder then 1 else 0 end as minutes
      from ranked r
      cross join totals t
    )
    update public.player_game_stats s
    set minutes=f.minutes
    from final_minutes f
    where s.game_id=p_game_id
      and s.player_id=f.player_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('player_id',s.player_id,'minutes',coalesce(s.minutes,0))
      order by s.player_id::text
    ),
    '[]'::jsonb
  ),
  coalesce(sum(s.minutes),0)::integer
  into v_after_minutes,v_after_total
  from public.player_game_stats s
  where s.game_id=p_game_id;

  if v_after_total<>v_expected then
    raise exception 'GAME_MINUTES_POSTCONDITION_FAILED expected=% actual=%',v_expected,v_after_total
      using errcode='P0001';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',le.client_event_key,
        'event_sequence',le.event_sequence,
        'period',le.period,
        'game_clock',le.game_clock,
        'remaining_seconds',le.remaining_seconds,
        'on_court',to_jsonb(le.on_court_player_ids)
      )
      order by le.event_sequence
    ),
    '[]'::jsonb
  )
  into v_after_lineups
  from public.game_lineup_events le
  where le.game_id=p_game_id;

  insert into public.game_minutes_recovery_audit(
    game_id,actor_user_id,mode,expected_team_minutes,
    before_minutes,after_minutes,before_lineups,after_lineups,note
  ) values (
    p_game_id,auth.uid(),v_mode,v_expected,
    v_before_minutes,v_after_minutes,v_before_lineups,v_after_lineups,
    nullif(left(trim(coalesce(p_note,'')),500),'')
  )
  returning id into v_audit_id;

  return jsonb_build_object(
    'ok',true,
    'game_id',p_game_id,
    'mode',v_mode,
    'expected_team_minutes',v_expected,
    'actual_team_minutes',v_after_total,
    'minutes',v_after_minutes,
    'lineups',v_after_lineups,
    'audit_id',v_audit_id
  );
end;
$$;

revoke all on function public.iq_v63_save_game_minutes_recovery(uuid,text,jsonb,jsonb,text)
  from public,anon;

grant execute on function public.iq_v63_save_game_minutes_recovery(uuid,text,jsonb,jsonb,text)
  to authenticated;
