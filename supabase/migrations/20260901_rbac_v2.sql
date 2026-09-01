-- IQ Basket RBAC v2 + RLS
-- Fecha: 2026-09-01
-- IMPORTANTE: revisar en staging antes de aplicar en producción.
-- Único SUPERADMIN permitido: scolado@nechigroup.com

begin;

-- ---------------------------------------------------------------------------
-- 1. PERFIL DE AUTORIZACIÓN
-- ---------------------------------------------------------------------------
alter table if exists public.user_profiles
  add column if not exists club_id uuid null,
  add column if not exists allowed_team_ids uuid[] not null default '{}'::uuid[],
  add column if not exists allowed_season_ids uuid[] not null default '{}'::uuid[],
  add column if not exists player_id uuid null,
  add column if not exists linked_player_ids uuid[] not null default '{}'::uuid[],
  add column if not exists status text not null default 'Activo';

-- Backfill no destructivo desde el esquema legacy.
update public.user_profiles
set allowed_team_ids = array[team_id]
where team_id is not null
  and coalesce(array_length(allowed_team_ids, 1), 0) = 0;

update public.user_profiles up
set club_id = t.club_id
from public.teams t
where up.club_id is null
  and up.team_id = t.id;

-- Normalización de roles legacy.
update public.user_profiles
set role = 'ANALISTA'
where upper(coalesce(role, '')) = 'SCOUT';

update public.user_profiles
set role = 'VISOR'
where upper(coalesce(role, '')) = 'VIEWER';

-- Solo puede existir un SUPERADMIN funcional y debe ser la cuenta maestra.
update public.user_profiles
set role = 'INVITADO'
where upper(coalesce(role, '')) = 'SUPERADMIN'
  and lower(email) <> 'scolado@nechigroup.com';

update public.user_profiles
set role = 'SUPERADMIN'
where lower(email) = 'scolado@nechigroup.com';

-- ---------------------------------------------------------------------------
-- 2. HELPERS DE SEGURIDAD (SECURITY DEFINER PARA EVITAR RECURSIÓN RLS)
-- ---------------------------------------------------------------------------
create or replace function public.iq_current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.iq_current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_role text;
begin
  v_email := public.iq_current_email();

  if v_email = 'scolado@nechigroup.com' then
    return 'SUPERADMIN';
  end if;

  select upper(coalesce(role, 'INVITADO'))
    into v_role
  from public.user_profiles
  where lower(email) = v_email
  limit 1;

  if v_role = 'SCOUT' then return 'ANALISTA'; end if;
  if v_role = 'VIEWER' then return 'VISOR'; end if;
  if v_role = 'SUPERADMIN' then return 'INVITADO'; end if;

  return coalesce(v_role, 'INVITADO');
end;
$$;

create or replace function public.iq_current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id
  from public.user_profiles
  where lower(email) = public.iq_current_email()
  limit 1;
$$;

create or replace function public.iq_allowed_team_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(allowed_team_ids, '{}'::uuid[])
         || case when team_id is null then '{}'::uuid[] else array[team_id] end
  from public.user_profiles
  where lower(email) = public.iq_current_email()
  limit 1;
$$;

create or replace function public.iq_allowed_season_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(allowed_season_ids, '{}'::uuid[])
  from public.user_profiles
  where lower(email) = public.iq_current_email()
  limit 1;
$$;

create or replace function public.iq_can_access_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.iq_current_role() = 'SUPERADMIN'
    or target_club_id = public.iq_current_club_id();
$$;

create or replace function public.iq_can_access_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.iq_current_role() = 'SUPERADMIN'
    or target_team_id = any(coalesce(public.iq_allowed_team_ids(), '{}'::uuid[]))
    or (
      public.iq_current_role() = 'ADMIN'
      and exists (
        select 1
        from public.teams t
        where t.id = target_team_id
          and t.club_id = public.iq_current_club_id()
      )
    );
$$;

