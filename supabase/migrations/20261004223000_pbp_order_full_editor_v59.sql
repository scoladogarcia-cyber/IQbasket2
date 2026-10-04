-- IQBasket V59 · ordered canonical PBP + full event editor
-- Adds deterministic sports order and one audited transaction for player/action edits.

create schema if not exists iq_v59_private;
revoke all on schema iq_v59_private from public,anon,authenticated;

alter table public.game_events
  add column if not exists event_sequence integer,
  add column if not exists client_event_key text;

with ranked as (
  select e.id,
         row_number() over (
           partition by e.game_id
           order by
             e.period asc,
             case
               when e.game_clock ~ '^[0-9]{1,2}:[0-9]{2}$'
                 then split_part(e.game_clock,':',1)::integer*60 + split_part(e.game_clock,':',2)::integer
               else 0
             end desc,
             e.created_at asc,
             e.id asc
         )::integer as seq
  from public.game_events e
)
update public.game_events e
set event_sequence=r.seq
from ranked r
where r.id=e.id
  and e.event_sequence is null;

create unique index if not exists game_events_game_sequence_uq
  on public.game_events(game_id,event_sequence)
  where event_sequence is not null;

create index if not exists game_events_game_sports_order_idx
  on public.game_events(game_id,period,event_sequence);

create table if not exists public.game_event_edit_audit (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  event_id uuid not null,
  event_sequence integer,
  old_player_id uuid references public.players(id) on delete set null,
  new_player_id uuid references public.players(id) on delete set null,
  old_action_type text not null,
  new_action_type text not null,
  old_points integer not null default 0,
  new_points integer not null default 0,
  old_made boolean not null default false,
  new_made boolean not null default false,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists game_event_edit_audit_game_idx
  on public.game_event_edit_audit(game_id,created_at desc);
alter table public.game_event_edit_audit enable row level security;
revoke all on table public.game_event_edit_audit from public,anon,authenticated;
drop policy if exists iq_game_event_edit_audit_no_direct_access on public.game_event_edit_audit;
create policy iq_game_event_edit_audit_no_direct_access
  on public.game_event_edit_audit for all to anon,authenticated
  using(false) with check(false);

create or replace function iq_v59_private.canonical_action(
  p_action text,
  p_points integer,
  p_made boolean
) returns text
language sql immutable
set search_path=''
as $$
  select case
    when lower(trim(coalesce(p_action,'')))='fg2_attempted' and (coalesce(p_made,false) or coalesce(p_points,0)=2) then 'fg2_made'
    when lower(trim(coalesce(p_action,'')))='fg3_attempted' and (coalesce(p_made,false) or coalesce(p_points,0)=3) then 'fg3_made'
    when lower(trim(coalesce(p_action,'')))='ft_attempted' and (coalesce(p_made,false) or coalesce(p_points,0)=1) then 'ft_made'
    when lower(trim(coalesce(p_action,'')))='opp_points' then 'opp_pts'
    else lower(trim(coalesce(p_action,'')))
  end;
$$;

create or replace function iq_v59_private.snapshot(p_game_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  v_base jsonb;
  v_events jsonb;
begin
  v_base:=iq_v21_private.snapshot(p_game_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'game_id',e.game_id,'player_id',e.player_id,
    'period',e.period,'game_clock',e.game_clock,'action_type',e.action_type,
    'points',e.points,'made',e.made,'coord_x',e.coord_x,'coord_y',e.coord_y,
    'event_sequence',e.event_sequence,'client_event_key',e.client_event_key,
    'created_at',e.created_at
  ) order by e.event_sequence nulls last,e.period,e.created_at,e.id),'[]'::jsonb)
  into v_events
  from public.game_events e
  where e.game_id=p_game_id;

  return jsonb_set(v_base,'{events}',v_events,true);
end;
$$;

