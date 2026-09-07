-- IQBasket V30.1 · Quick capture capability isolation
-- RECORD_QUICK_GAME may write the quick-capture subset, but never implies RECORD_LIVE_GAME.
begin;

create or replace function iq_v21_private.has_capability(p_game_id uuid,p_capability text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1
      from public.game_capture_delegations d
      where d.game_id=p_game_id
        and d.delegate_user_id=auth.uid()
        and d.capability=upper(trim(coalesce(p_capability,'')))
        and d.revoked_at is null
        and d.valid_from<=now()
        and d.valid_until>now()
    );
$function$;

-- The single-writer lease is shared by live and quick capture, but possession of
-- that lease does not authorize a broader write: save_capture remains capability-aware.
create or replace function iq_v28_private.can_record(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and public.iq_account_is_active()
    and exists (
      select 1
      from public.games g
      where g.id=p_game_id
        and upper(coalesce(g.edit_state,'OPEN'))='OPEN'
        and not exists (
          select 1
          from public.team_seasons ts
          where ts.id=g.team_season_id
            and upper(coalesce(ts.data_status,'ACTIVE'))<>'ACTIVE'
        )
        and (
          iq_private.can_mutate_game(p_game_id)
          or iq_v21_private.has_capability(p_game_id,'RECORD_LIVE_GAME')
          or iq_v21_private.has_capability(p_game_id,'RECORD_QUICK_GAME')
        )
    );
$function$;

create or replace function iq_v21_private.save_capture(
  p_game_id uuid,
  p_team_score integer default null,
  p_opponent_score integer default null,
  p_starter_ids uuid[] default null,
  p_stats jsonb default null,
  p_periods jsonb default null,
  p_events jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_game public.games%rowtype;
  v_item jsonb;
  v_player_id uuid;
  v_can_live boolean;
  v_can_quick boolean;
  v_can_boxscore boolean;
  v_stats_count integer:=0;
  v_periods_count integer:=0;
  v_events_count integer:=0;
  v_period_number integer;
  v_is_overtime boolean;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;

  select * into v_game from public.games where id=p_game_id;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if upper(coalesce(v_game.edit_state,'OPEN'))<>'OPEN' then
    raise exception 'GAME_CAPTURE_GAME_LOCKED' using errcode='42501';
  end if;
  if exists (
    select 1 from public.team_seasons ts
    where ts.id=v_game.team_season_id
      and upper(coalesce(ts.data_status,'ACTIVE'))<>'ACTIVE'
  ) then
    raise exception 'GAME_CAPTURE_SEASON_FROZEN' using errcode='42501';
  end if;

  v_can_live:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'RECORD_LIVE_GAME');
  v_can_quick:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'RECORD_QUICK_GAME');
  v_can_boxscore:=iq_private.can_mutate_game(p_game_id)
    or iq_v21_private.has_capability(p_game_id,'EDIT_BOXSCORE');

  if not v_can_live and not v_can_quick and not v_can_boxscore then
    raise exception 'GAME_CAPTURE_WRITE_DENIED' using errcode='42501';
  end if;

  -- Quick capture is intentionally narrower than live capture.
  if (p_team_score is not null or p_opponent_score is not null or p_events is not null)
     and not (v_can_live or v_can_quick) then
    raise exception 'GAME_CAPTURE_SCORE_EVENT_PERMISSION_REQUIRED' using errcode='42501';
  end if;
  if p_periods is not null and not v_can_live then
    raise exception 'GAME_CAPTURE_LIVE_PERMISSION_REQUIRED' using errcode='42501';
  end if;
  if p_starter_ids is not null and not (v_can_live or v_can_boxscore) then
    raise exception 'GAME_CAPTURE_STARTERS_PERMISSION_REQUIRED' using errcode='42501';
  end if;

  if p_starter_ids is not null then
    if cardinality(p_starter_ids)>5 then
      raise exception 'GAME_CAPTURE_STARTERS_LIMIT_EXCEEDED';
    end if;
    foreach v_player_id in array p_starter_ids loop
      if not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE';
      end if;
    end loop;
  end if;

  update public.games
  set team_score=coalesce(p_team_score,team_score),
      opponent_score=coalesce(p_opponent_score,opponent_score),
      starter_ids=case when p_starter_ids is null then starter_ids else to_jsonb(p_starter_ids) end
  where id=p_game_id;

  if p_stats is not null then
    if jsonb_typeof(p_stats)<>'array' then
      raise exception 'GAME_CAPTURE_STATS_ARRAY_REQUIRED';
    end if;
    for v_item in select value from jsonb_array_elements(p_stats) loop
      v_player_id:=nullif(v_item->>'player_id','')::uuid;
      if v_player_id is null or not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE';
      end if;

      insert into public.player_game_stats(
        game_id,player_id,starter,minutes,points,
        fg2_made,fg2_attempted,fg3_made,fg3_attempted,
        ft_made,ft_attempted,off_reb,def_reb,assists,steals,
        blocks,blocks_made,blocks_received,turnovers,
        fouls_committed,fouls_drawn,plus_minus
      ) values (
        p_game_id,v_player_id,coalesce((v_item->>'starter')::boolean,false),
        greatest(coalesce((v_item->>'minutes')::integer,0),0),
        greatest(coalesce((v_item->>'points')::integer,0),0),
        greatest(coalesce((v_item->>'fg2_made')::integer,0),0),
        greatest(coalesce((v_item->>'fg2_attempted')::integer,0),0),
        greatest(coalesce((v_item->>'fg3_made')::integer,0),0),
        greatest(coalesce((v_item->>'fg3_attempted')::integer,0),0),
        greatest(coalesce((v_item->>'ft_made')::integer,0),0),
        greatest(coalesce((v_item->>'ft_attempted')::integer,0),0),
        greatest(coalesce((v_item->>'off_reb')::integer,0),0),
        greatest(coalesce((v_item->>'def_reb')::integer,0),0),
        greatest(coalesce((v_item->>'assists')::integer,0),0),
        greatest(coalesce((v_item->>'steals')::integer,0),0),
        greatest(coalesce((v_item->>'blocks')::integer,0),0),
        greatest(coalesce((v_item->>'blocks_made')::integer,0),0),
        greatest(coalesce((v_item->>'blocks_received')::integer,0),0),
        greatest(coalesce((v_item->>'turnovers')::integer,0),0),
        greatest(coalesce((v_item->>'fouls_committed')::integer,0),0),
        greatest(coalesce((v_item->>'fouls_drawn')::integer,0),0),
        coalesce((v_item->>'plus_minus')::integer,0)
      )
      on conflict (game_id,player_id) do update set
        starter=excluded.starter,
        minutes=excluded.minutes,
        points=excluded.points,
        fg2_made=excluded.fg2_made,
        fg2_attempted=excluded.fg2_attempted,
        fg3_made=excluded.fg3_made,
        fg3_attempted=excluded.fg3_attempted,
        ft_made=excluded.ft_made,
        ft_attempted=excluded.ft_attempted,
        off_reb=excluded.off_reb,
        def_reb=excluded.def_reb,
        assists=excluded.assists,
        steals=excluded.steals,
        blocks=excluded.blocks,
        blocks_made=excluded.blocks_made,
        blocks_received=excluded.blocks_received,
        turnovers=excluded.turnovers,
        fouls_committed=excluded.fouls_committed,
        fouls_drawn=excluded.fouls_drawn,
        plus_minus=excluded.plus_minus;
      v_stats_count:=v_stats_count+1;
    end loop;
  end if;

  if p_periods is not null then
    if jsonb_typeof(p_periods)<>'array' then
      raise exception 'GAME_CAPTURE_PERIODS_ARRAY_REQUIRED';
    end if;
    delete from public.game_period_scores where game_id=p_game_id;
    for v_item in select value from jsonb_array_elements(p_periods) loop
      v_is_overtime:=coalesce((v_item->>'is_overtime')::boolean,false);
      v_period_number:=greatest(coalesce((v_item->>'period_number')::integer,1),1);
      if v_is_overtime and v_period_number<=v_game.periods_count then
        v_period_number:=v_game.periods_count+v_period_number;
      end if;
      insert into public.game_period_scores(
        game_id,period_type,period_number,team_score,opponent_score,is_overtime
      ) values (
        p_game_id,
        case when v_is_overtime then 'overtime' else coalesce(nullif(v_item->>'period_type',''),'quarter') end,
        v_period_number,
        greatest(coalesce((v_item->>'team_score')::integer,0),0),
        greatest(coalesce((v_item->>'opponent_score')::integer,0),0),
        v_is_overtime
      );
      v_periods_count:=v_periods_count+1;
    end loop;
    update public.games
    set periods=p_periods,
        has_overtime=exists(select 1 from public.game_period_scores ps where ps.game_id=p_game_id and ps.is_overtime),
        overtime_count=(select count(*) from public.game_period_scores ps where ps.game_id=p_game_id and ps.is_overtime)
    where id=p_game_id;
  end if;

  if p_events is not null then
    if jsonb_typeof(p_events)<>'array' then
      raise exception 'GAME_CAPTURE_EVENTS_ARRAY_REQUIRED';
    end if;
    delete from public.game_events where game_id=p_game_id;
    for v_item in select value from jsonb_array_elements(p_events) loop
      v_player_id:=nullif(v_item->>'player_id','')::uuid;
      if v_player_id is not null and not iq_v21_private.player_eligible(p_game_id,v_player_id) then
        raise exception 'GAME_CAPTURE_PLAYER_NOT_ELIGIBLE';
      end if;
      if nullif(trim(coalesce(v_item->>'action_type','')),'') is null then
        raise exception 'GAME_CAPTURE_ACTION_TYPE_REQUIRED';
      end if;
      insert into public.game_events(
        id,game_id,player_id,team_id,period,game_clock,action_type,
        points,made,coord_x,coord_y,created_by
      ) values (
        gen_random_uuid(),p_game_id,v_player_id,v_game.team_id,
        greatest(coalesce((v_item->>'period')::integer,1),1),
        coalesce(nullif(v_item->>'game_clock',''),'10:00'),
        trim(v_item->>'action_type'),
        greatest(coalesce((v_item->>'points')::integer,0),0),
        coalesce((v_item->>'made')::boolean,false),
        case when v_item ? 'coord_x' and v_item->>'coord_x'<>'' then (v_item->>'coord_x')::numeric else null end,
        case when v_item ? 'coord_y' and v_item->>'coord_y'<>'' then (v_item->>'coord_y')::numeric else null end,
        auth.uid()
      );
      v_events_count:=v_events_count+1;
    end loop;
  end if;

  insert into public.game_capture_write_audit(game_id,actor_user_id,stats_count,periods_count,events_count)
  values (p_game_id,auth.uid(),v_stats_count,v_periods_count,v_events_count);

  return iq_v21_private.snapshot(p_game_id);
end
$function$;

commit;