create or replace function public.iq_can_manage_game(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.iq_current_role() in ('SUPERADMIN','ADMIN','ENTRENADOR','ANALISTA')
    and public.iq_can_access_team(target_team_id);
$$;

create or replace function public.iq_can_manage_roster(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.iq_current_role() in ('SUPERADMIN','ADMIN','ENTRENADOR')
    and public.iq_can_access_team(target_team_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. BLOQUEO DE ESCALADA DE PRIVILEGIOS EN user_profiles
-- ---------------------------------------------------------------------------
create or replace function public.iq_guard_user_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text := public.iq_current_email();
  actor_role text := public.iq_current_role();
  target_email text := lower(coalesce(new.email, ''));
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  -- Invariante global: la identidad maestra siempre es SUPERADMIN.
  if target_email = 'scolado@nechigroup.com' then
    if not is_service and actor_email <> 'scolado@nechigroup.com' then
      raise exception 'Solo el Superadmin único puede modificar su perfil privilegiado';
    end if;
    new.role := 'SUPERADMIN';
    return new;
  end if;

  -- Invariante global: nadie más puede ser SUPERADMIN, ni siquiera mediante service_role.
  if upper(coalesce(new.role, 'INVITADO')) = 'SUPERADMIN' then
    raise exception 'SUPERADMIN está reservado a scolado@nechigroup.com';
  end if;

  if tg_op = 'INSERT' then
    -- Los perfiles creados automáticamente por Auth nacen siempre sin privilegios.
    -- Las elevaciones administrativas seguras se realizan después mediante una
    -- operación service_role explícita (Edge Function).
    if is_service then
      new.role := 'INVITADO';
      return new;
    end if;

    -- Registro público: únicamente perfil propio INVITADO.
    if actor_role <> 'SUPERADMIN' then
      if actor_email <> target_email then
        raise exception 'No se puede crear un perfil para otra identidad';
      end if;
      new.role := 'INVITADO';
    end if;
    return new;
  end if;

  -- Las operaciones administrativas internas con service_role pueden mantener
  -- roles estándar/ADMIN, pero nunca vulnerar la unicidad de SUPERADMIN.
  if is_service then
    return new;
  end if;

  -- Un usuario normal nunca puede modificar autorización.
  if actor_role not in ('SUPERADMIN','ADMIN') then
    if new.role is distinct from old.role
       or new.club_id is distinct from old.club_id
       or new.allowed_team_ids is distinct from old.allowed_team_ids
       or new.allowed_season_ids is distinct from old.allowed_season_ids
       or new.player_id is distinct from old.player_id
       or new.linked_player_ids is distinct from old.linked_player_ids then
      raise exception 'No puedes modificar tus propios permisos o alcance';
    end if;
    return new;
  end if;

  -- ADMIN no puede elevar privilegios ni modificar su propio rol.
  if actor_role = 'ADMIN' then
    if actor_email = target_email and new.role is distinct from old.role then
      raise exception 'Un administrador no puede modificar su propio rol';
    end if;

    if upper(coalesce(new.role, 'INVITADO')) in ('ADMIN','SUPERADMIN') then
      if new.role is distinct from old.role then
        raise exception 'Solo el Superadmin puede asignar roles privilegiados';
      end if;
    end if;

    if old.club_id is distinct from public.iq_current_club_id() then
      raise exception 'Un administrador solo puede gestionar usuarios de su club';
    end if;

    -- Un ADMIN no puede conceder alcance a equipos externos a su club.
    if exists (
      select 1
      from unnest(coalesce(new.allowed_team_ids, '{}'::uuid[])) as requested_team_id
      left join public.teams t on t.id = requested_team_id
      where t.id is null
         or t.club_id is distinct from public.iq_current_club_id()
    ) then
      raise exception 'No puedes asignar equipos de otro club';
    end if;

    if new.team_id is not null and not exists (
      select 1
      from public.teams t
      where t.id = new.team_id
        and t.club_id = public.iq_current_club_id()
    ) then
      raise exception 'El equipo principal asignado no pertenece a tu club';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_iq_guard_user_profile_privileges on public.user_profiles;
create trigger trg_iq_guard_user_profile_privileges
before insert or update on public.user_profiles
for each row execute function public.iq_guard_user_profile_privileges();

-- ---------------------------------------------------------------------------
-- 4. RLS: USER PROFILES
-- ---------------------------------------------------------------------------
alter table public.user_profiles enable row level security;

drop policy if exists iq_profiles_select on public.user_profiles;
create policy iq_profiles_select on public.user_profiles
for select
using (
  lower(email) = public.iq_current_email()
  or public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and club_id = public.iq_current_club_id()
    and lower(email) <> 'scolado@nechigroup.com'
  )
);

drop policy if exists iq_profiles_insert on public.user_profiles;
create policy iq_profiles_insert on public.user_profiles
for insert
with check (
  public.iq_current_role() = 'SUPERADMIN'
  or lower(email) = public.iq_current_email()
);

drop policy if exists iq_profiles_update on public.user_profiles;
create policy iq_profiles_update on public.user_profiles
for update
using (
  lower(email) = public.iq_current_email()
  or public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and club_id = public.iq_current_club_id()
    and lower(email) <> 'scolado@nechigroup.com'
  )
)
with check (
  lower(email) = public.iq_current_email()
  or public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and club_id = public.iq_current_club_id()
    and lower(email) <> 'scolado@nechigroup.com'
  )
);