create or replace function public.iq_v59_game_capture_snapshot(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select iq_v59_private.snapshot(p_game_id);
$$;
revoke all on function public.iq_v59_game_capture_snapshot(uuid) from public,anon;
grant execute on function public.iq_v59_game_capture_snapshot(uuid) to authenticated;

-- Preserve V58 offline/idempotency contract but write canonical events ourselves
-- after V28 lease/capture validation so JSON order becomes event_sequence.
create or replace function iq_v58_private.save_capture(
  p_game_id uuid,
  p_team_score integer,
  p_opponent_score integer,
  p_starter_ids uuid[],
  p_stats jsonb,
  p_periods jsonb,
  p_events jsonb,
  p_lease_token text,
  p_client_operation_id uuid,
  p_base_revision bigint default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_current bigint;
  v_applied bigint;
  v_existing bigint;
  v_fingerprint text;
  v_game public.games%rowtype;
  v_item jsonb;
  v_ord bigint;
  v_player_id uuid;
  v_events_count integer:=0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_game_id is null or p_client_operation_id is null then
    raise exception 'GAME_AND_OPERATION_REQUIRED' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_game_id::text));
  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND' using errcode='P0002'; end if;
  v_current:=coalesce(v_game.capture_revision,0);

  select applied_revision into v_existing
  from iq_v58_private.game_capture_receipts
  where game_id=p_game_id and client_operation_id=p_client_operation_id;
  if v_existing is not null then
    return jsonb_build_object(
      'ok',true,'replayed',true,'capture_revision',v_existing,
      'client_operation_id',p_client_operation_id
    );
  end if;

  if p_base_revision is not null and p_base_revision<>v_current then
    raise exception 'GAME_CAPTURE_CONFLICT expected=% actual=%',p_base_revision,v_current
      using errcode='40001';
  end if;

  -- V28 remains the authoritative lease + sports-write permission gate.
  perform iq_v28_private.save_capture(
    p_game_id,p_team_score,p_opponent_score,p_starter_ids,
    p_stats,p_periods,null,p_lease_token
  );

  if p_events is not null then
    if jsonb_typeof(p_events)<>'array' then
      raise exception 'GAME_CAPTURE_EVENTS_ARRAY_REQUIRED' using errcode='22023';
    end if;

    delete from public.game_events where game_id=p_game_id;

    for v_item,v_ord in
      select value,ordinality
      from jsonb_array_elements(p_events) with ordinality
    loop
      v_player_id:=nullif(v_item->>'player_id','')::uuid;
      if v_player_id is not null and not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE' using errcode='42501';
      end if;
      if nullif(trim(coalesce(v_item->>'action_type','')),'') is null then
        raise exception 'GAME_CAPTURE_ACTION_TYPE_REQUIRED' using errcode='22023';
      end if;

      insert into public.game_events(
        id,game_id,player_id,team_id,period,game_clock,action_type,
        points,made,coord_x,coord_y,created_by,event_sequence,client_event_key
      ) values (
        gen_random_uuid(),p_game_id,v_player_id,v_game.team_id,
        greatest(coalesce((v_item->>'period')::integer,1),1),
        coalesce(nullif(v_item->>'game_clock',''),'10:00'),
        trim(v_item->>'action_type'),
        greatest(coalesce((v_item->>'points')::integer,0),0),
        coalesce((v_item->>'made')::boolean,false),
        case when v_item ? 'coord_x' and v_item->>'coord_x'<>'' then (v_item->>'coord_x')::numeric else null end,
        case when v_item ? 'coord_y' and v_item->>'coord_y'<>'' then (v_item->>'coord_y')::numeric else null end,
        v_uid,
        v_ord::integer,
        nullif(trim(coalesce(v_item->>'id','')),'')
      );
      v_events_count:=v_events_count+1;
    end loop;

    insert into public.game_capture_write_audit(game_id,actor_user_id,stats_count,periods_count,events_count)
    values(p_game_id,v_uid,0,0,v_events_count);
  end if;

  v_applied:=v_current+1;
  update public.games
  set capture_revision=v_applied,capture_synced_at=now()
  where id=p_game_id;

  v_fingerprint:=encode(
    extensions.digest(
      convert_to(coalesce(p_events,'[]'::jsonb)::text||'|'||
                 coalesce(p_stats,'[]'::jsonb)::text||'|'||
                 coalesce(p_periods,'[]'::jsonb)::text,'UTF8'),
      'sha256'
    ),'hex'
  );

  insert into iq_v58_private.game_capture_receipts(
    game_id,client_operation_id,actor_user_id,base_revision,applied_revision,payload_fingerprint
  ) values (
    p_game_id,p_client_operation_id,v_uid,p_base_revision,v_applied,v_fingerprint
  );

  return iq_v59_private.snapshot(p_game_id) || jsonb_build_object(
    'ok',true,'replayed',false,'capture_revision',v_applied,
    'client_operation_id',p_client_operation_id
  );
end;
$$;

