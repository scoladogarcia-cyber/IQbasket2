-- =============================================================================
-- IQBasket v3 · PRE-FLIGHT PHASE 3C (READ ONLY)
-- Date: 2026-09-02
--
-- Run this BEFORE 20260902_apply_v3_phase3c_season_roster_backend.sql.
-- It performs SELECT-only diagnostics. It does not create/update/delete data.
--
-- PASS CRITERIA
-- 1) All REQUIRED_OBJECTS rows => present = true
-- 2) missing_roster_membership_for_stats = 0
-- 3) missing_roster_membership_for_events = 0
-- 4) stats_outside_inferred_interval = 0
-- 5) events_outside_inferred_interval = 0
-- 6) joined_after_left = 0
--
-- Any non-zero blocker must be corrected before applying Phase 3C.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Required objects
-- -----------------------------------------------------------------------------
with required_objects(kind, object_name, present) as (
  values
    ('table', 'public.roster_memberships',
      to_regclass('public.roster_memberships') is not null),
    ('table', 'public.team_seasons',
      to_regclass('public.team_seasons') is not null),
    ('table', 'public.season_catalog',
      to_regclass('public.season_catalog') is not null),
    ('table', 'public.players',
      to_regclass('public.players') is not null),
    ('table', 'public.games',
      to_regclass('public.games') is not null),
    ('table', 'public.player_game_stats',
      to_regclass('public.player_game_stats') is not null),
    ('table', 'public.game_events',
      to_regclass('public.game_events') is not null),
    ('function', 'public.iq_v3_can_read_team_season(uuid)',
      to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is not null),
    ('function', 'public.iq_v3_can_manage_team_season(uuid)',
      to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null)
)
select
  'REQUIRED_OBJECTS' as section,
  kind,
  object_name,
  present
from required_objects
order by kind, object_name;

-- -----------------------------------------------------------------------------
-- B. Current cardinalities / mapping coverage
-- -----------------------------------------------------------------------------
select
  'COUNTS' as section,
  (select count(*) from public.players) as players,
  (select count(*) from public.games) as games,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events,
  (select count(*) from public.team_seasons) as team_seasons,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.games where team_season_id is null) as games_without_team_season,
  (
    select count(*)
    from public.player_game_stats pgs
    join public.games g on g.id = pgs.game_id
    where g.team_season_id is null
  ) as stats_on_games_without_team_season,
  (
    select count(*)
    from public.game_events ge
    join public.games g on g.id = ge.game_id
    where ge.player_id is not null
      and g.team_season_id is null
  ) as player_events_on_games_without_team_season;

-- -----------------------------------------------------------------------------
-- C. Membership date sanity
-- -----------------------------------------------------------------------------
select
  'MEMBERSHIP_DATE_SANITY' as section,
  count(*) filter (
    where joined_at is not null
      and left_at is not null
      and joined_at::date > left_at::date
  ) as joined_after_left,
  count(*) filter (
    where joined_at is not null
      and joined_at::date < sc.start_date
  ) as joined_before_season_start,
  count(*) filter (
    where joined_at is not null
      and joined_at::date > sc.end_date
  ) as joined_after_season_end,
  count(*) filter (
    where left_at is not null
      and left_at::date < sc.start_date
  ) as left_before_season_start,
  count(*) filter (
    where left_at is not null
      and left_at::date > sc.end_date
  ) as left_after_season_end
from public.roster_memberships rm
join public.team_seasons ts on ts.id = rm.team_season_id
join public.season_catalog sc on sc.id = ts.season_id;

-- -----------------------------------------------------------------------------
-- D. Statistical/event truth that has no roster membership at all.
-- These are hard blockers because eligibility would necessarily be false.
-- -----------------------------------------------------------------------------
select
  'MISSING_MEMBERSHIPS' as section,
  (
    select count(*)
    from public.player_game_stats pgs
    join public.games g on g.id = pgs.game_id
    where g.team_season_id is not null
      and not exists (
        select 1
        from public.roster_memberships rm
        where rm.player_id = pgs.player_id
          and rm.team_season_id = g.team_season_id
      )
  ) as missing_roster_membership_for_stats,
  (
    select count(*)
    from public.game_events ge
    join public.games g on g.id = ge.game_id
    where ge.player_id is not null
      and g.team_season_id is not null
      and not exists (
        select 1
        from public.roster_memberships rm
        where rm.player_id = ge.player_id
          and rm.team_season_id = g.team_season_id
      )
  ) as missing_roster_membership_for_events;

