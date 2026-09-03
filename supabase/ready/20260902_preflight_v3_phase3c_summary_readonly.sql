-- =============================================================================
-- IQBasket v3 · PHASE 3C PRE-FLIGHT SUMMARY (READ ONLY)
-- Returns one row with every critical decision flag.
-- No CREATE / UPDATE / INSERT / DELETE.
-- =============================================================================

with
membership_sanity as (
  select
    count(*) filter (
      where rm.joined_at is not null
        and rm.left_at is not null
        and rm.joined_at::date > rm.left_at::date
    ) as joined_after_left
  from public.roster_memberships rm
),
missing_memberships as (
  select
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
    ) as missing_roster_membership_for_events
),
inferred as (
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
blockers as (
  select
    (
      select count(*)
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
    ) as stats_outside_inferred_interval,
    (
      select count(*)
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
    ) as events_outside_inferred_interval
)
select
  'PHASE3C_PREFLIGHT_SUMMARY' as section,

  -- Required objects
  to_regclass('public.roster_memberships') is not null as roster_memberships_ok,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regclass('public.season_catalog') is not null as season_catalog_ok,
  to_regclass('public.players') is not null as players_ok,
  to_regclass('public.games') is not null as games_ok,
  to_regclass('public.player_game_stats') is not null as player_game_stats_ok,
  to_regclass('public.game_events') is not null as game_events_ok,
  to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is not null as can_read_helper_ok,
  to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null as can_manage_helper_ok,

  -- Data blockers
  ms.joined_after_left,
  mm.missing_roster_membership_for_stats,
  mm.missing_roster_membership_for_events,
  b.stats_outside_inferred_interval,
  b.events_outside_inferred_interval,

  -- Existing Phase 3C state
  to_regclass('public.roster_membership_stints') is not null as roster_membership_stints_exists,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null as eligibility_function_exists,
  to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is not null as semantic_remove_function_exists,

  -- One explicit decision flag
  (
    to_regclass('public.roster_memberships') is not null
    and to_regclass('public.team_seasons') is not null
    and to_regclass('public.season_catalog') is not null
    and to_regclass('public.players') is not null
    and to_regclass('public.games') is not null
    and to_regclass('public.player_game_stats') is not null
    and to_regclass('public.game_events') is not null
    and to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is not null
    and to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is not null
    and ms.joined_after_left = 0
    and mm.missing_roster_membership_for_stats = 0
    and mm.missing_roster_membership_for_events = 0
    and b.stats_outside_inferred_interval = 0
    and b.events_outside_inferred_interval = 0
    and to_regclass('public.roster_membership_stints') is null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
    and to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is null
  ) as safe_to_apply_phase3c
from membership_sanity ms
cross join missing_memberships mm
cross join blockers b;
