-- =============================================================================
-- IQBasket · Core UX Completion V1 · Controlled BoxScore correction
-- =============================================================================
begin;

do $$
begin
  if to_regclass('public.games') is null
     or to_regclass('public.player_game_stats') is null
     or to_regprocedure('public.iq_v5_role_for_game(uuid)') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null then
    raise exception 'CORE_UX_BOXSCORE_PREREQUISITES_MISSING';
  end if;
end $$;

create table if not exists public.game_boxscore_corrections (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_id uuid not null,
  actor_role text not null,
  source_mode text not null,
  reason text,
  discrepancies jsonb not null default '[]'::jsonb,
  stats_payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint game_boxscore_corrections_source_check
    check (source_mode in ('PRIMARY_BOXSCORE','MANUAL_OVERRIDE'))
);

create index if not exists idx_game_boxscore_corrections_game_created
  on public.game_boxscore_corrections(game_id,created_at desc);

alter table public.game_boxscore_corrections enable row level security;

drop policy if exists iq_core_ux_boxscore_corrections_read
  on public.game_boxscore_corrections;
create policy iq_core_ux_boxscore_corrections_read
  on public.game_boxscore_corrections
  for select to authenticated
  using (
    exists (
      select 1 from public.games g
      where g.id=game_boxscore_corrections.game_id
        and public.iq_v5_can_access_team(g.team_id)
    )
  );

revoke all on table public.game_boxscore_corrections from anon;
revoke insert,update,delete,truncate,references,trigger
  on public.game_boxscore_corrections from authenticated;
grant select on public.game_boxscore_corrections to authenticated;

create or replace function public.iq_core_ux_can_edit_boxscore(
  p_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.games g
      join public.team_seasons ts on ts.id=g.team_season_id
      where g.id=p_game_id
        and upper(coalesce(g.edit_state,'OPEN'))='OPEN'
        and upper(coalesce(ts.data_status,'ACTIVE'))='ACTIVE'
        and public.iq_v5_role_for_game(g.id) in (
          'SUPERADMIN','ADMIN','ENTRENADOR','ANALISTA'
        )
    );
$$;

