-- =============================================================================
-- IQBasket v3 · PHASE 3F ROLLBACK · ROSTER-SPECIFIC ACTION AUTHORIZATION
-- Date: 2026-09-03
--
-- Restores the pre-3F authorization wiring:
-- - roster RPCs use iq_v3_can_manage_team_season(...)
-- - transfer requests use iq_v3_can_manage_team_season(...)
-- - iq_v3_can_manage_roster(uuid) is removed
--
-- No sporting rows are modified.
-- =============================================================================

begin;

do $$
declare
  signature text;
  target regprocedure;
  definition text;
  new_call constant text :=
    'public.iq_v3_can_manage_roster(p_team_season_id)';
  old_call constant text :=
    'public.iq_v3_can_manage_team_season(p_team_season_id)';
begin
  if to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null then
    raise exception 'PHASE3F_NOT_INSTALLED';
  end if;

  foreach signature in array array[
    'public.iq_v3_seed_team_season_roster(uuid,date)',
    'public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date)',
    'public.iq_v3_remove_roster_member(uuid,uuid,date)',
    'public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)'
  ]
  loop
    target := to_regprocedure(signature);
    if target is null then
      raise exception 'PHASE3F_ROLLBACK_FUNCTION_NOT_FOUND: %', signature;
    end if;

    definition := pg_get_functiondef(target);
    if position(new_call in definition) = 0 then
      raise exception 'PHASE3F_ROLLBACK_EXPECTED_CALL_NOT_FOUND: %', signature;
    end if;

    execute replace(definition, new_call, old_call);
  end loop;
end $$;

create or replace function public.iq_v3_can_request_transfer(
  p_to_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.iq_v3_can_manage_team_season(p_to_team_season_id);
$$;

revoke all on function public.iq_v3_can_request_transfer(uuid) from public;
grant execute on function public.iq_v3_can_request_transfer(uuid) to authenticated;

drop function public.iq_v3_can_manage_roster(uuid);

commit;

select
  'PHASE3F_ROLLBACK' as section,
  to_regprocedure('public.iq_v3_can_manage_roster(uuid)') is null as roster_helper_removed,
  position(
    'iq_v3_can_manage_team_season(p_team_season_id)'
    in pg_get_functiondef(
      to_regprocedure('public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date)')
    )
  ) > 0 as create_restored,
  position(
    'iq_v3_can_manage_team_season(p_to_team_season_id)'
    in pg_get_functiondef(
      to_regprocedure('public.iq_v3_can_request_transfer(uuid)')
    )
  ) > 0 as request_restored;
