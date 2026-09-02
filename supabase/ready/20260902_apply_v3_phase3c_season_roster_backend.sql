-- IQBasket v3 PHASE 3C - HISTORICAL ROSTER BY TEAM-SEASON
-- =============================================================================
-- ADDITIVE / NON-DESTRUCTIVE.
-- Makes roster_memberships the canonical seasonal roster.
-- Removing a player from a season means status=INACTIVE; player identity/stats stay.
-- New team-seasons can seed from the previous roster as a starting point.
-- Direct browser writes to roster_memberships are denied; mutations use RPCs.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.roster_memberships') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.season_catalog') is null then
    raise exception 'PHASE1_REQUIRED';
  end if;

  if to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is null
     or to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null then
    raise exception 'PHASE2_OR_RLS_HELPERS_REQUIRED';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. RLS hardening
-- -----------------------------------------------------------------------------
alter table public.roster_memberships enable row level security;

revoke all on table public.roster_memberships from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.roster_memberships
  from authenticated;
grant select on table public.roster_memberships to authenticated;

drop policy if exists iq_v3_roster_select_authorized
  on public.roster_memberships;

create policy iq_v3_roster_select_authorized
  on public.roster_memberships
  for select
  to authenticated
  using (
    public.iq_v3_can_read_team_season(team_season_id)
  );

-- -----------------------------------------------------------------------------
-- 2. Capabilities
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_roster_admin_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'roster_write_model', 'TEAM_SEASON_ROSTER_V1'
  );
$$;

