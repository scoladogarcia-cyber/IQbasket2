-- IQBasket v3 PHASE 3C - TEMPORAL ROSTER / PLAYER ELIGIBILITY
-- =============================================================================
-- ADDITIVE / NON-DESTRUCTIVE.
--
-- Model:
--   players                         = permanent player identity
--   roster_memberships              = player belongs to team-season at some point
--   roster_membership_stints        = one or more effective date intervals
--   player_game_stats + games       = historical statistical truth
--
-- Guarantees:
-- - Removing a player closes a stint; player/statistics are never deleted.
-- - Rejoining opens a new stint on the same membership.
-- - A transferred player can keep historical memberships for previous teams.
-- - New player_game_stats are rejected when the player was not eligible on game date.
-- - Existing historical statistics are preserved and used to seed compatible stints.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Preflight
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.roster_memberships') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.season_catalog') is null
     or to_regclass('public.players') is null
     or to_regclass('public.games') is null
     or to_regclass('public.player_game_stats') is null then
    raise exception 'PHASE1_REQUIRED';
  end if;

  if to_regprocedure('public.iq_v3_can_read_team_season(uuid)') is null
     or to_regprocedure('public.iq_v3_can_manage_team_season(uuid)') is null then
    raise exception 'PHASE2_OR_RLS_HELPERS_REQUIRED';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Child table: multiple stints inside one team-season membership
-- valid_from / valid_until are INCLUSIVE dates.
-- -----------------------------------------------------------------------------
create table if not exists public.roster_membership_stints (
  id uuid primary key default gen_random_uuid(),
  roster_membership_id uuid not null
    references public.roster_memberships(id) on delete restrict,
  valid_from date not null,
  valid_until date,
  source text not null default 'MANUAL',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roster_membership_stints_date_check
    check (valid_until is null or valid_until >= valid_from)
);

create index if not exists idx_roster_stints_membership
  on public.roster_membership_stints(roster_membership_id);

create index if not exists idx_roster_stints_dates
  on public.roster_membership_stints(valid_from, valid_until);

comment on table public.roster_membership_stints is
'Effective inclusive player eligibility intervals inside one team-season membership. Supports leave/rejoin without duplicating player identity or deleting history.';

-- -----------------------------------------------------------------------------
-- 2. RLS: read contextual roster/stints, mutate only through RPC
-- -----------------------------------------------------------------------------
alter table public.roster_memberships enable row level security;
alter table public.roster_membership_stints enable row level security;

revoke all on table public.roster_memberships from anon;
revoke all on table public.roster_membership_stints from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.roster_memberships
  from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.roster_membership_stints
  from authenticated;

grant select on table public.roster_memberships to authenticated;
grant select on table public.roster_membership_stints to authenticated;

drop policy if exists iq_v3_roster_select_authorized
  on public.roster_memberships;

create policy iq_v3_roster_select_authorized
  on public.roster_memberships
  for select
  to authenticated
  using (public.iq_v3_can_read_team_season(team_season_id));

drop policy if exists iq_v3_roster_stints_select_authorized
  on public.roster_membership_stints;

create policy iq_v3_roster_stints_select_authorized
  on public.roster_membership_stints
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.roster_memberships rm
      where rm.id = roster_membership_stints.roster_membership_id
        and public.iq_v3_can_read_team_season(rm.team_season_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Backfill one compatible stint per legacy membership.
--
-- Starting date priority:
--  A) explicit joined_at
--  B) first recorded game with player_game_stats for this membership's team-season
--  C) first game of the team-season
--  D) season start
--  E) membership creation date
--
-- This guarantees all already-recorded statistics remain inside the inferred interval.
-- -----------------------------------------------------------------------------
insert into public.roster_membership_stints (
  roster_membership_id,
  valid_from,
  valid_until,
  source,
  notes
)
select
  rm.id,
  coalesce(
    rm.joined_at::date,
    (
      select min(g.date)::date
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where pgs.player_id = rm.player_id
        and g.team_season_id = rm.team_season_id
    ),
    (
      select min(g2.date)::date
      from public.games g2
      where g2.team_season_id = rm.team_season_id
    ),
    sc.start_date,
    rm.created_at::date
  ) as valid_from,
  rm.left_at::date as valid_until,
  'LEGACY_BACKFILL',
  'Inferred from pre-v3 roster/statistics; original rows preserved.'
