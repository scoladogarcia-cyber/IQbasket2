-- =============================================================================
-- IQBasket v3 · PHASE 3D POST-APPLY SUMMARY (READ ONLY)
-- Date: 2026-09-02
--
-- Run immediately after:
--   20260902_apply_v3_phase3d_transfer_requests.sql
--
-- Expected: one row with phase3d_ok = true.
-- =============================================================================

with
integrity as (
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
privileges as (
  select
    exists (
      select 1
      from information_schema.table_privileges tp
      where tp.table_schema = 'public'
        and tp.table_name = 'roster_transfer_requests'
        and tp.grantee = 'authenticated'
        and tp.privilege_type = 'SELECT'
    ) as authenticated_select_ok,
    not exists (
      select 1
      from information_schema.table_privileges tp
      where tp.table_schema = 'public'
        and tp.table_name = 'roster_transfer_requests'
        and tp.grantee = 'authenticated'
        and tp.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
    ) as authenticated_direct_mutation_blocked
),
transfer_fn as (
  select pg_get_functiondef(
    to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)')
  ) as definition
)
select
  'PHASE3D_POST_APPLY' as section,

  -- Phase 3D schema
  to_regclass('public.roster_transfer_requests') is not null
    as transfer_requests_table_ok,
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'roster_transfer_requests'
      and c.relkind = 'r'
  ), false) as transfer_requests_rls_ok,

  -- Workflow functions
  to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is not null
    as can_request_function_ok,
  to_regprocedure('public.iq_v3_can_approve_transfer_request()') is not null
    as can_approve_function_ok,
  to_regprocedure('public.iq_v3_transfer_request_capabilities()') is not null
    as capabilities_function_ok,
  to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    as request_function_ok,
  to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    as approve_function_ok,
  to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    as reject_function_ok,

  -- Read policy + least privilege
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'roster_transfer_requests'
      and p.policyname = 'iq_v3_transfer_request_select_authorized'
      and p.cmd = 'SELECT'
  ) as transfer_select_policy_ok,
  pv.authenticated_select_ok,
  pv.authenticated_direct_mutation_blocked,

  -- Pending de-duplication
  exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'roster_transfer_requests'
      and i.indexname = 'uq_roster_transfer_request_pending'
  ) as pending_unique_index_ok,

  -- Phase 3C must remain healthy and include the transfer hotfix
  to_regclass('public.roster_membership_stints') is not null
    as phase3c_stints_ok,
  to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    as phase3c_eligibility_ok,
  to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    as phase3c_transfer_ok,
  position('updated_at = now()' in tf.definition) = 0
    as phase3c_transfer_hotfix_ok,

  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.roster_transfer_requests) as transfer_requests,
  it.invalid_stats as invalid_stats_after_apply,
  it.invalid_events as invalid_events_after_apply,

  (
    to_regclass('public.roster_transfer_requests') is not null
    and coalesce((
      select c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'roster_transfer_requests'
        and c.relkind = 'r'
    ), false)
    and to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is not null
    and to_regprocedure('public.iq_v3_can_approve_transfer_request()') is not null
    and to_regprocedure('public.iq_v3_transfer_request_capabilities()') is not null
    and to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null
    and to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null
    and to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null
    and exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = 'roster_transfer_requests'
        and p.policyname = 'iq_v3_transfer_request_select_authorized'
        and p.cmd = 'SELECT'
    )
    and pv.authenticated_select_ok
    and pv.authenticated_direct_mutation_blocked
    and exists (
      select 1
      from pg_indexes i
      where i.schemaname = 'public'
        and i.tablename = 'roster_transfer_requests'
        and i.indexname = 'uq_roster_transfer_request_pending'
    )
    and to_regclass('public.roster_membership_stints') is not null
    and to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is not null
    and to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is not null
    and position('updated_at = now()' in tf.definition) = 0
    and it.invalid_stats = 0
    and it.invalid_events = 0
  ) as phase3d_ok
from integrity it
cross join privileges pv
cross join transfer_fn tf;
