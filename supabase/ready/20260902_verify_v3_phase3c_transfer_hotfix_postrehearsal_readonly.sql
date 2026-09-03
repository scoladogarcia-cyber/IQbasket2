-- =============================================================================
-- IQBasket v3 · PHASE 3C TRANSFER HOTFIX POST-REHEARSAL CHECK (READ ONLY)
-- Date: 2026-09-02
--
-- Confirms:
-- 1) the rollback-only rehearsal did not persist the hotfix;
-- 2) Phase 3C remains intact;
-- 3) Phase 3D remains absent.
-- =============================================================================

with fn as (
  select pg_get_functiondef(
    to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)')
  ) as definition
),
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
)
select
  'PHASE3C_TRANSFER_HOTFIX_POST_REHEARSAL' as section,
  position('updated_at = now()' in fn.definition) > 0
    as old_buggy_function_restored_after_rollback,
  to_regclass('public.roster_transfer_requests') is null
    as phase3d_absent,
  (select count(*) from public.roster_memberships) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  i.invalid_stats,
  i.invalid_events,
  (
    position('updated_at = now()' in fn.definition) > 0
    and to_regclass('public.roster_transfer_requests') is null
    and i.invalid_stats = 0
    and i.invalid_events = 0
  ) as safe_to_apply_transfer_hotfix
from fn
cross join integrity i;
