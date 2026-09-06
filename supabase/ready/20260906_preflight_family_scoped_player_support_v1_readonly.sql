-- Read-only preflight for V17 Family Scoped Player Support.
select
  'FAMILY_SCOPED_PLAYER_SUPPORT_V1_PREFLIGHT' as section,
  to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
  to_regclass('public.roster_memberships') is not null as roster_ok,
  to_regclass('public.team_seasons') is not null as team_seasons_ok,
  to_regclass('public.players') is not null as players_ok,
  to_regprocedure('public.iq_account_is_active()') is not null as account_guard_ok,
  (
    to_regclass('public.player360_subject_relationships') is not null
    and to_regclass('public.roster_memberships') is not null
    and to_regclass('public.team_seasons') is not null
    and to_regclass('public.players') is not null
    and to_regprocedure('public.iq_account_is_active()') is not null
  ) as ready;

select
  'FAMILY_SCOPED_PLAYER_SUPPORT_V1_BASELINE' as section,
  count(*) filter (
    where relationship_type='GUARDIAN'
      and status='ACTIVE'
      and valid_from<=now()
      and (valid_until is null or valid_until>now())
  ) as active_guardian_relations
from public.player360_subject_relationships;