-- ---------------------------------------------------------------------------
-- 5. RLS: CLUBS
-- ---------------------------------------------------------------------------
alter table if exists public.clubs enable row level security;

drop policy if exists iq_clubs_select on public.clubs;
create policy iq_clubs_select on public.clubs
for select using (public.iq_can_access_club(id));

drop policy if exists iq_clubs_insert on public.clubs;
create policy iq_clubs_insert on public.clubs
for insert with check (public.iq_current_role() = 'SUPERADMIN');

drop policy if exists iq_clubs_update on public.clubs;
create policy iq_clubs_update on public.clubs
for update
using (
  public.iq_current_role() = 'SUPERADMIN'
  or (public.iq_current_role() = 'ADMIN' and id = public.iq_current_club_id())
)
with check (
  public.iq_current_role() = 'SUPERADMIN'
  or (public.iq_current_role() = 'ADMIN' and id = public.iq_current_club_id())
);

drop policy if exists iq_clubs_delete on public.clubs;
create policy iq_clubs_delete on public.clubs
for delete using (public.iq_current_role() = 'SUPERADMIN');

-- ---------------------------------------------------------------------------
-- 6. RLS: TEAMS
-- ---------------------------------------------------------------------------
alter table if exists public.teams enable row level security;

drop policy if exists iq_teams_select on public.teams;
create policy iq_teams_select on public.teams
for select using (public.iq_can_access_team(id));

drop policy if exists iq_teams_insert on public.teams;
create policy iq_teams_insert on public.teams
for insert with check (
  public.iq_current_role() = 'SUPERADMIN'
  or (public.iq_current_role() = 'ADMIN' and club_id = public.iq_current_club_id())
);

drop policy if exists iq_teams_update on public.teams;
create policy iq_teams_update on public.teams
for update
using (
  public.iq_current_role() = 'SUPERADMIN'
  or (public.iq_current_role() = 'ADMIN' and club_id = public.iq_current_club_id())
)
with check (
  public.iq_current_role() = 'SUPERADMIN'
  or (public.iq_current_role() = 'ADMIN' and club_id = public.iq_current_club_id())
);

drop policy if exists iq_teams_delete on public.teams;
create policy iq_teams_delete on public.teams
for delete using (public.iq_current_role() = 'SUPERADMIN');

-- ---------------------------------------------------------------------------
-- 7. RLS: PLAYERS
-- ---------------------------------------------------------------------------
alter table if exists public.players enable row level security;

drop policy if exists iq_players_select on public.players;
create policy iq_players_select on public.players
for select using (
  public.iq_can_access_team(team_id)
  or id = (
    select player_id from public.user_profiles
    where lower(email) = public.iq_current_email()
    limit 1
  )
  or id = any(coalesce((
    select linked_player_ids from public.user_profiles
    where lower(email) = public.iq_current_email()
    limit 1
  ), '{}'::uuid[]))
);

drop policy if exists iq_players_insert on public.players;
create policy iq_players_insert on public.players
for insert with check (public.iq_can_manage_roster(team_id));