create or replace function iq_v59_private.recompute_team_game_stats(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.team_game_stats t
  set
    points=(select coalesce(sum(s.points),0) from public.player_game_stats s where s.game_id=p_game_id),
    fg2_made=(select coalesce(sum(s.fg2_made),0) from public.player_game_stats s where s.game_id=p_game_id),
    fg2_attempted=(select coalesce(sum(s.fg2_attempted),0) from public.player_game_stats s where s.game_id=p_game_id),
    fg3_made=(select coalesce(sum(s.fg3_made),0) from public.player_game_stats s where s.game_id=p_game_id),
    fg3_attempted=(select coalesce(sum(s.fg3_attempted),0) from public.player_game_stats s where s.game_id=p_game_id),
    ft_made=(select coalesce(sum(s.ft_made),0) from public.player_game_stats s where s.game_id=p_game_id),
    ft_attempted=(select coalesce(sum(s.ft_attempted),0) from public.player_game_stats s where s.game_id=p_game_id),
    rebounds_offensive=(select coalesce(sum(s.off_reb),0) from public.player_game_stats s where s.game_id=p_game_id),
    rebounds_defensive=(select coalesce(sum(s.def_reb),0) from public.player_game_stats s where s.game_id=p_game_id),
    assists=(select coalesce(sum(s.assists),0) from public.player_game_stats s where s.game_id=p_game_id),
    steals=(select coalesce(sum(s.steals),0) from public.player_game_stats s where s.game_id=p_game_id),
    turnovers=(select coalesce(sum(s.turnovers),0) from public.player_game_stats s where s.game_id=p_game_id),
    blocks_made=(select coalesce(sum(s.blocks_made),0) from public.player_game_stats s where s.game_id=p_game_id),
    blocks_received=(select coalesce(sum(s.blocks_received),0) from public.player_game_stats s where s.game_id=p_game_id),
    opp_points=(select coalesce(sum(e.points),0) from public.game_events e where e.game_id=p_game_id and lower(e.action_type) like 'opp_%'),
    opp_off_reb=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type)='opp_oreb'),
    opp_def_reb=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type)='opp_dreb'),
    opp_turnovers=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type)='opp_tov'),
    opp_fg2_made=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type) in ('opp_pts','opp_points') and e.points=2),
    opp_fg3_made=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type) in ('opp_pts','opp_points') and e.points=3),
    opp_ft_made=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type) in ('opp_pts','opp_points') and e.points=1),
    opp_fg_made=(select count(*) from public.game_events e where e.game_id=p_game_id and lower(e.action_type) in ('opp_pts','opp_points') and e.points in (2,3)),
    efg=case
      when (select coalesce(sum(s.fg2_attempted+s.fg3_attempted),0) from public.player_game_stats s where s.game_id=p_game_id)>0
      then round((
        100.0*(select coalesce(sum(s.fg2_made+1.5*s.fg3_made),0) from public.player_game_stats s where s.game_id=p_game_id) /
        (select sum(s.fg2_attempted+s.fg3_attempted) from public.player_game_stats s where s.game_id=p_game_id)
      )::numeric,1)
      else 0 end
  where t.game_id=p_game_id;
end;
$$;