revoke all on function public.iq_v3_roster_admin_capabilities() from public;
grant execute on function public.iq_v3_roster_admin_capabilities() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Seed an empty season roster from the previous season (or team players).
-- IMPORTANT: if ANY membership already exists in the target scope, do nothing.
-- This preserves an intentionally empty roster.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_seed_team_season_roster(
  p_team_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_team_id uuid;
  target_start date;
  source_team_season_id uuid;
  inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_manage_team_season(p_team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  select ts.team_id, sc.start_date
    into target_team_id, target_start
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where ts.id = p_team_season_id;

  if target_team_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id
  ) then
    return 0;
  end if;

  select ts2.id
    into source_team_season_id
  from public.team_seasons ts2
  join public.season_catalog sc2 on sc2.id = ts2.season_id
  where ts2.team_id = target_team_id
    and ts2.id <> p_team_season_id
    and exists (
      select 1
      from public.roster_memberships rm2
      where rm2.team_season_id = ts2.id
        and upper(coalesce(rm2.status, 'ACTIVE')) = 'ACTIVE'
    )
  order by
    case
      when target_start is not null
       and sc2.start_date is not null
       and sc2.start_date < target_start then 0
      else 1
    end,
    sc2.start_date desc nulls last,
    ts2.created_at desc
  limit 1;

  if source_team_season_id is not null then
    insert into public.roster_memberships (
      player_id,
      team_season_id,
      jersey,
      primary_position,
      secondary_positions,
      status,
      joined_at,
      left_at
    )
    select
      rm.player_id,
      p_team_season_id,
      rm.jersey,
      rm.primary_position,
      coalesce(rm.secondary_positions, '{}'::text[]),
      'ACTIVE',
      now(),
      null
    from public.roster_memberships rm
    where rm.team_season_id = source_team_season_id
      and upper(coalesce(rm.status, 'ACTIVE')) = 'ACTIVE'
    on conflict (player_id, team_season_id) do nothing;

    get diagnostics inserted_count = row_count;
    return inserted_count;
  end if;

  -- Legacy fallback only when no previous v3 roster exists.
  insert into public.roster_memberships (
    player_id,
    team_season_id,
    jersey,
    primary_position,
    secondary_positions,
    status,
    joined_at,
    left_at
  )
  select
    p.id,
    p_team_season_id,
    p.jersey,
    p.primary_position,
    '{}'::text[],
    'ACTIVE',
    now(),
    null
  from public.players p
  where p.team_id = target_team_id
    and upper(coalesce(p.status, 'ACTIVO')) <> 'TRASPASADO'
  on conflict (player_id, team_season_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.iq_v3_seed_team_season_roster(uuid) from public;
grant execute on function public.iq_v3_seed_team_season_roster(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Add/reactivate/update or remove a player ONLY in one team-season.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_set_roster_member(
  p_team_season_id uuid,
  p_player_id uuid,
  p_status text,
  p_jersey integer default null,
  p_primary_position text default null
)
returns public.roster_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text := upper(trim(coalesce(p_status, 'ACTIVE')));
  target_team_id uuid;
  player_row public.players;
  result_row public.roster_memberships;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_manage_team_season(p_team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  if normalized_status not in ('ACTIVE','INACTIVE') then
    raise exception 'INVALID_ROSTER_STATUS';
  end if;

  select ts.team_id
    into target_team_id
  from public.team_seasons ts
  where ts.id = p_team_season_id;

  if target_team_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  select p.*
    into player_row
  from public.players p
  where p.id = p_player_id;

  if player_row.id is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  if player_row.team_id is distinct from target_team_id then
    raise exception 'PLAYER_BELONGS_TO_ANOTHER_TEAM';
  end if;

  -- Materialize inherited roster before the first seasonal change.
  if not exists (
    select 1
    from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id
  ) then
    perform public.iq_v3_seed_team_season_roster(p_team_season_id);
  end if;

  insert into public.roster_memberships (
    player_id,
    team_season_id,
    jersey,
    primary_position,
    secondary_positions,
    status,
    joined_at,
    left_at
  )
  values (
    p_player_id,
    p_team_season_id,
    coalesce(p_jersey, player_row.jersey),
    coalesce(nullif(trim(p_primary_position), ''), player_row.primary_position),
    '{}'::text[],
    normalized_status,
    case when normalized_status = 'ACTIVE' then now() else null end,
    case when normalized_status = 'INACTIVE' then now() else null end
  )
  on conflict (player_id, team_season_id)
  do update set
    jersey = coalesce(excluded.jersey, public.roster_memberships.jersey),
    primary_position = coalesce(excluded.primary_position, public.roster_memberships.primary_position),
    status = excluded.status,
    joined_at = case
      when excluded.status = 'ACTIVE'
        then coalesce(public.roster_memberships.joined_at, now())
      else public.roster_memberships.joined_at
    end,
    left_at = case
      when excluded.status = 'INACTIVE' then now()
      else null
    end,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.iq_v3_set_roster_member(uuid,uuid,text,integer,text) from public;
grant execute on function public.iq_v3_set_roster_member(uuid,uuid,text,integer,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Create player identity + active seasonal membership atomically.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_create_player_for_roster(
  p_team_season_id uuid,
  p_first_name text,
  p_last_name text,
  p_jersey integer,
  p_primary_position text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_team_id uuid;
  created_player public.players;
  created_membership public.roster_memberships;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_manage_team_season(p_team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  select ts.team_id
    into target_team_id
  from public.team_seasons ts
  where ts.id = p_team_season_id;

  if target_team_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if nullif(trim(coalesce(p_first_name,'')), '') is null
     or nullif(trim(coalesce(p_last_name,'')), '') is null then
    raise exception 'PLAYER_NAME_REQUIRED';
  end if;

  insert into public.players (
    team_id,
    first_name,
    last_name,
    jersey,
    primary_position,
    status
  )
  values (
    target_team_id,
    trim(p_first_name),
    trim(p_last_name),
    p_jersey,
    nullif(trim(coalesce(p_primary_position,'')), ''),
    'Activo'
  )
  returning * into created_player;

  insert into public.roster_memberships (
    player_id,
    team_season_id,
    jersey,
    primary_position,
    secondary_positions,
    status,
    joined_at
  )
  values (
    created_player.id,
    p_team_season_id,
    p_jersey,
    nullif(trim(coalesce(p_primary_position,'')), ''),
    '{}'::text[],
    'ACTIVE',
    now()
  )
  returning * into created_membership;

  return jsonb_build_object(
    'player_id', created_player.id,
    'membership_id', created_membership.id
  );
end;
$$;

revoke all on function public.iq_v3_create_player_for_roster(uuid,text,text,integer,text) from public;
grant execute on function public.iq_v3_create_player_for_roster(uuid,text,text,integer,text) to authenticated;

commit;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'iq_v3_roster_admin_capabilities',
    'iq_v3_seed_team_season_roster',
    'iq_v3_set_roster_member',
    'iq_v3_create_player_for_roster'
  )
order by routine_name;
