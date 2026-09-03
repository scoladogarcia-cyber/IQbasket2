-- =============================================================================
-- IQBasket V4 · Dual transfer verification (READ ONLY)
-- =============================================================================

with checks as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema='public'
        and table_name='roster_transfer_requests'
        and column_name='requested_first_date_to'
    ) as requested_date_column_ok,
    to_regclass('public.roster_transfer_reviews') is not null as reviews_table_ok,
    to_regprocedure('public.iq_v4_can_review_transfer_scope(uuid)') is not null as review_scope_fn_ok,
    to_regprocedure('public.iq_v4_date_within_team_season(uuid,date)') is not null as date_fn_ok,
    to_regprocedure('public.iq_v4_dual_transfer_reviews_ready(uuid)') is not null as ready_fn_ok,
    to_regprocedure('public.iq_v4_transfer_request_capabilities()') is not null as capability_fn_ok,
    to_regprocedure('public.iq_v4_request_transfer(uuid,uuid,uuid,date)') is not null as request_v4_ok,
    to_regprocedure('public.iq_v4_review_transfer_side(uuid,text,text,date,text)') is not null as review_v4_ok,
    to_regprocedure('public.iq_v4_finalize_transfer_request(uuid)') is not null as finalize_v4_ok,
    exists (
      select 1
      from pg_policies
      where schemaname='public'
        and tablename='roster_transfer_reviews'
        and policyname='iq_v4_transfer_reviews_select_authorized'
    ) as review_rls_policy_ok,
    exists (
      select 1
      from pg_policies
      where schemaname='public'
        and tablename='roster_transfer_requests'
        and policyname='iq_v3_transfer_request_select_authorized'
        and position('requested_by = auth.uid()' in lower(coalesce(qual, ''))) > 0
    ) as requester_self_read_ok,
    position(
      'DUAL_TRANSFER_REVIEWS_REQUIRED'
      in pg_get_functiondef('public.iq_v3_approve_transfer_request(uuid,date,date)'::regprocedure)
    ) > 0 as legacy_guard_reviews_ok,
    position(
      'DUAL_TRANSFER_REVIEW_DATES_MISMATCH'
      in pg_get_functiondef('public.iq_v3_approve_transfer_request(uuid,date,date)'::regprocedure)
    ) > 0 as legacy_guard_dates_ok,
    position(
      'SUPERADMIN_REQUIRED_FOR_TRANSFER_FINALIZATION'
      in pg_get_functiondef('public.iq_v4_finalize_transfer_request(uuid)'::regprocedure)
    ) > 0 as finalizer_superadmin_ok
)
select
  'TRANSFER_DUAL_VERIFY' as section,
  *,
  (
    requested_date_column_ok
    and reviews_table_ok
    and review_scope_fn_ok
    and date_fn_ok
    and ready_fn_ok
    and capability_fn_ok
    and request_v4_ok
    and review_v4_ok
    and finalize_v4_ok
    and review_rls_policy_ok
    and requester_self_read_ok
    and legacy_guard_reviews_ok
    and legacy_guard_dates_ok
    and finalizer_superadmin_ok
  ) as ok
from checks;

select
  'TRANSFER_DUAL_COUNTS' as section,
  (select count(*) from public.roster_transfer_requests) as requests_total,
  (select count(*) from public.roster_transfer_reviews) as reviews_total,
  (select count(*) from public.players) as players,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.games) as games,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events;