from public.roster_memberships rm
join public.team_seasons ts on ts.id = rm.team_season_id
join public.season_catalog sc on sc.id = ts.season_id
where not exists (
  select 1
  from public.roster_membership_stints rs
  where rs.roster_membership_id = rm.id
);

-- -----------------------------------------------------------------------------
-- 4. Eligibility helpers
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_player_eligible_on_date(
  p_player_id uuid,
  p_team_season_id uuid,
  p_effective_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roster_memberships rm
    where rm.player_id = p_player_id
      and rm.team_season_id = p_team_season_id
      and (
        exists (
          select 1
          from public.roster_membership_stints rs
          where rs.roster_membership_id = rm.id
            and rs.valid_from <= coalesce(p_effective_date, current_date)
            and (
              rs.valid_until is null
              or rs.valid_until >= coalesce(p_effective_date, current_date)
            )
        )
        or (
          not exists (
            select 1
            from public.roster_membership_stints rs0
            where rs0.roster_membership_id = rm.id
          )
          and upper(coalesce(rm.status, 'ACTIVE')) in ('ACTIVE','ACTIVO')
          and (rm.joined_at is null or rm.joined_at::date <= coalesce(p_effective_date, current_date))
          and (rm.left_at is null or rm.left_at::date >= coalesce(p_effective_date, current_date))
        )
      )
  );
$$;

revoke all on function public.iq_v3_player_eligible_on_date(uuid,uuid,date) from public;
grant execute on function public.iq_v3_player_eligible_on_date(uuid,uuid,date) to authenticated;

create or replace function public.iq_v3_player_participated_in_team_season(
  p_player_id uuid,
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.roster_memberships rm
      where rm.player_id = p_player_id
        and rm.team_season_id = p_team_season_id
    )
    or exists (
      select 1
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where pgs.player_id = p_player_id
        and g.team_season_id = p_team_season_id
    );
$$;

revoke all on function public.iq_v3_player_participated_in_team_season(uuid,uuid) from public;
grant execute on function public.iq_v3_player_participated_in_team_season(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4B. Historical validation: current data must remain eligible.
-- Any mismatch aborts the whole migration before triggers are installed.
-- -----------------------------------------------------------------------------
do $$
declare
  invalid_count bigint;
  invalid_event_count bigint;
begin
  select count(*)
    into invalid_count
  from public.player_game_stats pgs
  join public.games g on g.id = pgs.game_id
  where g.team_season_id is not null
    and not public.iq_v3_player_eligible_on_date(
      pgs.player_id,
      g.team_season_id,
      g.date::date
    );

  if invalid_count <> 0 then
    raise exception 'EXISTING_STATS_OUTSIDE_INFERRED_ROSTER_STINTS: %', invalid_count;
  end if;

  if to_regclass('public.game_events') is not null then
    select count(*)
      into invalid_event_count
    from public.game_events ge
    join public.games g on g.id = ge.game_id
    where ge.player_id is not null
      and g.team_season_id is not null
      and not public.iq_v3_player_eligible_on_date(
        ge.player_id,
        g.team_season_id,
        g.date::date
      );

    if invalid_event_count <> 0 then
      raise exception 'EXISTING_EVENTS_OUTSIDE_INFERRED_ROSTER_STINTS: %', invalid_event_count;
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Capabilities
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
    'roster_write_model', 'TEAM_SEASON_TEMPORAL_ROSTER_V2',
    'supports_multiple_stints', true,
    'supports_seed_exclusion', true,
    'game_date_eligibility', true
  );
$$;

