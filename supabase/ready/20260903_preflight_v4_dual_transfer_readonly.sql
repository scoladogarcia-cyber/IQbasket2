-- =============================================================================
-- IQBasket V4 · Dual transfer review preflight (READ ONLY)
-- Confirms the installed temporal-roster backend before extending approvals.
-- =============================================================================

with checks as (
  select
    to_regclass('public.roster_transfer_requests') is not null as requests_table_ok,
    to_regclass('public.roster_memberships') is not null as roster_table_ok,
    to_regclass('public.roster_membership_stints') is not null as stints_table_ok,
    to_regclass('public.team_seasons') is not null as team_seasons_ok,
    to_regclass('public.team_season_memberships') is not null as team_memberships_ok,
    to_regclass('public.club_season_memberships') is not null as club_memberships_ok,
    to_regclass('public.season_catalog') is not null as season_catalog_ok,
    to_regprocedure('public.iq_v3_request_transfer(uuid,uuid,uuid)') is not null as request_rpc_ok,
    to_regprocedure('public.iq_v3_approve_transfer_request(uuid,date,date)') is not null as approve_rpc_ok,
    to_regprocedure('public.iq_v3_reject_transfer_request(uuid,text)') is not null as reject_rpc_ok,
    to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is not null as request_permission_ok,
    to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is not null as roster_permission_ok,
    to_regprocedure('public.iq_v3_is_global_superadmin()') is not null as superadmin_helper_ok,
    not exists (
      select 1
      from (values
        ('id'),('player_id'),('from_team_season_id'),('to_team_season_id'),
        ('status'),('workflow_version'),('requested_by'),('requested_at'),
        ('reviewed_by'),('reviewed_at'),('approved_last_date_from'),
        ('approved_first_date_to'),('rejection_reason')
      ) required(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name='roster_transfer_requests'
          and c.column_name=required.column_name
      )
    ) as request_columns_ok
)
select
  'TRANSFER_DUAL_PREFLIGHT' as section,
  *,
  (
    requests_table_ok
    and roster_table_ok
    and stints_table_ok
    and team_seasons_ok
    and team_memberships_ok
    and club_memberships_ok
    and season_catalog_ok
    and request_rpc_ok
    and approve_rpc_ok
    and reject_rpc_ok
    and request_permission_ok
    and roster_permission_ok
    and superadmin_helper_ok
    and request_columns_ok
  ) as ok
from checks;

select
  'TRANSFER_DUAL_BASELINE' as section,
  (select count(*) from public.roster_transfer_requests) as requests_total,
  (select count(*) from public.roster_transfer_requests where status='PENDING') as requests_pending,
  (select count(*) from public.roster_transfer_requests where status='APPROVED') as requests_approved,
  (select count(*) from public.roster_transfer_requests where status='REJECTED') as requests_rejected,
  (select count(*) from public.players) as players,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.games) as games,
  (select count(*) from public.player_game_stats) as player_game_stats,
  (select count(*) from public.game_events) as game_events;