drop policy if exists iq_players_update on public.players;
create policy iq_players_update on public.players
for update
using (public.iq_can_manage_roster(team_id))
with check (public.iq_can_manage_roster(team_id));

drop policy if exists iq_players_delete on public.players;
create policy iq_players_delete on public.players
for delete using (
  public.iq_current_role() in ('SUPERADMIN','ADMIN')
  and public.iq_can_access_team(team_id)
);

-- ---------------------------------------------------------------------------
-- 8. RLS: GAMES
-- ---------------------------------------------------------------------------
alter table if exists public.games enable row level security;

drop policy if exists iq_games_select on public.games;
create policy iq_games_select on public.games
for select using (public.iq_can_access_team(team_id));

drop policy if exists iq_games_insert on public.games;
create policy iq_games_insert on public.games
for insert with check (public.iq_can_manage_game(team_id));

drop policy if exists iq_games_update on public.games;
create policy iq_games_update on public.games
for update
using (public.iq_can_manage_game(team_id))
with check (public.iq_can_manage_game(team_id));

drop policy if exists iq_games_delete on public.games;
create policy iq_games_delete on public.games
for delete using (
  public.iq_current_role() in ('SUPERADMIN','ADMIN')
  and public.iq_can_access_team(team_id)
);

-- ---------------------------------------------------------------------------
-- 9. RLS: SEASONS
-- ---------------------------------------------------------------------------
alter table if exists public.seasons enable row level security;

drop policy if exists iq_seasons_select on public.seasons;
create policy iq_seasons_select on public.seasons
for select using (team_id is null or public.iq_can_access_team(team_id));

drop policy if exists iq_seasons_insert on public.seasons;
create policy iq_seasons_insert on public.seasons
for insert with check (
  public.iq_current_role() in ('SUPERADMIN','ADMIN','ENTRENADOR')
  and (team_id is null or public.iq_can_access_team(team_id))
);

drop policy if exists iq_seasons_update on public.seasons;
create policy iq_seasons_update on public.seasons
for update
using (
  public.iq_current_role() in ('SUPERADMIN','ADMIN','ENTRENADOR')
  and (team_id is null or public.iq_can_access_team(team_id))
)
with check (
  public.iq_current_role() in ('SUPERADMIN','ADMIN','ENTRENADOR')
  and (team_id is null or public.iq_can_access_team(team_id))
);

drop policy if exists iq_seasons_delete on public.seasons;
create policy iq_seasons_delete on public.seasons
for delete using (public.iq_current_role() = 'SUPERADMIN');

-- ---------------------------------------------------------------------------
-- 10. RLS: TABLAS DEPENDIENTES DE PARTIDO
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'player_game_stats',
    'game_period_scores',
    'game_events',
    'team_game_stats',
    'lineup_game_stats',
    'play_by_play_events'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format(
        'drop policy if exists %I on public.%I',
        'iq_' || table_name || '_select',
        table_name
      );
      execute format(
        'create policy %I on public.%I for select using (
          exists (
            select 1 from public.games g
            where g.id = game_id and public.iq_can_access_team(g.team_id)
          )
        )',
        'iq_' || table_name || '_select',
        table_name
      );

      execute format(
        'drop policy if exists %I on public.%I',
        'iq_' || table_name || '_write',
        table_name
      );
      execute format(
        'create policy %I on public.%I for all using (
          exists (
            select 1 from public.games g
            where g.id = game_id and public.iq_can_manage_game(g.team_id)
          )
        ) with check (
          exists (
            select 1 from public.games g
            where g.id = game_id and public.iq_can_manage_game(g.team_id)
          )
        )',
        'iq_' || table_name || '_write',
        table_name
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. TRADUCCIONES
-- ---------------------------------------------------------------------------
alter table if exists public.translations enable row level security;

drop policy if exists iq_translations_select on public.translations;
create policy iq_translations_select on public.translations
for select using (auth.uid() is not null);

drop policy if exists iq_translations_write on public.translations;
create policy iq_translations_write on public.translations
for all
using (public.iq_current_role() = 'SUPERADMIN')
with check (public.iq_current_role() = 'SUPERADMIN');