revoke all on function public.iq_v3_roster_admin_capabilities() from public;
grant execute on function public.iq_v3_roster_admin_capabilities() to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Seed a new team-season from previous season.
-- Creates memberships + opening stints only if target has no memberships at all.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_seed_team_season_roster(
  p_team_season_id uuid,
  p_effective_date date default null
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
  source_cutoff date;
  effective_start date;
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

  effective_start := coalesce(p_effective_date, target_start, current_date);

  select ts2.id,
         coalesce(
           sc2.end_date,
           (
             select max(gsrc.date)::date
             from public.games gsrc
             where gsrc.team_season_id = ts2.id
           ),
           target_start - 1,
           effective_start
         )
    into source_team_season_id, source_cutoff
  from public.team_seasons ts2
  join public.season_catalog sc2 on sc2.id = ts2.season_id
  where ts2.team_id = target_team_id
    and ts2.id <> p_team_season_id
    and exists (
      select 1
      from public.roster_memberships rm2
      where rm2.team_season_id = ts2.id
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
    with source_players as (
      select rm.player_id, rm.jersey, rm.primary_position, rm.secondary_positions
      from public.roster_memberships rm
      where rm.team_season_id = source_team_season_id
        and public.iq_v3_player_eligible_on_date(
          rm.player_id,
          source_team_season_id,
          source_cutoff
        )
    ),
    inserted as (
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
        sp.player_id,
        p_team_season_id,
        sp.jersey,
        sp.primary_position,
        coalesce(sp.secondary_positions, '{}'::text[]),
        'ACTIVE',
        effective_start::timestamptz,
        null
      from source_players sp
      on conflict (player_id, team_season_id) do nothing
      returning id
    )
    insert into public.roster_membership_stints (
      roster_membership_id,
      valid_from,
      valid_until,
      source
    )
    select id, effective_start, null, 'SEASON_SEED'
    from inserted;

    get diagnostics inserted_count = row_count;
    return inserted_count;
  end if;

  -- Legacy fallback only when no previous v3 roster exists.
  with inserted as (
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
      coalesce(p.secondary_positions, '{}'::text[]),
      'ACTIVE',
      effective_start::timestamptz,
      null
    from public.players p
    where p.team_id = target_team_id
      and upper(coalesce(p.status, 'ACTIVO')) <> 'TRASPASADO'
    on conflict (player_id, team_season_id) do nothing
    returning id
  )
  insert into public.roster_membership_stints (
    roster_membership_id,
    valid_from,
    valid_until,
    source
  )
  select id, effective_start, null, 'LEGACY_TEAM_SEED'
  from inserted;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.iq_v3_seed_team_season_roster(uuid,date) from public;
grant execute on function public.iq_v3_seed_team_season_roster(uuid,date) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Add/reactivate/update or remove a player in one team-season.
--
-- ACTIVE:
--   p_effective_date = first eligible date of the new stint.
-- INACTIVE:
--   p_effective_date = LAST eligible date of the current stint.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_set_roster_member(
  p_team_season_id uuid,
  p_player_id uuid,
  p_status text,
  p_jersey integer default null,
  p_primary_position text default null,
  p_effective_date date default null
)
returns public.roster_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text := upper(trim(coalesce(p_status, 'ACTIVE')));
  effective_date date := coalesce(p_effective_date, current_date);
  membership_row public.roster_memberships;
  player_row public.players;
  open_stint_id uuid;
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

  select p.*
    into player_row
  from public.players p
  where p.id = p_player_id;

  if player_row.id is null then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  -- If this is an inherited empty scope, materialize the inherited roster first.
  if not exists (
    select 1
    from public.roster_memberships rm0
    where rm0.team_season_id = p_team_season_id
  ) then
    perform public.iq_v3_seed_team_season_roster(
      p_team_season_id,
      null
    );
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
    case when normalized_status = 'ACTIVE' then effective_date::timestamptz else null end,
    case when normalized_status = 'INACTIVE' then effective_date::timestamptz else null end
  )
  on conflict (player_id, team_season_id)
  do update set
    jersey = coalesce(excluded.jersey, public.roster_memberships.jersey),
    primary_position = coalesce(excluded.primary_position, public.roster_memberships.primary_position),
    status = excluded.status,
    joined_at = case
      when excluded.status = 'ACTIVE'
        then coalesce(public.roster_memberships.joined_at, effective_date::timestamptz)
      else public.roster_memberships.joined_at
    end,
    left_at = case
      when excluded.status = 'INACTIVE' then effective_date::timestamptz
      else null
    end,
    updated_at = now()
  returning * into membership_row;

  select rs.id
    into open_stint_id
  from public.roster_membership_stints rs
  where rs.roster_membership_id = membership_row.id
    and rs.valid_until is null
  order by rs.valid_from desc
  limit 1
  for update;

  if normalized_status = 'ACTIVE' then
    if open_stint_id is null then
      if exists (
        select 1
        from public.roster_membership_stints rs
        where rs.roster_membership_id = membership_row.id
          and (
            rs.valid_until is null
            or rs.valid_until >= effective_date
          )
      ) then
        raise exception 'ROSTER_STINT_OVERLAP';
      end if;

      insert into public.roster_membership_stints (
        roster_membership_id,
        valid_from,
        valid_until,
        source
      )
      values (
        membership_row.id,
        effective_date,
        null,
        'MANUAL_ADD'
      );
    end if;
  else
    if open_stint_id is null then
      raise exception 'PLAYER_NOT_CURRENTLY_ACTIVE_IN_TEAM_SEASON';
    end if;

    if exists (
      select 1
      from public.roster_membership_stints rs
      where rs.id = open_stint_id
        and effective_date < rs.valid_from
    ) then
      raise exception 'INVALID_STINT_END_BEFORE_START';
    end if;

    if exists (
      select 1
      from public.player_game_stats pgs
      join public.games g on g.id = pgs.game_id
      where pgs.player_id = p_player_id
        and g.team_season_id = p_team_season_id
        and g.date::date > effective_date
    ) then
      raise exception 'ROSTER_END_BEFORE_RECORDED_GAME';
    end if;

    update public.roster_membership_stints
       set valid_until = effective_date,
           updated_at = now()
     where id = open_stint_id;
  end if;

  return membership_row;
end;
$$;

revoke all on function public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date) from public;
grant execute on function public.iq_v3_set_roster_member(uuid,uuid,text,integer,text,date) to authenticated;

