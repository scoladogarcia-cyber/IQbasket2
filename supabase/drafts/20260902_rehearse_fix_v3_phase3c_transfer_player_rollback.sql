-- =============================================================================
-- IQBasket v3 · PHASE 3C HOTFIX · TRANSFER PLAYER LEGACY SCHEMA
-- Date: 2026-09-02
--
-- Fixes iq_v3_transfer_player(): public.players has no updated_at column in the
-- current legacy schema. Historical truth remains in roster memberships/stints;
-- players.team_id is only the current-team compatibility hint.
--
-- Minimal change: CREATE OR REPLACE one function. No table/data migration.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.players') is null
     or to_regprocedure('public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text)') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null then
    raise exception 'PHASE3C_REQUIRED';
  end if;
end $$;

create or replace function public.iq_v3_transfer_player(
  p_player_id uuid,
  p_from_team_season_id uuid,
  p_to_team_season_id uuid,
  p_last_date_from date,
  p_first_date_to date,
  p_new_jersey integer default null,
  p_new_primary_position text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_team_id uuid;
  source_team_id uuid;
  target_season_id uuid;
  source_season_id uuid;
  target_membership_id uuid;
  target_has_stats boolean := false;
  target_has_events boolean := false;
  target_has_non_seed_stint boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_REQUIRED_FOR_TRANSFER';
  end if;

  if p_from_team_season_id = p_to_team_season_id then
    raise exception 'SOURCE_AND_TARGET_SCOPE_MUST_DIFFER';
  end if;

  if p_last_date_from is null or p_first_date_to is null then
    raise exception 'TRANSFER_DATES_REQUIRED';
  end if;

  if p_first_date_to <= p_last_date_from then
    raise exception 'TARGET_START_MUST_BE_AFTER_SOURCE_END';
  end if;

  select ts.team_id, ts.season_id
    into source_team_id, source_season_id
  from public.team_seasons ts
  where ts.id = p_from_team_season_id;

  select ts.team_id, ts.season_id
    into target_team_id, target_season_id
  from public.team_seasons ts
  where ts.id = p_to_team_season_id;

  if source_team_id is null or target_team_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if source_season_id is distinct from target_season_id then
    raise exception 'TRANSFER_REQUIRES_SAME_GLOBAL_SEASON';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    p_player_id,
    p_from_team_season_id,
    p_last_date_from
  ) then
    raise exception 'PLAYER_NOT_ACTIVE_IN_SOURCE_ON_TRANSFER_END_DATE';
  end if;

  -- Materialize the destination's inherited roster before validating it. A
  -- player inherited there from the previous season must not become eligible
  -- from season start merely because they transfer back later.
  if not exists (
    select 1
    from public.roster_memberships rm0
    where rm0.team_season_id = p_to_team_season_id
  ) then
    perform public.iq_v3_seed_team_season_roster(p_to_team_season_id, null);
  end if;

  select rm.id
    into target_membership_id
  from public.roster_memberships rm
  where rm.team_season_id = p_to_team_season_id
    and rm.player_id = p_player_id;

  if target_membership_id is not null
     and public.iq_v3_player_eligible_on_date(
       p_player_id,
       p_to_team_season_id,
       p_last_date_from
     ) then

    select exists (
      select 1
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where pgs.player_id = p_player_id
        and g.team_season_id = p_to_team_season_id
    ) into target_has_stats;

    select exists (
      select 1
      from public.game_events ge
      join public.games g on g.id = ge.game_id
      where ge.player_id = p_player_id
        and g.team_season_id = p_to_team_season_id
    ) into target_has_events;

    select exists (
      select 1
      from public.roster_membership_stints rs
      where rs.roster_membership_id = target_membership_id
        and upper(coalesce(rs.source, '')) not in ('SEASON_SEED','LEGACY_TEAM_SEED')
    ) into target_has_non_seed_stint;

    if target_has_stats or target_has_events or target_has_non_seed_stint then
      raise exception 'PLAYER_ALREADY_HAS_REAL_TARGET_SEASON_PARTICIPATION';
    end if;

    perform public.iq_v3_remove_roster_member(
      p_to_team_season_id,
      p_player_id,
      null
    );
  end if;

  perform public.iq_v3_set_roster_member(
    p_from_team_season_id,
    p_player_id,
    'INACTIVE',
    null,
    null,
    p_last_date_from
  );

  perform public.iq_v3_set_roster_member(
    p_to_team_season_id,
    p_player_id,
    'ACTIVE',
    p_new_jersey,
    p_new_primary_position,
    p_first_date_to
  );

  -- Legacy/current-team hint only. Historical truth remains in memberships/stints.
  update public.players
     set team_id = target_team_id,
         status = 'Activo'
   where id = p_player_id;

  return jsonb_build_object(
    'player_id', p_player_id,
    'from_team_season_id', p_from_team_season_id,
    'to_team_season_id', p_to_team_season_id,
    'last_date_from', p_last_date_from,
    'first_date_to', p_first_date_to
  );