create or replace function iq_v59_private.refresh_score_from_events(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_team integer;
  v_opp integer;
  v_period jsonb;
begin
  select
    coalesce(sum(case when lower(e.action_type) not like 'opp_%' then e.points else 0 end),0),
    coalesce(sum(case when lower(e.action_type) like 'opp_%' then e.points else 0 end),0)
  into v_team,v_opp
  from public.game_events e
  where e.game_id=p_game_id;

  update public.games set team_score=v_team,opponent_score=v_opp where id=p_game_id;

  insert into public.game_period_scores(game_id,period_type,period_number,team_score,opponent_score,is_overtime)
  select
    p_game_id,
    case when e.period>(select periods_count from public.games where id=p_game_id) then 'overtime' else 'quarter' end,
    e.period,
    coalesce(sum(case when lower(e.action_type) not like 'opp_%' then e.points else 0 end),0)::integer,
    coalesce(sum(case when lower(e.action_type) like 'opp_%' then e.points else 0 end),0)::integer,
    e.period>(select periods_count from public.games where id=p_game_id)
  from public.game_events e
  where e.game_id=p_game_id
  group by e.period
  on conflict(game_id,period_number) do update set
    period_type=excluded.period_type,
    team_score=excluded.team_score,
    opponent_score=excluded.opponent_score,
    is_overtime=excluded.is_overtime;

  select coalesce(jsonb_agg(jsonb_build_object(
    'period_type',ps.period_type,
    'period_number',ps.period_number,
    'team_score',ps.team_score,
    'opponent_score',ps.opponent_score,
    'is_overtime',ps.is_overtime
  ) order by ps.period_number),'[]'::jsonb)
  into v_period
  from public.game_period_scores ps where ps.game_id=p_game_id;

  update public.games
  set periods=v_period,
      has_overtime=exists(select 1 from public.game_period_scores ps where ps.game_id=p_game_id and ps.is_overtime),
      overtime_count=(select count(*) from public.game_period_scores ps where ps.game_id=p_game_id and ps.is_overtime)
  where id=p_game_id;

  perform iq_v59_private.recompute_team_game_stats(p_game_id);
end;
$$;

create or replace function iq_v59_private.edit_game_event(
  p_game_id uuid,
  p_event_id uuid,
  p_new_player_id uuid,
  p_new_action_type text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game public.games%rowtype;
  v_event public.game_events%rowtype;
  v_allowed boolean;
  v_old_action text;
  v_new_input text:=lower(trim(coalesce(p_new_action_type,'')));
  v_new_action text;
  v_old_opponent boolean;
  v_new_opponent boolean;
  v_new_points integer:=0;
  v_new_made boolean:=false;
  v_team_event_total integer;
  v_opp_event_total integer;
  v_score_complete boolean;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  if p_game_id is null or p_event_id is null or v_new_input='' then
    raise exception 'GAME_EVENT_EDIT_REQUIRED' using errcode='22023';
  end if;

  select * into v_game from public.games where id=p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND' using errcode='P0002'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_EVENT_GAME_LOCKED' using errcode='42501';
  end if;
  if exists(
    select 1 from public.team_seasons ts
    where ts.id=v_game.team_season_id and upper(coalesce(ts.data_status,'ACTIVE'))<>'ACTIVE'
  ) then
    raise exception 'GAME_EVENT_SEASON_FROZEN' using errcode='42501';
  end if;

  v_allowed:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'EDIT_BOXSCORE');
  if not v_allowed then raise exception 'GAME_EVENT_EDIT_DENIED' using errcode='42501'; end if;

  select * into v_event
  from public.game_events
  where id=p_event_id and game_id=p_game_id
  for update;
  if v_event.id is null then raise exception 'GAME_EVENT_NOT_FOUND' using errcode='P0002'; end if;

  v_old_action:=iq_v59_private.canonical_action(v_event.action_type,v_event.points,v_event.made);
  v_old_opponent:=v_old_action like 'opp_%';

  if v_new_input='fg2_made' then v_new_action:='fg2_made';v_new_points:=2;v_new_made:=true;
  elsif v_new_input='fg2_attempted' then v_new_action:='fg2_attempted';v_new_points:=0;v_new_made:=false;
  elsif v_new_input='fg3_made' then v_new_action:='fg3_made';v_new_points:=3;v_new_made:=true;
  elsif v_new_input='fg3_attempted' then v_new_action:='fg3_attempted';v_new_points:=0;v_new_made:=false;
  elsif v_new_input='ft_made' then v_new_action:='ft_made';v_new_points:=1;v_new_made:=true;
  elsif v_new_input='ft_attempted' then v_new_action:='ft_attempted';v_new_points:=0;v_new_made:=false;
  elsif v_new_input=any(array['off_reb','def_reb','assists','steals','blocks_made','blocks_received','turnovers','fouls_committed','fouls_drawn'])
    then v_new_action:=v_new_input;v_new_points:=0;v_new_made:=false;
  elsif v_new_input='opp_ft_made' then v_new_action:='opp_pts';v_new_points:=1;v_new_made:=true;
  elsif v_new_input='opp_fg2_made' then v_new_action:='opp_pts';v_new_points:=2;v_new_made:=true;
  elsif v_new_input='opp_fg3_made' then v_new_action:='opp_pts';v_new_points:=3;v_new_made:=true;
  elsif v_new_input=any(array['opp_oreb','opp_dreb','opp_tov'])
    then v_new_action:=v_new_input;v_new_points:=0;v_new_made:=false;
  else
    raise exception 'GAME_EVENT_ACTION_UNSUPPORTED: %',v_new_input using errcode='22023';
  end if;

  v_new_opponent:=v_new_action like 'opp_%';
  if v_old_opponent<>v_new_opponent then
    raise exception 'GAME_EVENT_SIDE_CHANGE_FORBIDDEN' using errcode='22023';
  end if;

  if not v_new_opponent then
    if p_new_player_id is null then
      raise exception 'GAME_EVENT_PLAYER_REQUIRED' using errcode='22023';
    end if;
    if not iq_v21_private.player_eligible(p_game_id,p_new_player_id) then
      raise exception 'GAME_EVENT_PLAYER_NOT_ELIGIBLE' using errcode='42501';
    end if;
  end if;

  select
    coalesce(sum(case when lower(e.action_type) not like 'opp_%' then e.points else 0 end),0),
    coalesce(sum(case when lower(e.action_type) like 'opp_%' then e.points else 0 end),0)
  into v_team_event_total,v_opp_event_total
  from public.game_events e where e.game_id=p_game_id;

  v_score_complete:=(v_team_event_total=coalesce(v_game.team_score,0)
                     and v_opp_event_total=coalesce(v_game.opponent_score,0));

  if v_new_points<>coalesce(v_event.points,0) and not v_score_complete then
    raise exception 'GAME_EVENT_SCORE_EDIT_REQUIRES_COMPLETE_EVENT_LOG' using errcode='22023';
  end if;

  if not v_old_opponent and v_event.player_id is not null then
    perform iq_v58_private.apply_event_stat_delta(
      p_game_id,v_event.player_id,v_old_action,v_event.points,-1
    );
  end if;

  if not v_new_opponent then
    perform iq_v58_private.apply_event_stat_delta(
      p_game_id,p_new_player_id,v_new_action,v_new_points,1
    );
  end if;

  update public.game_events
  set player_id=case when v_new_opponent then null else p_new_player_id end,
      action_type=v_new_action,
      points=v_new_points,
      made=v_new_made,
      coord_x=case when v_new_action in ('fg2_made','fg2_attempted','fg3_made','fg3_attempted') then coord_x else null end,
      coord_y=case when v_new_action in ('fg2_made','fg2_attempted','fg3_made','fg3_attempted') then coord_y else null end
  where id=p_event_id;

  if v_score_complete then
    perform iq_v59_private.refresh_score_from_events(p_game_id);
  else
    perform iq_v59_private.recompute_team_game_stats(p_game_id);
  end if;

  insert into public.game_event_edit_audit(
    game_id,event_id,event_sequence,
    old_player_id,new_player_id,
    old_action_type,new_action_type,
    old_points,new_points,old_made,new_made,
    actor_user_id,reason
  ) values (
    p_game_id,p_event_id,v_event.event_sequence,
    v_event.player_id,case when v_new_opponent then null else p_new_player_id end,
    v_event.action_type,v_new_action,
    coalesce(v_event.points,0),v_new_points,coalesce(v_event.made,false),v_new_made,
    auth.uid(),nullif(trim(coalesce(p_reason,'')),'')
  );

  -- Keep the V58 player-attribution audit populated for player-only forensic searches.
  if not v_new_opponent and v_event.player_id is distinct from p_new_player_id then
    insert into public.game_event_attribution_audit(
      game_id,event_id,old_player_id,new_player_id,action_type,actor_user_id,reason
    ) values (
      p_game_id,p_event_id,v_event.player_id,p_new_player_id,v_new_action,auth.uid(),
      nullif(trim(coalesce(p_reason,'')),'')
    );
  end if;

  return iq_v59_private.snapshot(p_game_id);
end;
$$;

create or replace function public.iq_v58_reassign_game_event_player(
  p_game_id uuid,
  p_event_id uuid,
  p_new_player_id uuid,
  p_reason text default null
) returns jsonb
language sql
security definer
set search_path=''
as $wrapper$
  select iq_v58_private.reassign_game_event_player(
    p_game_id,p_event_id,p_new_player_id,p_reason
  );
$wrapper$;
revoke all on function public.iq_v58_reassign_game_event_player(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.iq_v58_reassign_game_event_player(uuid,uuid,uuid,text) to authenticated;

create or replace function public.iq_v59_edit_game_event(
  p_game_id uuid,
  p_event_id uuid,
  p_new_player_id uuid,
  p_new_action_type text,
  p_reason text default null
) returns jsonb
language sql
security definer
set search_path=''
as $wrapper$
  select iq_v59_private.edit_game_event(
    p_game_id,p_event_id,p_new_player_id,p_new_action_type,p_reason
  );
$wrapper$;
revoke all on function public.iq_v59_edit_game_event(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.iq_v59_edit_game_event(uuid,uuid,uuid,text,text) to authenticated;
