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

commit;

select
  'PHASE3E_TRANSFER_MARKET' as section,
  to_regprocedure('public.iq_v3_list_transfer_market(uuid)') is not null
    as market_directory_function_ok,
  position(
    '''market_directory'', true'
    in pg_get_functiondef(
      to_regprocedure('public.iq_v3_transfer_request_capabilities()')
    )
  ) > 0 as capability_flag_ok;