-- -----------------------------------------------------------------------------
-- E. Reproduce the exact Phase-3C inferred interval without writing it.
-- -----------------------------------------------------------------------------
with inferred as (
  select
    rm.id as roster_membership_id,
    rm.player_id,
    rm.team_season_id,
    coalesce(
      least(
        rm.joined_at::date,
        (
          select min(g.date)::date
          from public.player_game_stats pgs
          join public.games g on g.id = pgs.game_id
          where pgs.player_id = rm.player_id
            and g.team_season_id = rm.team_season_id
        ),
        (
          select min(geg.date)::date
          from public.game_events ge
          join public.games geg on geg.id = ge.game_id
          where ge.player_id = rm.player_id
            and geg.team_season_id = rm.team_season_id
        )
      ),
      (
        select min(g2.date)::date
        from public.games g2
        where g2.team_season_id = rm.team_season_id
      ),
      sc.start_date,
      rm.created_at::date
    ) as valid_from,
    case
      when rm.left_at is null then null
      else greatest(
        rm.left_at::date,
        (
          select max(g3.date)::date
          from public.player_game_stats pgs3
          join public.games g3 on g3.id = pgs3.game_id
          where pgs3.player_id = rm.player_id
            and g3.team_season_id = rm.team_season_id
        ),
        (
          select max(geg2.date)::date
          from public.game_events ge2
          join public.games geg2 on geg2.id = ge2.game_id
          where ge2.player_id = rm.player_id
            and geg2.team_season_id = rm.team_season_id
        )
      )
    end as valid_until
  from public.roster_memberships rm
  join public.team_seasons ts on ts.id = rm.team_season_id
  join public.season_catalog sc on sc.id = ts.season_id
),
stats_blockers as (
  select
    pgs.player_id,
    g.team_season_id,
    g.id as game_id,
    g.date::date as game_date
  from public.player_game_stats pgs
  join public.games g on g.id = pgs.game_id
  left join inferred i
    on i.player_id = pgs.player_id
   and i.team_season_id = g.team_season_id
  where g.team_season_id is not null
    and (
      i.roster_membership_id is null
      or i.valid_from is null
      or g.date::date < i.valid_from
      or (i.valid_until is not null and g.date::date > i.valid_until)
    )
),
event_blockers as (
  select
    ge.player_id,
    g.team_season_id,
    g.id as game_id,
    g.date::date as game_date
  from public.game_events ge
  join public.games g on g.id = ge.game_id
  left join inferred i
    on i.player_id = ge.player_id
   and i.team_season_id = g.team_season_id
  where ge.player_id is not null
    and g.team_season_id is not null
    and (
      i.roster_membership_id is null
      or i.valid_from is null
      or g.date::date < i.valid_from
      or (i.valid_until is not null and g.date::date > i.valid_until)
    )
)
select
  'PHASE3C_BLOCKERS' as section,
  (select count(*) from stats_blockers) as stats_outside_inferred_interval,
  (select count(*) from event_blockers) as events_outside_inferred_interval;

