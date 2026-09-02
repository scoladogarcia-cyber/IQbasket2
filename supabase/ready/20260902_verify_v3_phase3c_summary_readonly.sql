-- =============================================================================
-- IQBasket v3 · PHASE 3C POST-APPLY VERIFICATION (READ ONLY)
-- Run only AFTER 20260902_apply_v3_phase3c_season_roster_backend.sql succeeds.
-- Returns one row with the critical Phase-3C health checks.
-- =============================================================================

with eligibility_integrity as (
  select
    (
      select count(*)
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          pgs.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_stats,
    (
      select count(*)
      from public.game_events ge
      join public.games g on g.id = ge.game_id
      where ge.player_id is not null
        and g.team_season_id is not null
        and not public.iq_v3_player_eligible_on_date(
          ge.player_id,
          g.team_season_id,
          g.date::date
        )
    ) as invalid_events
),
coverage as (
  select
    (select count(*) from public.roster_memberships) as memberships,
    (select count(*) from public.roster_membership_stints) as stints,
    (
      select count(*)
      from public.roster_memberships rm
      where not exists (
        select 1
        from public.roster_membership_stints rs
        where rs.roster_membership_id = rm.id
      )
    ) as memberships_without_stint
)
select
  'PHASE3C_POST_APPLY' as section,

  to_regclass('public.roster_membership_stints') is not null
    as roster_membership_stints_ok,

  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    as eligibility_function_ok,
  to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is not null
    as participation_function_ok,
  to_regprocedure('public.iq_v3_roster_admin_capabilities()') is not null
    as capabilities_function_ok,
  to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)') is not null
    as seed_function_ok,
  to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)') is not null
    as set_member_function_ok,
  to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is not null
    as remove_member_function_ok,
  to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is not null
    as create_player_function_ok,
  to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    as transfer_function_ok,

  exists (
    select 1 from pg_trigger
    where tgname = 'trg_iq_v3_player_game_stat_eligibility'
      and not tgisinternal
  ) as stats_trigger_ok,
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_iq_v3_game_event_eligibility'
      and not tgisinternal
  ) as events_trigger_ok,
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_iq_v3_game_roster_eligibility'
      and not tgisinternal
  ) as game_update_trigger_ok,

  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'roster_memberships'
      and policyname = 'iq_v3_roster_select_authorized'
  ) as roster_select_policy_ok,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'roster_membership_stints'
      and policyname = 'iq_v3_roster_stints_select_authorized'
  ) as stints_select_policy_ok,

  c.memberships as roster_memberships,
  c.stints as roster_stints,
  c.memberships_without_stint,
  ei.invalid_stats as invalid_stats_after_apply,
  ei.invalid_events as invalid_events_after_apply,

  (
    to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    and to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is not null
    and to_regprocedure('public.iq_v3_roster_admin_capabilities()') is not null
    and to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)') is not null
    and to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)') is not null
    and to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is not null
    and to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is not null
    and to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    and exists (
      select 1 from pg_trigger
      where tgname = 'trg_iq_v3_player_game_stat_eligibility'
        and not tgisinternal
    )
    and exists (
      select 1 from pg_trigger
      where tgname = 'trg_iq_v3_game_event_eligibility'
        and not tgisinternal
    )
    and exists (
      select 1 from pg_trigger
      where tgname = 'trg_iq_v3_game_roster_eligibility'
        and not tgisinternal
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'roster_memberships'
        and policyname = 'iq_v3_roster_select_authorized'
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'roster_membership_stints'
        and policyname = 'iq_v3_roster_stints_select_authorized'
    )
    and c.memberships_without_stint = 0
    and ei.invalid_stats = 0
    and ei.invalid_events = 0
  ) as phase3c_ok
from eligibility_integrity ei
cross join coverage c;