-- -----------------------------------------------------------------------------
-- 7B. Semantic removal from a team-season.
--
-- Automatic season seeds can be excluded without inventing a fake participation
-- interval when the player has no statistics in that team-season. Real/manual
-- participation always closes the current stint on an explicit inclusive date.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_remove_roster_member(
  p_team_season_id uuid,
  p_player_id uuid,
  p_last_eligible_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_row public.roster_memberships;
  effective_date date := coalesce(p_last_eligible_date, current_date);
  has_stats boolean := false;
  has_any_stint boolean := false;
  has_non_seed_stint boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_can_manage_team_season(p_team_season_id) then
    raise exception 'TEAM_SEASON_MANAGE_DENIED';
  end if;

  if not exists (
    select 1
    from public.roster_memberships rm0
    where rm0.team_season_id = p_team_season_id
  ) then
    perform public.iq_v3_seed_team_season_roster(p_team_season_id, null);
  end if;

  select rm.*
    into membership_row
  from public.roster_memberships rm
  where rm.team_season_id = p_team_season_id
    and rm.player_id = p_player_id
  for update;

  if membership_row.id is null then
    raise exception 'ROSTER_MEMBERSHIP_NOT_FOUND';
  end if;

  select exists (
    select 1
    from public.player_game_stats pgs
    join public.games g on g.id = pgs.game_id
    where pgs.player_id = p_player_id
      and g.team_season_id = p_team_season_id
  ) into has_stats;

  select exists (
    select 1
    from public.roster_membership_stints rs
    where rs.roster_membership_id = membership_row.id
  ) into has_any_stint;

  select exists (
    select 1
    from public.roster_membership_stints rs
    where rs.roster_membership_id = membership_row.id
      and upper(coalesce(rs.source, '')) not in ('SEASON_SEED','LEGACY_TEAM_SEED')
  ) into has_non_seed_stint;

  if not has_stats and (not has_any_stint or not has_non_seed_stint) then
    delete from public.roster_membership_stints
    where roster_membership_id = membership_row.id;

    update public.roster_memberships
       set status = 'INACTIVE',
           joined_at = null,
           left_at = null,
           updated_at = now()
     where id = membership_row.id
     returning * into membership_row;

    return jsonb_build_object(
      'mode', 'EXCLUDED_FROM_SEASON',
      'player_id', p_player_id,
      'team_season_id', p_team_season_id,
      'membership_id', membership_row.id
    );
  end if;

  perform public.iq_v3_set_roster_member(
    p_team_season_id,
    p_player_id,
    'INACTIVE',
    null,
    null,
    effective_date
  );

  return jsonb_build_object(
    'mode', 'CLOSED_TEMPORAL_STINT',
    'player_id', p_player_id,
    'team_season_id', p_team_season_id,
    'membership_id', membership_row.id,
    'last_eligible_date', effective_date
  );
end;
$$;

revoke all on function public.iq_v3_remove_roster_member(uuid,uuid,date) from public;
grant execute on function public.iq_v3_remove_roster_member(uuid,uuid,date) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Create player identity + seasonal membership atomically.
-- players.team_id remains a legacy/current-team hint; historical truth lives in roster.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_create_player_for_roster(
  p_team_season_id uuid,
  p_first_name text,
  p_last_name text,
  p_jersey integer,
  p_primary_position text,
  p_effective_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_team_id uuid;
  effective_date date := coalesce(p_effective_date, current_date);
  created_player public.players;
  created_membership public.roster_memberships;
  created_stint public.roster_membership_stints;
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
    effective_date::timestamptz
  )
  returning * into created_membership;

  insert into public.roster_membership_stints (
    roster_membership_id,
    valid_from,
    valid_until,
    source
  )
  values (
    created_membership.id,
    effective_date,
    null,
    'PLAYER_CREATED'
  )
  returning * into created_stint;

  return jsonb_build_object(
    'player_id', created_player.id,
    'membership_id', created_membership.id,
    'stint_id', created_stint.id
  );
end;
$$;

revoke all on function public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date) from public;
grant execute on function public.iq_v3_create_player_for_roster(uuid,text,text,integer,text,date) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Future team-season links seed from the previous roster automatically.
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_link_team_season(
  p_team_id uuid,
  p_season_id uuid
)
returns public.team_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.team_seasons;
  season_start date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v3_is_global_superadmin() then
    raise exception 'SUPERADMIN_REQUIRED';
  end if;

  if not exists (select 1 from public.teams t where t.id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  select sc.start_date
    into season_start
  from public.season_catalog sc
  where sc.id = p_season_id;

  if not found then
    raise exception 'SEASON_NOT_FOUND';
  end if;

  insert into public.team_seasons (
    team_id,
    season_id,
    status,
    data_status
  )
  values (
    p_team_id,
    p_season_id,
    'ACTIVE',
    'ACTIVE'
  )
  on conflict (team_id, season_id)
  do update set
    status = 'ACTIVE',
    updated_at = now()
  returning * into result_row;

  if not exists (
    select 1
    from public.roster_memberships rm
    where rm.team_season_id = result_row.id
  ) then
    perform public.iq_v3_seed_team_season_roster(
      result_row.id,
      coalesce(season_start, current_date)
    );
  end if;

  return result_row;
end;
$$;

revoke all on function public.iq_v3_link_team_season(uuid,uuid) from public;
grant execute on function public.iq_v3_link_team_season(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 9B. Atomic transfer between team-seasons.
-- Initial policy: SUPERADMIN only. Future workflow can add dual approval without
-- changing the temporal roster model.
-- -----------------------------------------------------------------------------
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

  select ts.team_id
    into source_team_id
  from public.team_seasons ts
  where ts.id = p_from_team_season_id;

  select ts.team_id
    into target_team_id
  from public.team_seasons ts
  where ts.id = p_to_team_season_id;

  if source_team_id is null or target_team_id is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    p_player_id,
    p_from_team_season_id,
    p_last_date_from
  ) then
    raise exception 'PLAYER_NOT_ACTIVE_IN_SOURCE_ON_TRANSFER_END_DATE';
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
         status = 'Activo',
         updated_at = now()
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
-- 10. DB guards
-- -----------------------------------------------------------------------------
create or replace function public.iq_v3_validate_player_game_stat_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_team_season_id uuid;
  game_date date;
begin
  select g.team_season_id, g.date::date
    into game_team_season_id, game_date
  from public.games g
  where g.id = new.game_id;

  if game_team_season_id is null then
    return new;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    new.player_id,
    game_team_season_id,
    game_date
  ) then
    raise exception 'PLAYER_NOT_ELIGIBLE_FOR_GAME_DATE';
  end if;

  return new;