-- -----------------------------------------------------------------------------
-- F. Details of blockers (max 100 of each) to make corrections actionable.
-- -----------------------------------------------------------------------------
with inferred as (
  select
    rm.id as roster_membership_id,
    rm.player_id,
    rm.team_season_id,
    coalesce(
      least(
        rm.joined_at::date,
        (
          select min(g.date)::date
          from public.player_game_stats pgs
          join public.games g on g.id = pgs.game_id
          where pgs.player_id = rm.player_id
            and g.team_season_id = rm.team_season_id
        ),
        (
          select min(geg.date)::date
          from public.game_events ge
          join public.games geg on geg.id = ge.game_id
          where ge.player_id = rm.player_id
            and geg.team_season_id = rm.team_season_id
        )
      ),
      (
        select min(g2.date)::date
        from public.games g2
        where g2.team_season_id = rm.team_season_id
      ),
      sc.start_date,
      rm.created_at::date
    ) as valid_from,
    case
      when rm.left_at is null then null
      else greatest(
        rm.left_at::date,
        (
          select max(g3.date)::date
          from public.player_game_stats pgs3
          join public.games g3 on g3.id = pgs3.game_id
          where pgs3.player_id = rm.player_id
            and g3.team_season_id = rm.team_season_id
        ),
        (
          select max(geg2.date)::date
          from public.game_events ge2
          join public.games geg2 on geg2.id = ge2.game_id
          where ge2.player_id = rm.player_id
            and geg2.team_season_id = rm.team_season_id
        )
      )
    end as valid_until
  from public.roster_memberships rm
  join public.team_seasons ts on ts.id = rm.team_season_id
  join public.season_catalog sc on sc.id = ts.season_id
)
select
  'STAT_BLOCKER_DETAIL' as blocker_type,
  pgs.player_id,
  concat_ws(' ', p.first_name, p.last_name) as player_name,
  g.id as game_id,
  g.date::date as game_date,
  g.team_season_id,
  i.valid_from,
  i.valid_until
from public.player_game_stats pgs
join public.games g on g.id = pgs.game_id
left join public.players p on p.id = pgs.player_id
left join inferred i
  on i.player_id = pgs.player_id
 and i.team_season_id = g.team_season_id
where g.team_season_id is not null
  and (
    i.roster_membership_id is null
    or i.valid_from is null
    or g.date::date < i.valid_from
    or (i.valid_until is not null and g.date::date > i.valid_until)
  )
order by g.date, player_name
limit 100;

with inferred as (
  select
    rm.id as roster_membership_id,
    rm.player_id,
    rm.team_season_id,
    coalesce(
      least(
        rm.joined_at::date,
        (
          select min(g.date)::date
          from public.player_game_stats pgs
          join public.games g on g.id = pgs.game_id
          where pgs.player_id = rm.player_id
            and g.team_season_id = rm.team_season_id
        ),
        (
          select min(geg.date)::date
          from public.game_events ge
          join public.games geg on geg.id = ge.game_id
          where ge.player_id = rm.player_id
            and geg.team_season_id = rm.team_season_id
        )
      ),
      (
        select min(g2.date)::date
        from public.games g2
        where g2.team_season_id = rm.team_season_id
      ),
      sc.start_date,
      rm.created_at::date
    ) as valid_from,
    case
      when rm.left_at is null then null
      else greatest(
        rm.left_at::date,
        (
          select max(g3.date)::date
          from public.player_game_stats pgs3
          join public.games g3 on g3.id = pgs3.game_id
          where pgs3.player_id = rm.player_id
            and g3.team_season_id = rm.team_season_id
        ),
        (
          select max(geg2.date)::date
          from public.game_events ge2
          join public.games geg2 on geg2.id = ge2.game_id
          where ge2.player_id = rm.player_id
            and geg2.team_season_id = rm.team_season_id
        )
      )
    end as valid_until
  from public.roster_memberships rm
  join public.team_seasons ts on ts.id = rm.team_season_id
  join public.season_catalog sc on sc.id = ts.season_id
)
select
  'EVENT_BLOCKER_DETAIL' as blocker_type,
  ge.player_id,
  concat_ws(' ', p.first_name, p.last_name) as player_name,
  g.id as game_id,
  g.date::date as game_date,
  g.team_season_id,
  i.valid_from,
  i.valid_until
from public.game_events ge
join public.games g on g.id = ge.game_id
left join public.players p on p.id = ge.player_id
left join inferred i
  on i.player_id = ge.player_id
 and i.team_season_id = g.team_season_id
where ge.player_id is not null
  and g.team_season_id is not null
  and (
    i.roster_membership_id is null
    or i.valid_from is null
    or g.date::date < i.valid_from
    or (i.valid_until is not null and g.date::date > i.valid_until)
  )
order by g.date, player_name
limit 100;

-- -----------------------------------------------------------------------------
-- G. Detect partial/previous Phase-3C installation.
-- -----------------------------------------------------------------------------
select
  'EXISTING_PHASE3C_OBJECTS' as section,
  to_regclass('public.roster_membership_stints') is not null
    as roster_membership_stints_exists,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    as eligibility_function_exists,
  to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is not null
    as semantic_remove_function_exists,
  to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    as transfer_function_exists;