end;
$$;

revoke all on function public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text) from public;
grant execute on function public.iq_v3_transfer_player(uuid,uuid,uuid,date,date,integer,text) to authenticated;

-- -----------------------------------------------------------------------------
-- HOTFIX REHEARSAL: direct temporal transfer with synthetic player
-- -----------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', up.id::text,
    'email', coalesce(up.email, ''),
    'role', 'authenticated'
  )::text,
  true
)
from public.user_profiles up
where upper(coalesce(up.global_role, '')) = 'SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $$
declare
  v_source_team_season_id uuid;
  v_target_team_season_id uuid;
  v_season_start date;
  v_season_end date;
  v_source_date date;
  v_target_date date;
  v_created jsonb;
  v_transfer jsonb;
  v_player_id uuid;
  v_target_team_id uuid;
  v_player_team_id uuid;
  v_player_status text;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'HOTFIX_REHEARSAL_SUPERADMIN_CONTEXT_FAILED';
  end if;

  select q.source_id, q.target_id, q.start_date, q.end_date
    into v_source_team_season_id, v_target_team_season_id, v_season_start, v_season_end
  from (
    select
      sc.id as season_id,
      sc.start_date,
      sc.end_date,
      min(ts.id::text)::uuid as source_id,
      max(ts.id::text)::uuid as target_id,
      count(*) as linked_teams
    from public.season_catalog sc
    join public.team_seasons ts on ts.season_id = sc.id
    where sc.start_date is null
       or sc.end_date is null
       or sc.end_date >= sc.start_date + 1
    group by sc.id, sc.start_date, sc.end_date
    having count(*) >= 2
    order by coalesce(sc.start_date, sc.end_date, current_date) desc
    limit 1
  ) q;

  if v_source_team_season_id is null
     or v_target_team_season_id is null
     or v_source_team_season_id = v_target_team_season_id then
    raise exception 'HOTFIX_REHEARSAL_NEEDS_TWO_TEAM_SEASONS';
  end if;

  if v_season_start is not null then
    v_source_date := v_season_start;
  elsif v_season_end is not null then
    v_source_date := v_season_end - 1;
  else
    v_source_date := current_date - 1;
  end if;

  v_target_date := v_source_date + 1;

  if v_season_end is not null and v_target_date > v_season_end then
    raise exception 'HOTFIX_REHEARSAL_NO_TWO_DAY_WINDOW';
  end if;

  select ts.team_id
    into v_target_team_id
  from public.team_seasons ts
  where ts.id = v_target_team_season_id;

  v_created := public.iq_v3_create_player_for_roster(
    v_source_team_season_id,
    'ZZ_HOTFIX_3C',
    'TRANSFER_PLAYER',
    93,
    'Base',
    v_source_date
  );

  v_player_id := (v_created ->> 'player_id')::uuid;

  if v_player_id is null then
    raise exception 'HOTFIX_REHEARSAL_PLAYER_CREATE_FAILED';
  end if;

  v_transfer := public.iq_v3_transfer_player(
    v_player_id,
    v_source_team_season_id,
    v_target_team_season_id,
    v_source_date,
    v_target_date,
    93,
    'Base'
  );

  if public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_source_team_season_id,
    v_target_date
  ) then
    raise exception 'HOTFIX_REHEARSAL_SOURCE_STILL_ELIGIBLE';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_target_team_season_id,
    v_target_date
  ) then
    raise exception 'HOTFIX_REHEARSAL_TARGET_NOT_ELIGIBLE';
  end if;

  select p.team_id, p.status
    into v_player_team_id, v_player_status
  from public.players p
  where p.id = v_player_id;

  if v_player_team_id is distinct from v_target_team_id then
    raise exception 'HOTFIX_REHEARSAL_LEGACY_TEAM_HINT_NOT_UPDATED';
  end if;

  if upper(coalesce(v_player_status, '')) <> 'ACTIVO' then
    raise exception 'HOTFIX_REHEARSAL_PLAYER_STATUS_NOT_ACTIVE: %', v_player_status;
  end if;

  raise notice
    'PHASE3C_TRANSFER_HOTFIX_REHEARSAL_OK player=% source=% target=% dates=%..%',
    v_player_id,
    v_source_team_season_id,
    v_target_team_season_id,
    v_source_date,
    v_target_date;
end $$;

reset role;

rollback;