-- ---------------------------------------------------------------------------
-- 12. SOLICITUDES MULTIUSUARIO DE ACCESO A EQUIPOS
-- ---------------------------------------------------------------------------
create table if not exists public.team_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid null,
  requester_email text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  target_club_id uuid not null references public.clubs(id) on delete cascade,
  team_name text null,
  status text not null default 'PENDIENTE'
    check (status in ('PENDIENTE','APROBADO','RECHAZADO','CANCELADO')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  reviewed_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_access_requests_requester
  on public.team_access_requests (lower(requester_email), status);

create index if not exists idx_team_access_requests_club_status
  on public.team_access_requests (target_club_id, status);

create unique index if not exists uq_team_access_requests_pending
  on public.team_access_requests (lower(requester_email), team_id)
  where status = 'PENDIENTE';

alter table public.team_access_requests enable row level security;

drop policy if exists iq_team_access_requests_select on public.team_access_requests;
create policy iq_team_access_requests_select on public.team_access_requests
for select
using (
  lower(requester_email) = public.iq_current_email()
  or public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and target_club_id = public.iq_current_club_id()
  )
);

-- Las escrituras se realizan mediante RPC SECURITY DEFINER para que la revisión
-- y la concesión de allowed_team_ids sean atómicas.
revoke insert, update, delete on public.team_access_requests from anon, authenticated;
grant select on public.team_access_requests to authenticated;