end;
$$;

revoke all on function public.iq_v3_validate_player_game_stat_eligibility() from public;

drop trigger if exists trg_iq_v3_player_game_stat_eligibility
  on public.player_game_stats;

create trigger trg_iq_v3_player_game_stat_eligibility
before insert or update of game_id, player_id
on public.player_game_stats
for each row
execute function public.iq_v3_validate_player_game_stat_eligibility();

create or replace function public.iq_v3_validate_game_event_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  game_team_season_id uuid;
  game_date date;
begin
  if new.player_id is null then
    return new;
  end if;

  select g.team_season_id, g.date::date
    into game_team_season_id, game_date
  from public.games g
  where g.id = new.game_id;

  if game_team_season_id is null then
    return new;
  end if;

  if not public.iq_v3_player_eligible_on_date(
    new.player_id,
    game_team_season_id,
    game_date
  ) then
    raise exception 'PLAYER_NOT_ELIGIBLE_FOR_GAME_EVENT_DATE';
  end if;

  return new;
end;
$$;

revoke all on function public.iq_v3_validate_game_event_eligibility() from public;

do $$
begin
  if to_regclass('public.game_events') is not null then
    execute 'drop trigger if exists trg_iq_v3_game_event_eligibility on public.game_events';
    execute 'create trigger trg_iq_v3_game_event_eligibility before insert or update of game_id, player_id on public.game_events for each row execute function public.iq_v3_validate_game_event_eligibility()';
  end if;