create or replace function public.iq_core_ux_save_boxscore_correction(
  p_game_id uuid,
  p_starter_ids jsonb,
  p_stats jsonb,
  p_reason text default null,
  p_source_mode text default 'PRIMARY_BOXSCORE',
  p_discrepancies jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_game public.games%rowtype;
  v_source_mode text := upper(trim(coalesce(p_source_mode,'PRIMARY_BOXSCORE')));
  v_event_count integer;
  v_total_points integer := 0;
  v_stat jsonb;
  v_player_id uuid;
  v_fg2m integer;
  v_fg2a integer;
  v_fg3m integer;
  v_fg3a integer;
  v_ftm integer;
  v_fta integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_core_ux_can_edit_boxscore(p_game_id) then
    raise exception 'BOXSCORE_EDIT_DENIED';
  end if;

  select * into v_game
  from public.games
  where id=p_game_id
  for update;

  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;

  if jsonb_typeof(coalesce(p_stats,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_starter_ids,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_discrepancies,'[]'::jsonb)) <> 'array' then
    raise exception 'BOXSCORE_PAYLOAD_INVALID';
  end if;

  if v_source_mode not in ('PRIMARY_BOXSCORE','MANUAL_OVERRIDE') then
    raise exception 'BOXSCORE_SOURCE_MODE_INVALID';
  end if;

  select count(*) into v_event_count
  from public.game_events ge
  where ge.game_id=p_game_id;

  if v_event_count > 0 and v_source_mode <> 'MANUAL_OVERRIDE' then
    raise exception 'BOXSCORE_EVENTS_REQUIRE_OVERRIDE_MODE';
  end if;

  if v_event_count > 0 and nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'BOXSCORE_OVERRIDE_REASON_REQUIRED';
  end if;

  if jsonb_array_length(coalesce(p_starter_ids,'[]'::jsonb)) > 5 then
    raise exception 'BOXSCORE_TOO_MANY_STARTERS';
  end if;

  for v_stat in
    select value from jsonb_array_elements(coalesce(p_stats,'[]'::jsonb))
  loop
    v_player_id := nullif(v_stat->>'player_id','')::uuid;
    if v_player_id is null then raise exception 'BOXSCORE_PLAYER_REQUIRED'; end if;

    if not public.iq_v3_player_eligible_on_date(
      v_player_id,
      v_game.team_season_id,
      v_game.date
    ) then
      raise exception 'PLAYER_NOT_ELIGIBLE_ON_GAME_DATE';
    end if;

    v_fg2m := coalesce(nullif(v_stat->>'fg2_made','')::integer,0);
    v_fg2a := coalesce(nullif(v_stat->>'fg2_attempted','')::integer,0);
    v_fg3m := coalesce(nullif(v_stat->>'fg3_made','')::integer,0);
    v_fg3a := coalesce(nullif(v_stat->>'fg3_attempted','')::integer,0);
    v_ftm := coalesce(nullif(v_stat->>'ft_made','')::integer,0);
    v_fta := coalesce(nullif(v_stat->>'ft_attempted','')::integer,0);

    if least(
      v_fg2m,v_fg2a,v_fg3m,v_fg3a,v_ftm,v_fta,
      coalesce(nullif(v_stat->>'minutes','')::integer,0),
      coalesce(nullif(v_stat->>'off_reb','')::integer,0),
      coalesce(nullif(v_stat->>'def_reb','')::integer,0),
      coalesce(nullif(v_stat->>'assists','')::integer,0),
      coalesce(nullif(v_stat->>'steals','')::integer,0),
      coalesce(nullif(v_stat->>'blocks_made','')::integer,0),
      coalesce(nullif(v_stat->>'turnovers','')::integer,0),
      coalesce(nullif(v_stat->>'fouls_committed','')::integer,0),
      coalesce(nullif(v_stat->>'fouls_drawn','')::integer,0)
    ) < 0 then
      raise exception 'BOXSCORE_NEGATIVE_VALUE';
    end if;

    if v_fg2m > v_fg2a or v_fg3m > v_fg3a or v_ftm > v_fta then
      raise exception 'BOXSCORE_MADE_EXCEEDS_ATTEMPTED';
    end if;

    v_total_points := v_total_points + (v_fg2m*2) + (v_fg3m*3) + v_ftm;

    insert into public.player_game_stats(
      game_id,player_id,starter,minutes,
      fg2_made,fg2_attempted,fg3_made,fg3_attempted,
      ft_made,ft_attempted,off_reb,def_reb,
      assists,steals,blocks,blocks_made,blocks_received,
      turnovers,fouls_committed,fouls_drawn,plus_minus,evaluation,points
    )
    values(
      p_game_id,
      v_player_id,
      coalesce((v_stat->>'starter')::boolean,false),
      coalesce(nullif(v_stat->>'minutes','')::numeric,0),
      v_fg2m,v_fg2a,v_fg3m,v_fg3a,v_ftm,v_fta,
      coalesce(nullif(v_stat->>'off_reb','')::integer,0),
      coalesce(nullif(v_stat->>'def_reb','')::integer,0),
      coalesce(nullif(v_stat->>'assists','')::integer,0),
      coalesce(nullif(v_stat->>'steals','')::integer,0),
      coalesce(nullif(v_stat->>'blocks_made','')::integer,0),
      coalesce(nullif(v_stat->>'blocks_made','')::integer,0),
      coalesce(nullif(v_stat->>'blocks_received','')::integer,0),
      coalesce(nullif(v_stat->>'turnovers','')::integer,0),
      coalesce(nullif(v_stat->>'fouls_committed','')::integer,0),
      coalesce(nullif(v_stat->>'fouls_drawn','')::integer,0),
      coalesce(nullif(v_stat->>'plus_minus','')::numeric,0),
      coalesce(nullif(v_stat->>'evaluation','')::numeric,0),
      (v_fg2m*2)+(v_fg3m*3)+v_ftm
    )
    on conflict (game_id,player_id)
    do update set
      starter=excluded.starter,
      minutes=excluded.minutes,
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
      plus_minus=excluded.plus_minus,
      evaluation=excluded.evaluation,
      points=excluded.points;
  end loop;

  if v_total_points <> coalesce(v_game.team_score,0) then
    raise exception 'BOXSCORE_TEAM_SCORE_MISMATCH expected=% actual=%',
      coalesce(v_game.team_score,0),v_total_points;
  end if;

  update public.games
  set starter_ids=coalesce(
    (select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_starter_ids,'[]'::jsonb))),
    '{}'::uuid[]
  )
  where id=p_game_id;

  insert into public.game_boxscore_corrections(
    game_id,actor_id,actor_role,source_mode,reason,discrepancies,stats_payload
  )
  values(
    p_game_id,
    auth.uid(),
    public.iq_v5_role_for_game(p_game_id),
    v_source_mode,
    nullif(trim(coalesce(p_reason,'')),''),
    coalesce(p_discrepancies,'[]'::jsonb),
    coalesce(p_stats,'[]'::jsonb)
  );

  return true;
end;
$$;

revoke all on function public.iq_core_ux_can_edit_boxscore(uuid) from public,anon;
revoke all on function public.iq_core_ux_save_boxscore_correction(
  uuid,jsonb,jsonb,text,text,jsonb
) from public,anon;
grant execute on function public.iq_core_ux_can_edit_boxscore(uuid) to authenticated;
grant execute on function public.iq_core_ux_save_boxscore_correction(
  uuid,jsonb,jsonb,text,text,jsonb
) to authenticated;

commit;
