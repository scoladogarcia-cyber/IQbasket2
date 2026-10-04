-- IQBasket V58 · auditable play-by-play attribution correction
-- Allows authorized BoxScore editors to reassign an own-team event to another
-- eligible player and atomically move the event-derived counting statistic.

create table if not exists public.game_event_attribution_audit (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  event_id uuid not null,
  old_player_id uuid references public.players(id) on delete set null,
  new_player_id uuid not null references public.players(id) on delete restrict,
  action_type text not null,
  actor_user_id uuid not null references public.user_profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists game_event_attribution_audit_game_idx
  on public.game_event_attribution_audit(game_id,created_at desc);
alter table public.game_event_attribution_audit enable row level security;
revoke all on table public.game_event_attribution_audit from public,anon,authenticated;
drop policy if exists iq_game_event_attribution_audit_no_direct_access on public.game_event_attribution_audit;
create policy iq_game_event_attribution_audit_no_direct_access
  on public.game_event_attribution_audit for all to anon,authenticated
  using(false) with check(false);

create or replace function iq_v58_private.apply_event_stat_delta(
  p_game_id uuid,
  p_player_id uuid,
  p_action_type text,
  p_points integer,
  p_delta integer
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_action text:=lower(trim(coalesce(p_action_type,'')));
  v_points integer:=greatest(coalesce(p_points,0),0);
begin
  if p_player_id is null or p_delta not in (-1,1) then return; end if;

  insert into public.player_game_stats(game_id,player_id)
  values(p_game_id,p_player_id)
  on conflict(game_id,player_id) do nothing;

  update public.player_game_stats s
  set
    points=greatest(0,coalesce(s.points,0) + case when v_action in ('fg2_made','fg3_made','ft_made') then p_delta*v_points else 0 end),
    fg2_made=greatest(0,s.fg2_made + case when v_action='fg2_made' then p_delta else 0 end),
    fg2_attempted=greatest(0,s.fg2_attempted + case when v_action in ('fg2_made','fg2_attempted') then p_delta else 0 end),
    fg3_made=greatest(0,s.fg3_made + case when v_action='fg3_made' then p_delta else 0 end),
    fg3_attempted=greatest(0,s.fg3_attempted + case when v_action in ('fg3_made','fg3_attempted') then p_delta else 0 end),
    ft_made=greatest(0,s.ft_made + case when v_action='ft_made' then p_delta else 0 end),
    ft_attempted=greatest(0,s.ft_attempted + case when v_action in ('ft_made','ft_attempted') then p_delta else 0 end),
    off_reb=greatest(0,s.off_reb + case when v_action='off_reb' then p_delta else 0 end),
    def_reb=greatest(0,s.def_reb + case when v_action='def_reb' then p_delta else 0 end),
    rebounds_offensive=greatest(0,coalesce(s.rebounds_offensive,0) + case when v_action='off_reb' then p_delta else 0 end),
    rebounds_defensive=greatest(0,coalesce(s.rebounds_defensive,0) + case when v_action='def_reb' then p_delta else 0 end),
    assists=greatest(0,s.assists + case when v_action='assists' then p_delta else 0 end),
    steals=greatest(0,s.steals + case when v_action='steals' then p_delta else 0 end),
    blocks=greatest(0,s.blocks + case when v_action='blocks_made' then p_delta else 0 end),
    blocks_made=greatest(0,coalesce(s.blocks_made,0) + case when v_action='blocks_made' then p_delta else 0 end),
    blocks_received=greatest(0,coalesce(s.blocks_received,0) + case when v_action='blocks_received' then p_delta else 0 end),
    turnovers=greatest(0,s.turnovers + case when v_action='turnovers' then p_delta else 0 end),
    fouls_committed=greatest(0,s.fouls_committed + case when v_action='fouls_committed' then p_delta else 0 end),
    fouls_drawn=greatest(0,s.fouls_drawn + case when v_action='fouls_drawn' then p_delta else 0 end),
    fouls_received=greatest(0,coalesce(s.fouls_received,0) + case when v_action='fouls_drawn' then p_delta else 0 end)
  where s.game_id=p_game_id and s.player_id=p_player_id;
end;
$$;

create or replace function iq_v58_private.reassign_game_event_player(
  p_game_id uuid,
  p_event_id uuid,
  p_new_player_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game public.games%rowtype;
  v_event public.game_events%rowtype;
  v_old_player uuid;
  v_allowed boolean;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  if p_game_id is null or p_event_id is null or p_new_player_id is null then
    raise exception 'GAME_EVENT_PLAYER_REQUIRED' using errcode='22023';
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
  if not iq_v21_private.player_eligible(p_game_id,p_new_player_id) then
    raise exception 'GAME_EVENT_PLAYER_NOT_ELIGIBLE' using errcode='42501';
  end if;

  select * into v_event
  from public.game_events
  where id=p_event_id and game_id=p_game_id
  for update;
  if v_event.id is null then raise exception 'GAME_EVENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_event.player_id is null or lower(v_event.action_type) like 'opp_%' then
    raise exception 'GAME_EVENT_NOT_REASSIGNABLE' using errcode='22023';
  end if;

  v_old_player:=v_event.player_id;
  if v_old_player=p_new_player_id then
    return iq_v21_private.snapshot(p_game_id);
  end if;

  perform iq_v58_private.apply_event_stat_delta(
    p_game_id,v_old_player,v_event.action_type,v_event.points,-1
  );
  perform iq_v58_private.apply_event_stat_delta(
    p_game_id,p_new_player_id,v_event.action_type,v_event.points,1
  );

  update public.game_events set player_id=p_new_player_id where id=p_event_id;

  insert into public.game_event_attribution_audit(
    game_id,event_id,old_player_id,new_player_id,action_type,actor_user_id,reason
  ) values (
    p_game_id,p_event_id,v_old_player,p_new_player_id,v_event.action_type,auth.uid(),
    nullif(trim(coalesce(p_reason,'')),'')
  );

  return iq_v21_private.snapshot(p_game_id);
end;
$$;

create or replace function public.iq_v58_reassign_game_event_player(
  p_game_id uuid,
  p_event_id uuid,
  p_new_player_id uuid,
  p_reason text default null
) returns jsonb
language sql
set search_path=''
as $$
  select iq_v58_private.reassign_game_event_player(
    p_game_id,p_event_id,p_new_player_id,p_reason
  );
$$;
revoke all on function public.iq_v58_reassign_game_event_player(uuid,uuid,uuid,text) from public;
grant execute on function public.iq_v58_reassign_game_event_player(uuid,uuid,uuid,text) to authenticated;
