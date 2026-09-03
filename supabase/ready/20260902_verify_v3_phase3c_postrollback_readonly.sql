-- =============================================================================
-- IQBasket v3 · PHASE 3C POST-ROLLBACK VERIFICATION (READ ONLY)
-- Run immediately after 20260902_rehearse_v3_phase3c_rollback.sql.
--
-- The preflight proved Phase 3C was absent before rehearsal, so a clean rollback
-- must leave all Phase-3C-only objects absent again.
-- =============================================================================

select
  'PHASE3C_POST_ROLLBACK' as section,

  to_regclass('public.roster_membership_stints') is null
    as roster_membership_stints_absent,

  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
    as eligibility_function_absent,

  to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is null
    as participation_function_absent,

  to_regprocedure('public.iq_v3_roster_admin_capabilities()') is null
    as capabilities_function_absent,

  to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)') is null
    as seed_function_absent,

  to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)') is null
    as set_member_function_absent,

  to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is null
    as remove_member_function_absent,

  to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is null
    as create_player_function_absent,

  to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is null
    as transfer_function_absent,

  not exists (
    select 1 from pg_trigger
    where tgname = 'trg_iq_v3_player_game_stat_eligibility'
      and not tgisinternal
  ) as stats_trigger_absent,

  not exists (
    select 1 from pg_trigger
    where tgname = 'trg_iq_v3_game_event_eligibility'
      and not tgisinternal
  ) as events_trigger_absent,

  not exists (
    select 1 from pg_trigger
    where tgname = 'trg_iq_v3_game_roster_eligibility'
      and not tgisinternal
  ) as game_trigger_absent,

  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events,

  (
    to_regclass('public.roster_membership_stints') is null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
    and to_regprocedure('public.iq_v3_player_participated_in_team_season(uuid,uuid)') is null
    and to_regprocedure('public.iq_v3_roster_admin_capabilities()') is null
    and to_regprocedure('public.iq_v3_seed_team_season_roster(uuid,date)') is null
    and to_regprocedure('public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)') is null
    and to_regprocedure('public.iq_v3_remove_roster_member(uuid,uuid,date)') is null
    and to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)') is null
    and to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is null
    and not exists (
      select 1 from pg_trigger
      where tgname = 'trg_iq_v3_player_game_stat_eligibility'
        and not tgisinternal
    )
    and not exists (
      select 1 from pg_trigger
      where tgname = 'trg_iq_v3_game_event_eligibility'
        and not tgisinternal
    )
    and not exists (
      select 1 from pg_trigger
      where tgname = 'trg_iq_v3_game_roster_eligibility'
        and not tgisinternal
    )
  ) as phase3c_rollback_clean;
