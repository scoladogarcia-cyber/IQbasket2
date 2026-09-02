-- =============================================================================
-- IQBasket v3 · PHASE 3E REHEARSAL · SECURE TRANSFER MARKET · ROLLBACK
-- Date: 2026-09-02
--
-- Runs the exact Phase-3E DDL inside one transaction, validates the minimal
-- market directory as an authenticated SUPERADMIN, then ALWAYS rolls back.
-- =============================================================================

-- =============================================================================
-- IQBasket v3 · Phase 3E · Secure seasonal transfer-market directory
-- Date: 2026-09-02
--
-- PURPOSE
-- - Expose only the minimum player data required to request a transfer.
-- - List only players with an OPEN temporal stint in another team-season from
--   the SAME global season as the requesting target team-season.
-- - Keep existing player RLS unchanged; do not grant global player-table read.
-- - Advertise the capability so the UI can stay disabled until this migration
--   is installed.
--
-- SECURITY
-- - SECURITY DEFINER with empty search_path.
-- - Caller must be authenticated and allowed to request transfers for target.
-- - Returns no private player data.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.roster_transfer_requests') is null
     or to_regclass('public.roster_membership_stints') is null
     or to_regprocedure('public.iq_v3_can_request_transfer(uuid)') is null
     or to_regprocedure('public.iq_v3_transfer_request_capabilities()') is null then
    raise exception 'PHASE3D_REQUIRED';
  end if;
end $$;

create or replace function public.iq_v3_list_transfer_market(
  p_target_team_season_id uuid
)
returns table (
  player_id uuid,
  first_name text,
  last_name text,
  jersey integer,
  primary_position text,
  from_team_season_id uuid,
  source_team_id uuid,
  source_team_name text,
  global_season_id uuid,
  source_stint_from date,
  pending_to_target boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_season_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_request_transfer(p_target_team_season_id) then
    raise exception 'TRANSFER_MARKET_DENIED';
  end if;

  select ts.season_id
    into target_season_id
  from public.team_seasons ts
  where ts.id = p_target_team_season_id;

  if target_season_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  return query
  select
    p.id as player_id,
    coalesce(p.first_name, '')::text as first_name,
    coalesce(p.last_name, '')::text as last_name,
    rm.jersey,
    coalesce(rm.primary_position, p.primary_position, 'Jugador')::text
      as primary_position,
    src.id as from_team_season_id,
    src.team_id as source_team_id,
    coalesce(t.name, 'Equipo')::text as source_team_name,
    src.season_id as global_season_id,
    open_stint.valid_from as source_stint_from,
    exists (
      select 1
      from public.roster_transfer_requests r
      where r.player_id = p.id
        and r.from_team_season_id = src.id
        and r.to_team_season_id = p_target_team_season_id
        and r.status = 'PENDING'
    ) as pending_to_target
  from public.team_seasons src
  join public.teams t
    on t.id = src.team_id
  join public.roster_memberships rm
    on rm.team_season_id = src.id
  join lateral (
    select rs.valid_from
    from public.roster_membership_stints rs
    where rs.roster_membership_id = rm.id
      and rs.valid_until is null
    order by rs.valid_from desc
    limit 1
  ) open_stint on true
  join public.players p
    on p.id = rm.player_id
  where src.season_id = target_season_id
    and src.id <> p_target_team_season_id
  order by
    coalesce(t.name, ''),
    coalesce(p.last_name, ''),
    coalesce(p.first_name, ''),
    p.id;
end;
$$;

revoke all on function public.iq_v3_list_transfer_market(uuid) from public;
grant execute on function public.iq_v3_list_transfer_market(uuid) to authenticated;

create or replace function public.iq_v3_transfer_request_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'persistent_requests', true,
    'request_action_separated', true,
    'approve_action_separated', true,
    'approval_model', 'SUPERADMIN_SINGLE_V1',
    'market_directory', true,
    'market_profile_scope', 'MINIMAL_SEASONAL_V1'
  );
$$;

revoke all on function public.iq_v3_transfer_request_capabilities() from public;
grant execute on function public.iq_v3_transfer_request_capabilities() to authenticated;

comment on function public.iq_v3_list_transfer_market(uuid) is
'Minimal secure directory of players with an open stint in another team-season from the same global season. Requires permission to request transfers for the target scope.';

-- Establish temporary authenticated context.
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
  v_target_team_season_id uuid;
  v_target_season_id uuid;
  v_rows integer;
  v_bad_scope integer;
  v_capabilities jsonb;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PHASE3E_REHEARSAL_SUPERADMIN_CONTEXT_FAILED';
  end if;

  select target.id
    into v_target_team_season_id
  from public.team_seasons target
  where exists (
    select 1
    from public.team_seasons src
    join public.roster_memberships rm
      on rm.team_season_id = src.id
    join public.roster_membership_stints rs
      on rs.roster_membership_id = rm.id
     and rs.valid_until is null
    where src.season_id = target.season_id
      and src.id <> target.id
  )
  order by target.created_at desc
  limit 1;

  if v_target_team_season_id is null then
    raise exception 'PHASE3E_REHEARSAL_NEEDS_MARKET_CANDIDATE';
  end if;

  select ts.season_id
    into v_target_season_id
  from public.team_seasons ts
  where ts.id = v_target_team_season_id;

  select count(*)
    into v_rows
  from public.iq_v3_list_transfer_market(v_target_team_season_id);

  if v_rows <= 0 then
    raise exception 'ASSERT_PHASE3E_MARKET_EMPTY';
  end if;

  select count(*)
    into v_bad_scope
  from public.iq_v3_list_transfer_market(v_target_team_season_id) m
  where m.from_team_season_id = v_target_team_season_id
     or m.global_season_id is distinct from v_target_season_id
     or m.player_id is null
     or m.source_team_id is null;

  if v_bad_scope <> 0 then
    raise exception 'ASSERT_PHASE3E_MARKET_SCOPE_INVALID: %', v_bad_scope;
  end if;

  v_capabilities := public.iq_v3_transfer_request_capabilities();

  if coalesce((v_capabilities ->> 'market_directory')::boolean, false) is not true then
    raise exception 'ASSERT_PHASE3E_CAPABILITY_FLAG_MISSING';
  end if;

  if coalesce(v_capabilities ->> 'market_profile_scope', '') <> 'MINIMAL_SEASONAL_V1' then
    raise exception 'ASSERT_PHASE3E_PROFILE_SCOPE_INVALID: %', v_capabilities;
  end if;

  raise notice
    'PHASE3E_REHEARSAL_OK target=% rows=%',
    v_target_team_season_id,
    v_rows;
end $$;

reset role;

rollback;
