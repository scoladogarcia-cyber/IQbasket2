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
  if is_service then
    return new;
  end if;

  -- La identidad maestra no puede perder SUPERADMIN.
  if target_email = 'scolado@nechigroup.com' then
    if actor_email <> 'scolado@nechigroup.com' then
      raise exception 'Solo el Superadmin único puede modificar su perfil privilegiado';
    end if;
    new.role := 'SUPERADMIN';
    return new;
  end if;

  -- Nadie más puede ser SUPERADMIN.
  if upper(coalesce(new.role, 'INVITADO')) = 'SUPERADMIN' then
    raise exception 'SUPERADMIN está reservado a scolado@nechigroup.com';
  end if;

  if tg_op = 'INSERT' then
    -- Registro público: únicamente perfil propio INVITADO.
    if actor_role <> 'SUPERADMIN' then
      if actor_email <> target_email then
        raise exception 'No se puede crear un perfil para otra identidad';
      end if;
      new.role := 'INVITADO';
    end if;
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

commit;