create or replace function public.iq_list_team_directory()
returns table (
  id uuid,
  club_id uuid,
  club_name text,
  name text,
  category text,
  competition text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.club_id,
    c.name as club_name,
    t.name,
    t.category,
    t.competition
  from public.teams t
  left join public.clubs c on c.id = t.club_id
  order by c.name nulls last, t.name;
$$;

revoke all on function public.iq_list_team_directory() from public, anon;
grant execute on function public.iq_list_team_directory() to authenticated;

create or replace function public.iq_request_team_access(target_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text := public.iq_current_email();
  actor_user_id uuid := auth.uid();
  target_team public.teams%rowtype;
  existing_id uuid;
  current_ids uuid[];
begin
  if actor_user_id is null or actor_email = '' then
    raise exception 'Usuario no autenticado';
  end if;

  select * into target_team
  from public.teams
  where id = target_team_id;

  if not found then
    raise exception 'Equipo no encontrado';
  end if;

  select coalesce(allowed_team_ids, '{}'::uuid[])
         || case when team_id is null then '{}'::uuid[] else array[team_id] end
    into current_ids
  from public.user_profiles
  where lower(email) = actor_email
  limit 1;

  if target_team_id = any(coalesce(current_ids, '{}'::uuid[])) then
    raise exception 'Ya tienes acceso a este equipo';
  end if;

  select id into existing_id
  from public.team_access_requests
  where lower(requester_email) = actor_email
    and team_id = target_team_id
    and status = 'PENDIENTE'
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.team_access_requests (
    requester_user_id,
    requester_email,
    team_id,
    target_club_id,
    team_name,
    status
  )
  values (
    actor_user_id,
    actor_email,
    target_team.id,
    target_team.club_id,
    target_team.name,
    'PENDIENTE'
  )
  returning id into existing_id;

  return existing_id;
end;
$$;

revoke all on function public.iq_request_team_access(uuid) from public, anon;
grant execute on function public.iq_request_team_access(uuid) to authenticated;

create or replace function public.iq_review_team_access(
  request_id uuid,
  approve_request boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text := public.iq_current_email();
  actor_role text := public.iq_current_role();
  req public.team_access_requests%rowtype;
begin
  if auth.uid() is null or actor_email = '' then
    raise exception 'Usuario no autenticado';
  end if;

  select * into req
  from public.team_access_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if req.status <> 'PENDIENTE' then
    raise exception 'La solicitud ya ha sido resuelta';
  end if;

  if actor_role = 'ADMIN' and req.target_club_id is distinct from public.iq_current_club_id() then
    raise exception 'No puedes revisar solicitudes de otro club';
  end if;

  if actor_role not in ('SUPERADMIN','ADMIN') then
    raise exception 'Permisos insuficientes para revisar solicitudes';
  end if;

  if approve_request then
    update public.user_profiles
    set
      allowed_team_ids = case
        when req.team_id = any(coalesce(allowed_team_ids, '{}'::uuid[]))
          then coalesce(allowed_team_ids, '{}'::uuid[])
        else array_append(coalesce(allowed_team_ids, '{}'::uuid[]), req.team_id)
      end,
      team_id = coalesce(team_id, req.team_id)
    where lower(email) = lower(req.requester_email);

    if not found then
      raise exception 'No existe perfil para el usuario solicitante';
    end if;
  end if;

  update public.team_access_requests
  set
    status = case when approve_request then 'APROBADO' else 'RECHAZADO' end,
    reviewed_at = now(),
    reviewed_by_email = actor_email,
    updated_at = now()
  where id = request_id;

  return true;
end;
$$;

revoke all on function public.iq_review_team_access(uuid, boolean) from public, anon;
grant execute on function public.iq_review_team_access(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. STAFF / RESPONSABLES POR TEMPORADA
-- ---------------------------------------------------------------------------
create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid null references public.clubs(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete cascade,
  season_name text not null,
  staff_role text not null
    check (staff_role in (
      'HEAD_COACH',
      'COORDINATOR',
      'ASSISTANT_COACH',
      'PHYSICAL_TRAINER',
      'TEAM_MANAGER',
      'SPORTS_DIRECTOR'
    )),
  staff_name text null,
  user_profile_id uuid null,
  starts_at date null,
  ends_at date null,
  notes text null,
  scope_key text generated always as (
    case
      when team_id is not null then 'team:' || team_id::text
      when club_id is not null then 'club:' || club_id::text
      else 'invalid'
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (club_id is not null or team_id is not null)
);

create unique index if not exists uq_staff_assignment_scope_season_role
  on public.staff_assignments (scope_key, season_name, staff_role);

create index if not exists idx_staff_assignment_team_season
  on public.staff_assignments (team_id, season_name);

create index if not exists idx_staff_assignment_club_season
  on public.staff_assignments (club_id, season_name);

alter table public.staff_assignments enable row level security;

drop policy if exists iq_staff_assignments_select on public.staff_assignments;
create policy iq_staff_assignments_select on public.staff_assignments
for select
using (
  public.iq_current_role() = 'SUPERADMIN'
  or (
    team_id is not null
    and public.iq_can_access_team(team_id)
  )
  or (
    team_id is null
    and club_id is not null
    and public.iq_can_access_club(club_id)
  )
);

drop policy if exists iq_staff_assignments_insert on public.staff_assignments;
create policy iq_staff_assignments_insert on public.staff_assignments
for insert
with check (
  public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and (
      (team_id is not null and public.iq_can_access_team(team_id))
      or (team_id is null and club_id = public.iq_current_club_id())
    )
  )
);

drop policy if exists iq_staff_assignments_update on public.staff_assignments;
create policy iq_staff_assignments_update on public.staff_assignments
for update
using (
  public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and (
      (team_id is not null and public.iq_can_access_team(team_id))
      or (team_id is null and club_id = public.iq_current_club_id())
    )
  )
)
with check (
  public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and (
      (team_id is not null and public.iq_can_access_team(team_id))
      or (team_id is null and club_id = public.iq_current_club_id())
    )
  )
);

drop policy if exists iq_staff_assignments_delete on public.staff_assignments;
create policy iq_staff_assignments_delete on public.staff_assignments
for delete
using (
  public.iq_current_role() = 'SUPERADMIN'
  or (
    public.iq_current_role() = 'ADMIN'
    and (
      (team_id is not null and public.iq_can_access_team(team_id))
      or (team_id is null and club_id = public.iq_current_club_id())
    )
  )
);

grant select, insert, update, delete on public.staff_assignments to authenticated;

-- No se realiza backfill automático de coach_name/coordinator_name.
-- La aplicación usa esos campos como fallback legacy hasta poder auditar la
-- base de datos real y decidir a qué temporada histórica pertenece cada valor.

commit;
