-- =============================================================================
-- IQBasket Demo Universe V1 · Core sporting dataset
-- SYNTHETIC / TEST-ONLY / REVERSIBLE
--
-- Creates one isolated test season, team, 12 fictitious players and 12 completed
-- games with coherent boxscore, period, lineup and shot-location data.
-- Existing sporting data is never updated or deleted.
-- =============================================================================

begin;

-- Deterministic root fixture ids make rollback and verification unambiguous.
-- These ids are reserved exclusively for the synthetic demo universe.

do $demo$
begin
  if to_regclass('public.clubs') is null
     or to_regclass('public.teams') is null
     or to_regclass('public.seasons') is null
     or to_regclass('public.season_catalog') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.players') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.roster_membership_stints') is null
     or to_regclass('public.games') is null
     or to_regclass('public.player_game_stats') is null
     or to_regclass('public.team_game_stats') is null
     or to_regclass('public.game_period_scores') is null
     or to_regclass('public.lineup_game_stats') is null
     or to_regclass('public.game_events') is null then
    raise exception 'DEMO_V1_CORE_PREREQUISITES_MISSING';
  end if;

  if exists (
    select 1 from public.season_catalog
    where id='d0000000-0000-4000-8000-000000000004'::uuid
       or code='IQB-DEMO-2026-27-V1'
  ) or exists (
    select 1 from public.teams
    where id='d0000000-0000-4000-8000-000000000002'::uuid
  ) or exists (
    select 1 from public.clubs
    where id='d0000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'DEMO_V1_ALREADY_INSTALLED';
  end if;
end
$demo$;

-- -----------------------------------------------------------------------------
-- 1. Isolated demo club / team / season context
-- -----------------------------------------------------------------------------
insert into public.clubs(
  id,name,logo_url,created_by,phone,address,coordinator_name
) values (
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'IQBasket Demo Lab',
  null,
  null,
  null,
  'Entorno sintético de demostración',
  'Demo System'
);

insert into public.teams(
  id,club_id,name,category,competition,color,logo_url,
  periods_count,period_minutes,coach_name
) values (
  'd0000000-0000-4000-8000-000000000002'::uuid,
  'd0000000-0000-4000-8000-000000000001'::uuid,
  'IQBasket Showcase U18',
  'U18 Demo',
  'IQBasket Showcase League',
  '#1e3a8a',
  null,
  4,
  10,
  'Alex Demo'
);

insert into public.seasons(
  id,team_id,name,start_date,end_date,coach_name
) values (
  'd0000000-0000-4000-8000-000000000003'::uuid,
  'd0000000-0000-4000-8000-000000000002'::uuid,
  '2026/2027 · Demo',
  current_date - 120,
  current_date + 240,
  'Alex Demo'
);

insert into public.season_catalog(
  id,code,name,start_date,end_date,status,is_test
) values (
  'd0000000-0000-4000-8000-000000000004'::uuid,
  'IQB-DEMO-2026-27-V1',
  '2026/2027 · IQBasket Demo',
  current_date - 120,
  current_date + 240,
  'ACTIVE',
  true
);

insert into public.team_seasons(
  id,team_id,season_id,legacy_season_id,status,data_status
) values (
  'd0000000-0000-4000-8000-000000000005'::uuid,
  'd0000000-0000-4000-8000-000000000002'::uuid,
  'd0000000-0000-4000-8000-000000000004'::uuid,
  'd0000000-0000-4000-8000-000000000003'::uuid,
  'ACTIVE',
  'ACTIVE'
);

-- Read-only contextual scope for the existing INVITADO test account.
-- Global role remains INVITADO; ANALISTA is used only as a contextual read role.
insert into public.team_season_memberships(
  user_id,team_season_id,function_role,status,valid_from,valid_until
)
select
  up.id,
  'd0000000-0000-4000-8000-000000000005'::uuid,
  'ANALISTA',
  'ACTIVE',
  now() - interval '1 day',
  null
from public.user_profiles up
where lower(up.email)='test@test.com';

-- -----------------------------------------------------------------------------
-- 2. Fictitious roster
-- -----------------------------------------------------------------------------
insert into public.players(
  team_id,first_name,last_name,jersey,primary_position,secondary_positions,
  birth_date,height_cm,weight_kg,dominant_hand,joined_at,status,photo_url,notes,
  season_id
)
select
  'd0000000-0000-4000-8000-000000000002'::uuid,
  v.first_name,
  v.last_name,
  v.jersey,
  v.primary_position,
  v.secondary_positions,
  v.birth_date,
  v.height_cm,
  v.weight_kg,
  v.dominant_hand,
  (current_date - 110)::timestamptz,
  'Activo',
  null,
  'Jugador ficticio · IQBasket Demo Universe V1',
  'd0000000-0000-4000-8000-000000000003'::uuid
from (
  values
    ('Leo','Martín',4,'Base',array['Escolta']::text[],'2009-02-11'::date,181,72,'Derecha'),
    ('Nil','Costa',5,'Escolta',array['Base']::text[],'2009-05-23'::date,185,75,'Derecha'),
    ('Álex','Ferrer',7,'Alero',array['Escolta']::text[],'2009-01-18'::date,190,79,'Izquierda'),
    ('Marc','Vidal',8,'Ala-Pívot',array['Alero']::text[],'2008-11-07'::date,196,86,'Derecha'),
    ('Jan','Serra',10,'Pívot',array['Ala-Pívot']::text[],'2008-09-29'::date,202,94,'Derecha'),
    ('Pol','Roca',11,'Base',array['Escolta']::text[],'2009-07-03'::date,183,73,'Derecha'),
    ('Eric','Soler',12,'Alero',array['Ala-Pívot']::text[],'2009-03-15'::date,191,82,'Derecha'),
    ('Bruno','Casas',13,'Escolta',array['Alero']::text[],'2009-08-20'::date,188,77,'Izquierda'),
    ('Biel','Navarro',14,'Ala-Pívot',array['Pívot']::text[],'2008-12-12'::date,198,89,'Derecha'),
    ('Arnau','Puig',15,'Pívot',array['Ala-Pívot']::text[],'2008-10-02'::date,200,92,'Derecha'),
    ('Hugo','Rey',17,'Base',array['Escolta']::text[],'2009-06-10'::date,180,70,'Derecha'),
    ('Iker','Mora',21,'Alero',array['Ala-Pívot']::text[],'2009-04-27'::date,193,84,'Derecha')
) as v(first_name,last_name,jersey,primary_position,secondary_positions,birth_date,height_cm,weight_kg,dominant_hand);

insert into public.roster_memberships(
  player_id,team_season_id,jersey,primary_position,secondary_positions,
  status,joined_at,left_at
)
select
  p.id,
  'd0000000-0000-4000-8000-000000000005'::uuid,
  p.jersey,
  p.primary_position,
  p.secondary_positions,
  'ACTIVE',
  (current_date - 110)::timestamptz,
  null
from public.players p
where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid;

insert into public.roster_membership_stints(
  roster_membership_id,valid_from,valid_until,source,notes
)
select
  rm.id,
  current_date - 110,
  null,
  'DEMO_SEED',
  'Synthetic active stint · Demo Universe V1'
from public.roster_memberships rm
where rm.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- -----------------------------------------------------------------------------
-- 3. Twelve completed games ending two days before seed date
-- -----------------------------------------------------------------------------
insert into public.games(
  team_id,season_id,date,time,opponent,competition,round,venue,venue_name,
  periods_count,period_minutes,status,periods,team_score,opponent_score,
  observations,video_url,starter_ids,game_date,notes,opp_score,our_score,
  period_scores,quarter_scores_team,quarter_scores_opponent,has_overtime,
  overtime_count,events,team_season_id,edit_state,locked_at,locked_by,lock_reason
)
select
  'd0000000-0000-4000-8000-000000000002'::uuid,
  'd0000000-0000-4000-8000-000000000003'::uuid,
  current_date - (79 - (g.idx - 1) * 7),
  case when g.idx % 2 = 0 then '18:30' else '12:00' end,
  g.opponent,
  'IQBasket Showcase League',
  'Jornada ' || g.idx,
  case when g.idx % 2 = 1 then 'Local' else 'Visitante' end,
  case when g.idx % 2 = 1 then 'Demo Arena' else g.opponent || ' Court' end,
  4,
  10,
  'Finalizado',
  '[]'::jsonb,
  0,
  0,
  'Partido sintético para demostración y QA.',
  null,
  (
    select coalesce(jsonb_agg(p.id order by p.jersey),'[]'::jsonb)
    from (
      select id,jersey
      from public.players
      where team_id='d0000000-0000-4000-8000-000000000002'::uuid
      order by jersey
      limit 5
    ) p
  ),
  current_date - (79 - (g.idx - 1) * 7),
  'Demo Universe V1',
  0,
  0,
  '{}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  false,
  0,
  '[]'::jsonb,
  'd0000000-0000-4000-8000-000000000005'::uuid,
  case when g.idx <= 10 then 'LOCKED' else 'OPEN' end,
  case when g.idx <= 10 then now() - interval '1 day' else null end,
  case when g.idx <= 10 then (
    select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1
  ) else null end,
  case when g.idx <= 10 then 'Partido demo revisado y validado' else null end
from (
  values
    (1,'BC Marina Demo'),
    (2,'CB Vallès Demo'),
    (3,'Academy North Demo'),
    (4,'Basket Delta Demo'),
    (5,'Metro Hoops Demo'),
    (6,'Coast Academy Demo'),
    (7,'Urban Five Demo'),
    (8,'Riverside Demo'),
    (9,'Cantera Central Demo'),
    (10,'Blue Court Demo'),
    (11,'NextGen Basket Demo'),
    (12,'Capital Academy Demo')
) as g(idx,opponent);

-- -----------------------------------------------------------------------------
-- 4. Coherent player boxscores (12 x 12 = 144 rows)
-- -----------------------------------------------------------------------------
with ordered_games as (
  select g.id,g.date,
         row_number() over(order by g.date,g.id)::int as gi
  from public.games g
  where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
),
ordered_players as (
  select p.id,p.jersey,
         row_number() over(order by p.jersey,p.id)::int as pi
  from public.players p
  where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid
),
base as (
  select
    og.id as game_id,
    op.id as player_id,
    og.gi,
    op.pi,
    (array[31,29,28,27,25,18,15,12,8,4,3,0])[op.pi]::int as minutes
  from ordered_games og
  cross join ordered_players op
),
attempts as (
  select b.*,
    case when minutes=0 then 0 else greatest(1,(minutes/5) + ((pi+gi)%3)-1) end::int as fg2a,
    case when minutes<5 then 0 else greatest(0,(minutes/8) + ((pi*2+gi)%2)) end::int as fg3a,
    case when minutes=0 then 0 else greatest(0,(minutes/10) + ((pi+2*gi)%3)) end::int as fta
  from base b
),
makes as (
  select a.*,
    least(fg2a,floor(fg2a * (0.43 + ((pi+gi)%5)*0.03))::int) as fg2m,
    least(fg3a,floor(fg3a * (0.28 + ((pi+gi)%4)*0.04))::int) as fg3m,
    least(fta,floor(fta * (0.70 + ((pi+gi)%4)*0.05))::int) as ftm
  from attempts a
),
box as (
  select m.*,
    (2*fg2m + 3*fg3m + ftm)::int as pts,
    case when minutes=0 then 0 else greatest(0,(minutes/15) + case when pi in (5,9,10) then 1 else 0 end) end::int as oreb,
    case when minutes=0 then 0 else greatest(0,(minutes/8) + ((pi+gi)%2)) end::int as dreb,
    case when minutes=0 then 0 else greatest(0,(minutes/8) + case when pi in (1,2,6,11) then 2 else 0 end - ((gi+pi)%2)) end::int as ast,
    case when minutes=0 then 0 else (minutes/18 + ((pi+gi)%2))::int end as stl,
    case when minutes=0 then 0 else (case when pi in (4,5,9,10) then minutes/18 else minutes/35 end)::int end as blk,
    case when minutes=0 then 0 else greatest(0,minutes/13 + ((pi+gi)%2))::int end as tov,
    case when minutes=0 then 0 else greatest(0,minutes/12 + ((pi+2*gi)%2))::int end as pf
  from makes m
)
insert into public.player_game_stats(
  game_id,player_id,starter,minutes,
  fg2_made,fg2_attempted,fg3_made,fg3_attempted,ft_made,ft_attempted,
  off_reb,def_reb,assists,steals,blocks,turnovers,fouls_committed,
  fouls_drawn,plus_minus,blocks_made,blocks_received,evaluation,
  fouls_received,points,rebounds_defensive,rebounds_offensive,
  fg_rim_made,fg_rim_attempted,fg_mid_made,fg_mid_attempted,
  fg_corner3_made,fg_corner3_attempted,assisted_fg_made,potential_assists,
  secondary_assists,drives,paint_touches,deflections,charges_drawn,
  contested_rebounds,box_outs,game_score,offensive_rating,defensive_rating,
  true_shooting_pct,efg_pct,usage_pct
)
select
  game_id,player_id,pi<=5,minutes,
  fg2m,fg2a,fg3m,fg3a,ftm,fta,
  oreb,dreb,ast,stl,blk,tov,pf,
  greatest(0,pf-1),0,blk,greatest(0,(pi+gi)%2),
  (pts + oreb + dreb + ast + stl + blk - tov - greatest(0,fg2a-fg2m) - greatest(0,fg3a-fg3m))::int,
  greatest(0,pf-1),pts,dreb,oreb,
  least(fg2m,greatest(0,fg2m-1)),least(fg2a,greatest(0,fg2a-1)),
  greatest(0,fg2m - least(fg2m,greatest(0,fg2m-1))),
  greatest(0,fg2a - least(fg2a,greatest(0,fg2a-1))),
  least(fg3m,case when fg3a>0 then 1 else 0 end),
  least(fg3a,case when fg3a>0 then 1 else 0 end),
  greatest(0,(fg2m+fg3m)*2/3),
  ast + ((pi+gi)%3),
  case when ast>=3 then 1 else 0 end,
  case when minutes=0 then 0 else minutes/7 end,
  case when minutes=0 then 0 else minutes/6 end,
  stl + ((pi+gi)%2),
  case when pi in (4,5,9,10) and minutes>=15 and (pi+gi)%5=0 then 1 else 0 end,
  greatest(0,oreb+dreb-1),
  case when pi in (4,5,9,10) then greatest(0,minutes/10) else greatest(0,minutes/20) end,
  round((pts + 0.7*(oreb+dreb) + 0.7*ast + stl + blk - 0.7*tov)::numeric,2),
  case when minutes=0 then 0 else round((96 + pts*1.4 - tov*1.8)::numeric,2) end,
  case when minutes=0 then 0 else round((101 - stl*1.4 - blk*1.2 + pf*0.4)::numeric,2) end,
  case when (2*(fg2a+fg3a+0.44*fta))>0
       then round((pts::numeric / (2*(fg2a+fg3a+0.44*fta))) * 100,2)
       else 0 end,
  case when (fg2a+fg3a)>0
       then round((((fg2m+fg3m)+0.5*fg3m)::numeric/(fg2a+fg3a))*100,2)
       else 0 end,
  case when minutes=0 then 0 else round((14 + (fg2a+fg3a+fta+tov)*0.55)::numeric,2) end
from box;

-- Final scores derived from player scoring. A fixed margin pattern creates a
-- realistic mix of wins/losses without breaking internal score consistency.
with game_totals as (
  select g.id,
         row_number() over(order by g.date,g.id)::int as gi,
         sum(pgs.points)::int as team_points
  from public.games g
  join public.player_game_stats pgs on pgs.game_id=g.id
  where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  group by g.id,g.date
),
scored as (
  select gt.*,
    (array[8,-5,3,11,-2,7,-9,4,14,-1,6,-6])[gi]::int as margin
  from game_totals gt
)
update public.games g
set team_score=s.team_points,
    opponent_score=greatest(45,s.team_points-s.margin),
    our_score=s.team_points,
    opp_score=greatest(45,s.team_points-s.margin)
from scored s
where g.id=s.id;

-- Plus/minus after the definitive game margin exists.
with ordered_players as (
  select id,row_number() over(order by jersey,id)::int as pi
  from public.players
  where team_id='d0000000-0000-4000-8000-000000000002'::uuid
)
update public.player_game_stats pgs
set plus_minus=round(
      ((g.team_score-g.opponent_score) * (pgs.minutes::numeric/40.0))
      + (((op.pi % 3)-1) * 1.5)
    )::int
from public.games g, ordered_players op
where pgs.game_id=g.id
  and pgs.player_id=op.id
  and g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- -----------------------------------------------------------------------------
-- 5. Team totals and advanced team metrics
-- -----------------------------------------------------------------------------
insert into public.team_game_stats(
  game_id,opp_fg_attempted,opp_ft_attempted,opp_off_reb,opp_def_reb,
  opp_turnovers,opp_off_reb_allowed,assists,steals,turnovers,blocks_made,
  blocks_received,evaluation,fg2_made,fg2_attempted,fg3_made,fg3_attempted,
  ft_made,ft_attempted,rebounds_defensive,rebounds_offensive,period_scores,
  points,opp_points,opp_fg_made,opp_fg2_made,opp_fg2_attempted,
  opp_fg3_made,opp_fg3_attempted,opp_ft_made,second_chance_points,
  fast_break_points,paint_points,opp_paint_points,blob_points,blob_possessions,
  slob_points,slob_possessions,ato_points,ato_possessions,
  estimated_possessions,pace,ortg,drtg,net_rating,efg
)
select
  g.id,
  greatest(45,round((g.opponent_score*0.86)::numeric)::int),
  greatest(8,round((g.opponent_score*0.22)::numeric)::int),
  9 + (row_number() over(order by g.date)::int % 5),
  20 + (row_number() over(order by g.date)::int % 7),
  11 + (row_number() over(order by g.date)::int % 6),
  9 + (row_number() over(order by g.date)::int % 5),
  sum(p.assists)::int,
  sum(p.steals)::int,
  sum(p.turnovers)::int,
  sum(p.blocks_made)::int,
  sum(p.blocks_received)::int,
  sum(p.evaluation)::int,
  sum(p.fg2_made)::int,
  sum(p.fg2_attempted)::int,
  sum(p.fg3_made)::int,
  sum(p.fg3_attempted)::int,
  sum(p.ft_made)::int,
  sum(p.ft_attempted)::int,
  sum(p.def_reb)::int,
  sum(p.off_reb)::int,
  '{}'::jsonb,
  g.team_score,
  g.opponent_score,
  greatest(18,round((g.opponent_score/2.25)::numeric)::int),
  greatest(12,round((g.opponent_score*0.28)::numeric)::int),
  greatest(28,round((g.opponent_score*0.55)::numeric)::int),
  greatest(4,round((g.opponent_score*0.10)::numeric)::int),
  greatest(14,round((g.opponent_score*0.31)::numeric)::int),
  greatest(6,round((g.opponent_score*0.12)::numeric)::int),
  8 + (row_number() over(order by g.date)::int % 7),
  10 + (row_number() over(order by g.date)::int % 9),
  24 + (row_number() over(order by g.date)::int % 12),
  22 + (row_number() over(order by g.date)::int % 13),
  4 + (row_number() over(order by g.date)::int % 7),
  5 + (row_number() over(order by g.date)::int % 4),
  5 + (row_number() over(order by g.date)::int % 6),
  6 + (row_number() over(order by g.date)::int % 4),
  3 + (row_number() over(order by g.date)::int % 5),
  4 + (row_number() over(order by g.date)::int % 3),
  round((sum(p.fg2_attempted+p.fg3_attempted) + 0.44*sum(p.ft_attempted) - sum(p.off_reb) + sum(p.turnovers))::numeric,2),
  round((sum(p.fg2_attempted+p.fg3_attempted) + 0.44*sum(p.ft_attempted) - sum(p.off_reb) + sum(p.turnovers))::numeric,2),
  round((100*g.team_score / nullif((sum(p.fg2_attempted+p.fg3_attempted) + 0.44*sum(p.ft_attempted) - sum(p.off_reb) + sum(p.turnovers)),0))::numeric,2),
  round((100*g.opponent_score / nullif((sum(p.fg2_attempted+p.fg3_attempted) + 0.44*sum(p.ft_attempted) - sum(p.off_reb) + sum(p.turnovers)),0))::numeric,2),
  round((100*(g.team_score-g.opponent_score) / nullif((sum(p.fg2_attempted+p.fg3_attempted) + 0.44*sum(p.ft_attempted) - sum(p.off_reb) + sum(p.turnovers)),0))::numeric,2),
  round((100*(sum(p.fg2_made+p.fg3_made)+0.5*sum(p.fg3_made)) / nullif(sum(p.fg2_attempted+p.fg3_attempted),0))::numeric,2)
from public.games g
join public.player_game_stats p on p.game_id=g.id
where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
group by g.id,g.date,g.team_score,g.opponent_score;

-- -----------------------------------------------------------------------------
-- 6. Period scores and game JSON period mirrors
-- -----------------------------------------------------------------------------
with split as (
  select g.id,g.team_score,g.opponent_score,
    floor(g.team_score*0.24)::int as t1,
    floor(g.team_score*0.26)::int as t2,
    floor(g.team_score*0.23)::int as t3,
    floor(g.opponent_score*0.25)::int as o1,
    floor(g.opponent_score*0.24)::int as o2,
    floor(g.opponent_score*0.26)::int as o3
  from public.games g
  where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
),
quarters as (
  select id,1 as q,t1 as ts,o1 as os from split
  union all select id,2,t2,o2 from split
  union all select id,3,t3,o3 from split
  union all select id,4,team_score-t1-t2-t3,opponent_score-o1-o2-o3 from split
)
insert into public.game_period_scores(
  game_id,period_type,period_number,team_score,opponent_score,is_overtime
)
select id,'quarter',q,ts,os,false
from quarters;

update public.games g
set quarter_scores_team=q.team_q,
    quarter_scores_opponent=q.opp_q,
    periods=q.periods,
    period_scores=q.period_scores
from (
  select gps.game_id,
    jsonb_agg(gps.team_score order by gps.period_number) as team_q,
    jsonb_agg(gps.opponent_score order by gps.period_number) as opp_q,
    jsonb_agg(jsonb_build_object(
      'period_type',gps.period_type,
      'period_number',gps.period_number,
      'team_score',gps.team_score,
      'opponent_score',gps.opponent_score,
      'is_overtime',gps.is_overtime
    ) order by gps.period_number) as periods,
    jsonb_object_agg('Q'||gps.period_number,
      jsonb_build_object('team',gps.team_score,'opponent',gps.opponent_score)
    ) as period_scores
  from public.game_period_scores gps
  join public.games gg on gg.id=gps.game_id
  where gg.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  group by gps.game_id
) q
where g.id=q.game_id;

update public.team_game_stats tgs
set period_scores=g.period_scores
from public.games g
where tgs.game_id=g.id
  and g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- -----------------------------------------------------------------------------
-- 7. Three useful lineup samples per game
-- -----------------------------------------------------------------------------
with roster as (
  select id,jersey,row_number() over(order by jersey,id)::int as pi
  from public.players
  where team_id='d0000000-0000-4000-8000-000000000002'::uuid
),
lineup_sets as (
  select 1 as unit,array[1,2,3,4,5]::int[] as slots,1200 as seconds,0.50::numeric as share
  union all select 2,array[2,3,6,7,9]::int[],720,0.30::numeric
  union all select 3,array[1,4,5,8,10]::int[],480,0.20::numeric
),
games as (
  select id,team_score,opponent_score
  from public.games
  where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
)
insert into public.lineup_game_stats(
  game_id,player_ids,seconds_played,points_for,points_against,possessions,plus_minus
)
select
  g.id,
  (
    select jsonb_agg(r.id order by r.pi)
    from roster r
    where r.pi=any(ls.slots)
  ),
  ls.seconds,
  round(g.team_score*ls.share)::int,
  round(g.opponent_score*ls.share)::int,
  round((72 + ls.unit*2)*ls.share,2),
  round((g.team_score-g.opponent_score)*ls.share)::int
from games g
cross join lineup_sets ls;

-- -----------------------------------------------------------------------------
-- 8. Synthetic shot-location events consistent with each player's attempts
-- -----------------------------------------------------------------------------
with pgs as (
  select
    p.game_id,p.player_id,p.fg2_attempted,p.fg2_made,p.fg3_attempted,p.fg3_made,
    row_number() over(partition by p.game_id order by pl.jersey)::int as pi
  from public.player_game_stats p
  join public.players pl on pl.id=p.player_id
  join public.games g on g.id=p.game_id
  where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
),
shots2 as (
  select p.game_id,p.player_id,p.pi,s.n,
    'fg2_attempted'::varchar as action_type,
    2 as shot_points,
    (s.n <= p.fg2_made) as made,
    round((18 + ((p.pi*13+s.n*17)%64))::numeric,2) as x,
    round((8 + ((p.pi*19+s.n*11)%50))::numeric,2) as y
  from pgs p
  cross join lateral generate_series(1,p.fg2_attempted) s(n)
),
shots3 as (
  select p.game_id,p.player_id,p.pi,s.n,
    'fg3_attempted'::varchar as action_type,
    3 as shot_points,
    (s.n <= p.fg3_made) as made,
    round((8 + ((p.pi*23+s.n*19)%84))::numeric,2) as x,
    round((55 + ((p.pi*7+s.n*13)%38))::numeric,2) as y
  from pgs p
  cross join lateral generate_series(1,p.fg3_attempted) s(n)
),
all_shots as (
  select * from shots2
  union all
  select * from shots3
),
numbered as (
  select a.*,
    row_number() over(partition by a.game_id order by a.pi,a.action_type,a.n)::int as seq
  from all_shots a
)
insert into public.game_events(
  game_id,player_id,team_id,period,game_clock,action_type,points,made,
  coord_x,coord_y,shot_zone,created_by
)
select
  n.game_id,
  n.player_id,
  'd0000000-0000-4000-8000-000000000002'::uuid,
  1 + ((n.seq-1)%4),
  lpad((9-((n.seq-1)%9))::text,2,'0') || ':' || lpad(((n.seq*7)%60)::text,2,'0'),
  n.action_type,
  case when n.made then n.shot_points else 0 end,
  n.made,
  n.x,
  n.y,
  case
    when n.action_type='fg3_attempted' then '3PT'
    when n.y<25 then 'RIM'
    else 'MID'
  end,
  null
from numbered n;

-- Lightweight play-by-play projection for the live timeline.
insert into public.play_by_play_events(
  game_id,player_id,period,game_clock,event_type,shot_type,points,
  is_assisted,assistant_id,play_type,lineup_ids
)
select
  ge.game_id,
  ge.player_id,
  ge.period::varchar,
  ge.game_clock,
  ge.action_type,
  case when ge.action_type='fg3_attempted' then '3PT' else '2PT' end,
  ge.points,
  ge.made and ((extract(epoch from ge.created_at)::bigint + ge.period) % 3 = 0),
  null,
  case when ge.made then 'HALF_COURT' else 'SHOT_ATTEMPT' end,
  null
from public.game_events ge
join public.games g on g.id=ge.game_id
where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

-- Persist season PPG on the demo player master rows for legacy-compatible cards.
update public.players p
set ppg=s.avg_points
from (
  select pgs.player_id,round(avg(pgs.points)::numeric,1) as avg_points
  from public.player_game_stats pgs
  join public.games g on g.id=pgs.game_id
  where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  group by pgs.player_id
) s
where p.id=s.player_id;

commit;

select
  'DEMO_V1_CORE_APPLY' as marker,
  (select count(*) from public.players where team_id='d0000000-0000-4000-8000-000000000002'::uuid) as players,
  (select count(*) from public.games where team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as games,
  (select count(*) from public.player_game_stats pgs join public.games g on g.id=pgs.game_id where g.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid) as player_game_stats;