end $$;

create or replace function public.iq_v3_validate_game_roster_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invalid_count bigint;
begin
  if new.team_season_id is null then
    return new;
  end if;

  select count(*)
    into invalid_count
  from public.player_game_stats pgs
  where pgs.game_id = new.id
    and not public.iq_v3_player_eligible_on_date(
      pgs.player_id,
      new.team_season_id,
      new.date::date
    );

  if invalid_count <> 0 then
    raise exception 'GAME_DATE_OR_SCOPE_INVALIDATES_PLAYER_ELIGIBILITY';
  end if;

  return new;
end;
$$;

revoke all on function public.iq_v3_validate_game_roster_eligibility() from public;

drop trigger if exists trg_iq_v3_game_roster_eligibility
  on public.games;

create trigger trg_iq_v3_game_roster_eligibility
before update of date, team_season_id
on public.games
for each row
execute function public.iq_v3_validate_game_roster_eligibility();

commit;

-- -----------------------------------------------------------------------------
-- 11. Verification
-- -----------------------------------------------------------------------------
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'iq_v3_player_eligible_on_date',
    'iq_v3_player_participated_in_team_season',
    'iq_v3_roster_admin_capabilities',
    'iq_v3_seed_team_season_roster',
    'iq_v3_set_roster_member',
    'iq_v3_remove_roster_member',
    'iq_v3_create_player_for_roster',
    'iq_v3_transfer_player',
    'iq_v3_validate_player_game_stat_eligibility',
    'iq_v3_validate_game_event_eligibility',
    'iq_v3_validate_game_roster_eligibility'
  )
order by routine_name;

select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_iq_v3_player_game_stat_eligibility',
    'trg_iq_v3_game_event_eligibility',
    'trg_iq_v3_game_roster_eligibility'
  )
order by trigger_name, event_manipulation;

select
  count(*) as roster_memberships,
  (select count(*) from public.roster_membership_stints) as roster_stints,
  (select count(*) from public.player_game_stats) as existing_player_game_stats;
