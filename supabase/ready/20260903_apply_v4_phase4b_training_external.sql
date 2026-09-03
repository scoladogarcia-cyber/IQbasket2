-- =============================================================================
-- IQBasket v4 · Phase 4B · Training Core + External Development
-- Branch: feature/player360-core-v1
-- Date: 2026-09-03
--
-- PURPOSE
-- - Add first Player 360 domain tables without changing games/stats/roster.
-- - Keep training and external development independent but team-season scoped.
-- - Enforce temporal roster eligibility for recorded player participation.
-- - Add staff-only RLS and controlled RPC write boundaries.
--
-- IMPORTANT
-- - No Recovery / Nutrition / Neuro data in this phase.
-- - No AI-generated values are stored as observations.
-- - Existing v3 sporting tables are not modified.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.roster_membership_stints') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null then
    raise exception 'PLAYER360_PHASE4B_V3_PREREQUISITES_MISSING';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Authorization helpers
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_can_view_player360_team_season(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.team_seasons ts
      join public.teams t on t.id = ts.team_id
      where ts.id = p_team_season_id
        and (
          public.iq_v3_is_global_superadmin()

          or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = ts.id
              and upper(coalesce(m.status, 'ACTIVE')) = 'ACTIVE'
              and (m.valid_from is null or m.valid_from <= now())
              and (m.valid_until is null or m.valid_until > now())
              and upper(m.function_role) in (
                'ADMIN',
                'COORDINADOR',
                'DIRECTOR_DEPORTIVO',
                'ENTRENADOR',
                'AYUDANTE',
                'ANALISTA',
                'PREPARADOR_FISICO'
              )
          )

          or exists (
            select 1
            from public.club_season_memberships cm
            where cm.user_id = auth.uid()
              and cm.club_id = t.club_id
              and cm.season_id = ts.season_id
              and upper(coalesce(cm.status, 'ACTIVE')) = 'ACTIVE'
              and (cm.valid_from is null or cm.valid_from <= now())
              and (cm.valid_until is null or cm.valid_until > now())
              and upper(cm.function_role) in (
                'ADMIN',
                'COORDINADOR',
                'DIRECTOR_DEPORTIVO',
                'ANALISTA'
              )
          )

          or exists (
            select 1
            from public.user_profiles up
            cross join lateral jsonb_array_elements_text(
              coalesce(to_jsonb(up.assigned_team_ids), '[]'::jsonb)
            ) assigned(team_id)
            where up.id = auth.uid()
              and assigned.team_id = ts.team_id::text
              and upper(coalesce(up.global_role, up.role, 'USER')) in (
                'ADMIN',
                'ENTRENADOR',
                'ANALISTA',
                'PREPARADOR_FISICO'
              )
          )
        )
    );
$$;

create or replace function public.iq_v4_can_manage_training(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.team_seasons ts
      join public.teams t on t.id = ts.team_id
      where ts.id = p_team_season_id
        and (
          public.iq_v3_is_global_superadmin()

          or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = auth.uid()
              and m.team_season_id = ts.id
              and upper(coalesce(m.status, 'ACTIVE')) = 'ACTIVE'
              and (m.valid_from is null or m.valid_from <= now())
              and (m.valid_until is null or m.valid_until > now())
              and upper(m.function_role) in (
                'ADMIN',
                'COORDINADOR',
                'DIRECTOR_DEPORTIVO',
                'ENTRENADOR',
                'AYUDANTE',
                'PREPARADOR_FISICO'
              )
          )

          or exists (
            select 1
            from public.club_season_memberships cm
            where cm.user_id = auth.uid()
              and cm.club_id = t.club_id
              and cm.season_id = ts.season_id
              and upper(coalesce(cm.status, 'ACTIVE')) = 'ACTIVE'
              and (cm.valid_from is null or cm.valid_from <= now())
              and (cm.valid_until is null or cm.valid_until > now())
              and upper(cm.function_role) in (
                'ADMIN',
                'COORDINADOR',
                'DIRECTOR_DEPORTIVO'
              )
          )

          or exists (
            select 1
            from public.user_profiles up
            cross join lateral jsonb_array_elements_text(
              coalesce(to_jsonb(up.assigned_team_ids), '[]'::jsonb)
            ) assigned(team_id)
            where up.id = auth.uid()
              and assigned.team_id = ts.team_id::text
              and upper(coalesce(up.global_role, up.role, 'USER')) in (
                'ADMIN',
                'ENTRENADOR',
                'PREPARADOR_FISICO'
              )
          )
        )
    );
$$;

revoke all on function public.iq_v4_can_view_player360_team_season(uuid) from public;
revoke all on function public.iq_v4_can_manage_training(uuid) from public;
grant execute on function public.iq_v4_can_view_player360_team_season(uuid) to authenticated;
grant execute on function public.iq_v4_can_manage_training(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Configurable activity catalog
-- -----------------------------------------------------------------------------

create table public.player360_activity_types (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  module text not null,
  code text not null,
  name text not null,
  category text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_activity_types_module_check
    check (module in ('TRAINING','EXTERNAL_DEVELOPMENT')),
  constraint player360_activity_types_code_nonempty
    check (length(trim(code)) > 0),
  constraint player360_activity_types_name_nonempty
    check (length(trim(name)) > 0),
  constraint player360_activity_types_unique
    unique (team_season_id, module, code)
);

create index idx_player360_activity_types_scope
  on public.player360_activity_types(team_season_id, module, is_active, sort_order);

-- -----------------------------------------------------------------------------
-- 3. Training Core
-- -----------------------------------------------------------------------------

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete restrict,
  session_date date not null,
  start_time time,
  end_time time,
  title text not null,
  objective text,
  duration_minutes integer,
  intensity numeric(4,2),
  status text not null default 'PLANNED',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_sessions_title_nonempty
    check (length(trim(title)) > 0),
  constraint training_sessions_duration_check
    check (duration_minutes is null or duration_minutes between 1 and 600),
  constraint training_sessions_intensity_check
    check (intensity is null or intensity between 0 and 10),
  constraint training_sessions_status_check
    check (status in ('PLANNED','COMPLETED','CANCELLED','ARCHIVED')),
  constraint training_sessions_time_order_check
    check (start_time is null or end_time is null or end_time > start_time),
  constraint training_sessions_id_scope_unique
    unique (id, team_season_id)
);

create index idx_training_sessions_scope_date
  on public.training_sessions(team_season_id, session_date desc);

create index idx_training_sessions_status
  on public.training_sessions(team_season_id, status, session_date desc);

create table public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null
    references public.training_sessions(id) on delete cascade,
  activity_type_id uuid
    references public.player360_activity_types(id) on delete set null,
  block_order integer not null default 1,
  activity_code text,
  title text not null,
  objective text,
  duration_minutes integer,
  intensity numeric(4,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_blocks_order_check check (block_order > 0),
  constraint training_blocks_title_nonempty check (length(trim(title)) > 0),
  constraint training_blocks_duration_check
    check (duration_minutes is null or duration_minutes between 1 and 300),
  constraint training_blocks_intensity_check
    check (intensity is null or intensity between 0 and 10)
);

create index idx_training_blocks_session_order
  on public.training_blocks(training_session_id, block_order);

create table public.training_participants (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null,
  team_season_id uuid not null,
  player_id uuid not null
    references public.players(id) on delete restrict,
  attendance_status text not null default 'PLANNED',
  participated_minutes integer,
  rpe numeric(4,2),
  internal_load numeric generated always as (
    case
      when participated_minutes is null or rpe is null then null
      else participated_minutes::numeric * rpe
    end
  ) stored,
  notes text,
  captured_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_participants_session_scope_fk
    foreign key (training_session_id, team_season_id)
    references public.training_sessions(id, team_season_id)
    on delete cascade,
  constraint training_participants_unique
    unique (training_session_id, player_id),
  constraint training_participants_attendance_check
    check (attendance_status in ('PLANNED','PRESENT','PARTIAL','ABSENT','EXCUSED')),
  constraint training_participants_minutes_check
    check (participated_minutes is null or participated_minutes between 0 and 600),
  constraint training_participants_rpe_check
    check (rpe is null or rpe between 0 and 10)
);

create index idx_training_participants_player_scope
  on public.training_participants(player_id, team_season_id);

create index idx_training_participants_session
  on public.training_participants(training_session_id, attendance_status);

-- -----------------------------------------------------------------------------
-- 4. External Development
-- -----------------------------------------------------------------------------

create table public.external_development_sessions (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete restrict,
  player_id uuid not null
    references public.players(id) on delete restrict,
  activity_type_id uuid
    references public.player360_activity_types(id) on delete set null,
  activity_date date not null,
  title text not null,
  activity_code text,
  provider_type text,
  provider_name text,
  objective text,
  duration_minutes integer,
  intensity numeric(4,2),
  rpe numeric(4,2),
  internal_load numeric generated always as (
    case
      when duration_minutes is null or rpe is null then null
      else duration_minutes::numeric * rpe
    end
  ) stored,
  source_type text not null default 'EXTERNAL_COACH',
  notes text,
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_development_title_nonempty
    check (length(trim(title)) > 0),
  constraint external_development_duration_check
    check (duration_minutes is null or duration_minutes between 1 and 600),
  constraint external_development_intensity_check
    check (intensity is null or intensity between 0 and 10),
  constraint external_development_rpe_check
    check (rpe is null or rpe between 0 and 10),
  constraint external_development_source_nonempty
    check (length(trim(source_type)) > 0)
);

create index idx_external_development_player_date
  on public.external_development_sessions(player_id, activity_date desc);

create index idx_external_development_scope_date
  on public.external_development_sessions(team_season_id, activity_date desc);

-- -----------------------------------------------------------------------------
-- 5. Shared validation / timestamp triggers
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.iq_v4_validate_session_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  season_start date;
  season_end date;
begin
  select sc.start_date, sc.end_date
    into season_start, season_end
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where ts.id = new.team_season_id;

  if season_start is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if new.session_date < season_start
     or (season_end is not null and new.session_date > season_end) then
    raise exception 'TRAINING_DATE_OUTSIDE_SEASON';
  end if;

  return new;
end;
$$;

create or replace function public.iq_v4_validate_training_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_scope uuid;
  training_date date;
begin
  select s.team_season_id, s.session_date
    into session_scope, training_date
  from public.training_sessions s
  where s.id = new.training_session_id;

  if session_scope is null then
    raise exception 'TRAINING_SESSION_NOT_FOUND';
  end if;

  if new.team_season_id is distinct from session_scope then
    raise exception 'TRAINING_PARTICIPANT_SCOPE_MISMATCH';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    new.player_id,
    session_scope,
    training_date
  ) then
    raise exception 'PLAYER_NOT_ELIGIBLE_ON_TRAINING_DATE';
  end if;

  return new;
end;
$$;

create or replace function public.iq_v4_validate_external_development()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  season_start date;
  season_end date;
begin
  select sc.start_date, sc.end_date
    into season_start, season_end
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where ts.id = new.team_season_id;

  if season_start is null then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if new.activity_date < season_start
     or (season_end is not null and new.activity_date > season_end) then
    raise exception 'EXTERNAL_DEVELOPMENT_DATE_OUTSIDE_SEASON';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    new.player_id,
    new.team_season_id,
    new.activity_date
  ) then
    raise exception 'PLAYER_NOT_ELIGIBLE_ON_EXTERNAL_DEVELOPMENT_DATE';
  end if;

  return new;
end;
$$;

create trigger trg_player360_activity_types_touch
before update on public.player360_activity_types
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_training_sessions_validate_date
before insert or update of team_season_id, session_date
on public.training_sessions
for each row execute function public.iq_v4_validate_session_date();

create trigger trg_training_sessions_touch
before update on public.training_sessions
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_training_blocks_touch
before update on public.training_blocks
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_training_participants_validate
before insert or update of training_session_id, team_season_id, player_id
on public.training_participants
for each row execute function public.iq_v4_validate_training_participant();

create trigger trg_training_participants_touch
before update on public.training_participants
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_external_development_validate
before insert or update of team_season_id, player_id, activity_date
on public.external_development_sessions
for each row execute function public.iq_v4_validate_external_development();

create trigger trg_external_development_touch
before update on public.external_development_sessions
for each row execute function public.iq_v4_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------

alter table public.player360_activity_types enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_blocks enable row level security;
alter table public.training_participants enable row level security;
alter table public.external_development_sessions enable row level security;

create policy iq_v4_activity_types_select
on public.player360_activity_types
for select to authenticated
using (public.iq_v4_can_view_player360_team_season(team_season_id));

create policy iq_v4_activity_types_insert
on public.player360_activity_types
for insert to authenticated
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_activity_types_update
on public.player360_activity_types
for update to authenticated
using (public.iq_v4_can_manage_training(team_season_id))
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_activity_types_delete
on public.player360_activity_types
for delete to authenticated
using (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_training_sessions_select
on public.training_sessions
for select to authenticated
using (public.iq_v4_can_view_player360_team_season(team_season_id));

create policy iq_v4_training_sessions_insert
on public.training_sessions
for insert to authenticated
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_training_sessions_update
on public.training_sessions
for update to authenticated
using (public.iq_v4_can_manage_training(team_season_id))
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_training_sessions_delete
on public.training_sessions
for delete to authenticated
using (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_training_blocks_select
on public.training_blocks
for select to authenticated
using (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_blocks.training_session_id
      and public.iq_v4_can_view_player360_team_season(s.team_season_id)
  )
);

create policy iq_v4_training_blocks_insert
on public.training_blocks
for insert to authenticated
with check (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_blocks.training_session_id
      and public.iq_v4_can_manage_training(s.team_season_id)
  )
);

create policy iq_v4_training_blocks_update
on public.training_blocks
for update to authenticated
using (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_blocks.training_session_id
      and public.iq_v4_can_manage_training(s.team_season_id)
  )
)
with check (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_blocks.training_session_id
      and public.iq_v4_can_manage_training(s.team_season_id)
  )
);

create policy iq_v4_training_blocks_delete
on public.training_blocks
for delete to authenticated
using (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_blocks.training_session_id
      and public.iq_v4_can_manage_training(s.team_season_id)
  )
);

create policy iq_v4_training_participants_select
on public.training_participants
for select to authenticated
using (public.iq_v4_can_view_player360_team_season(team_season_id));

create policy iq_v4_training_participants_insert
on public.training_participants
for insert to authenticated
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_training_participants_update
on public.training_participants
for update to authenticated
using (public.iq_v4_can_manage_training(team_season_id))
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_training_participants_delete
on public.training_participants
for delete to authenticated
using (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_external_development_select
on public.external_development_sessions
for select to authenticated
using (public.iq_v4_can_view_player360_team_season(team_season_id));

create policy iq_v4_external_development_insert
on public.external_development_sessions
for insert to authenticated
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_external_development_update
on public.external_development_sessions
for update to authenticated
using (public.iq_v4_can_manage_training(team_season_id))
with check (public.iq_v4_can_manage_training(team_season_id));

create policy iq_v4_external_development_delete
on public.external_development_sessions
for delete to authenticated
using (public.iq_v4_can_manage_training(team_season_id));

grant select, insert, update, delete
  on public.player360_activity_types,
     public.training_sessions,
     public.training_blocks,
     public.training_participants,
     public.external_development_sessions
  to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Controlled write RPCs
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_create_training_session(
  p_team_season_id uuid,
  p_session_date date,
  p_title text,
  p_objective text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_start_time time default null,
  p_end_time time default null,
  p_blocks jsonb default '[]'::jsonb,
  p_participants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  block_item jsonb;
  participant_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'TRAINING_TITLE_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_participants, '[]'::jsonb)) <> 'array' then
    raise exception 'TRAINING_CHILDREN_MUST_BE_ARRAYS';
  end if;

  insert into public.training_sessions (
    team_season_id,
    session_date,
    start_time,
    end_time,
    title,
    objective,
    duration_minutes,
    intensity,
    status,
    created_by,
    updated_by
  )
  values (
    p_team_season_id,
    p_session_date,
    p_start_time,
    p_end_time,
    trim(p_title),
    nullif(trim(coalesce(p_objective, '')), ''),
    p_duration_minutes,
    p_intensity,
    'PLANNED',
    auth.uid(),
    auth.uid()
  )
  returning id into v_session_id;

  for block_item in
    select value
    from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb))
  loop
    insert into public.training_blocks (
      training_session_id,
      activity_type_id,
      block_order,
      activity_code,
      title,
      objective,
      duration_minutes,
      intensity,
      metadata
    )
    values (
      v_session_id,
      case
        when nullif(block_item ->> 'activity_type_id', '') is null then null
        else (block_item ->> 'activity_type_id')::uuid
      end,
      coalesce((block_item ->> 'block_order')::integer, 1),
      nullif(trim(coalesce(block_item ->> 'activity_code', '')), ''),
      trim(coalesce(block_item ->> 'title', 'Bloque')),
      nullif(trim(coalesce(block_item ->> 'objective', '')), ''),
      nullif(block_item ->> 'duration_minutes', '')::integer,
      nullif(block_item ->> 'intensity', '')::numeric,
      coalesce(block_item -> 'metadata', '{}'::jsonb)
    );
  end loop;

  for participant_item in
    select value
    from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
  loop
    insert into public.training_participants (
      training_session_id,
      team_season_id,
      player_id,
      attendance_status,
      participated_minutes,
      rpe,
      notes,
      captured_by
    )
    values (
      v_session_id,
      p_team_season_id,
      (participant_item ->> 'player_id')::uuid,
      upper(coalesce(nullif(participant_item ->> 'attendance_status', ''), 'PLANNED')),
      nullif(participant_item ->> 'participated_minutes', '')::integer,
      nullif(participant_item ->> 'rpe', '')::numeric,
      nullif(trim(coalesce(participant_item ->> 'notes', '')), ''),
      auth.uid()
    );
  end loop;

  return v_session_id;
end;
$$;

create or replace function public.iq_v4_set_training_participant(
  p_training_session_id uuid,
  p_player_id uuid,
  p_attendance_status text,
  p_participated_minutes integer default null,
  p_rpe numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_season_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.team_season_id
    into v_team_season_id
  from public.training_sessions s
  where s.id = p_training_session_id;

  if v_team_season_id is null then
    raise exception 'TRAINING_SESSION_NOT_FOUND';
  end if;

  if not public.iq_v4_can_manage_training(v_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  insert into public.training_participants (
    training_session_id,
    team_season_id,
    player_id,
    attendance_status,
    participated_minutes,
    rpe,
    notes,
    captured_by
  )
  values (
    p_training_session_id,
    v_team_season_id,
    p_player_id,
    upper(coalesce(nullif(trim(p_attendance_status), ''), 'PLANNED')),
    p_participated_minutes,
    p_rpe,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  on conflict (training_session_id, player_id)
  do update set
    attendance_status = excluded.attendance_status,
    participated_minutes = excluded.participated_minutes,
    rpe = excluded.rpe,
    notes = excluded.notes,
    captured_by = auth.uid(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.iq_v4_archive_training_session(
  p_training_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_season_id uuid;
begin
  select s.team_season_id
    into v_team_season_id
  from public.training_sessions s
  where s.id = p_training_session_id;

  if v_team_season_id is null then
    raise exception 'TRAINING_SESSION_NOT_FOUND';
  end if;

  if not public.iq_v4_can_manage_training(v_team_season_id) then
    raise exception 'TRAINING_MANAGE_DENIED';
  end if;

  update public.training_sessions
  set status = 'ARCHIVED',
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_training_session_id;

  return true;
end;
$$;

create or replace function public.iq_v4_create_external_development(
  p_team_season_id uuid,
  p_player_id uuid,
  p_activity_date date,
  p_title text,
  p_activity_code text default null,
  p_activity_type_id uuid default null,
  p_provider_type text default null,
  p_provider_name text default null,
  p_objective text default null,
  p_duration_minutes integer default null,
  p_intensity numeric default null,
  p_rpe numeric default null,
  p_source_type text default 'EXTERNAL_COACH',
  p_notes text default null,
  p_provenance jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_manage_training(p_team_season_id) then
    raise exception 'EXTERNAL_DEVELOPMENT_MANAGE_DENIED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'EXTERNAL_DEVELOPMENT_TITLE_REQUIRED';
  end if;

  insert into public.external_development_sessions (
    team_season_id,
    player_id,
    activity_type_id,
    activity_date,
    title,
    activity_code,
    provider_type,
    provider_name,
    objective,
    duration_minutes,
    intensity,
    rpe,
    source_type,
    notes,
    provenance,
    metadata,
    created_by,
    updated_by
  )
  values (
    p_team_season_id,
    p_player_id,
    p_activity_type_id,
    p_activity_date,
    trim(p_title),
    nullif(trim(coalesce(p_activity_code, '')), ''),
    nullif(trim(coalesce(p_provider_type, '')), ''),
    nullif(trim(coalesce(p_provider_name, '')), ''),
    nullif(trim(coalesce(p_objective, '')), ''),
    p_duration_minutes,
    p_intensity,
    p_rpe,
    upper(coalesce(nullif(trim(p_source_type), ''), 'EXTERNAL_COACH')),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_provenance, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid(),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.iq_v4_training_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'training_core', true,
    'external_development', true,
    'activity_catalog', true,
    'temporal_roster_validation', true,
    'recovery', false,
    'nutrition', false,
    'neuro_cognitive', false,
    'contract_version', 'PLAYER360_OBSERVATION_V1'
  );
$$;

revoke all on function public.iq_v4_create_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) from public;
revoke all on function public.iq_v4_set_training_participant(
  uuid,uuid,text,integer,numeric,text
) from public;
revoke all on function public.iq_v4_archive_training_session(uuid) from public;
revoke all on function public.iq_v4_create_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
) from public;
revoke all on function public.iq_v4_training_capabilities() from public;

grant execute on function public.iq_v4_create_training_session(
  uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb
) to authenticated;
grant execute on function public.iq_v4_set_training_participant(
  uuid,uuid,text,integer,numeric,text
) to authenticated;
grant execute on function public.iq_v4_archive_training_session(uuid) to authenticated;
grant execute on function public.iq_v4_create_external_development(
  uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb
) to authenticated;
grant execute on function public.iq_v4_training_capabilities() to authenticated;

comment on table public.training_sessions is
'Player 360 Training Core session header, scoped to one team-season.';
comment on table public.training_blocks is
'Independent blocks inside one Training Core session.';
comment on table public.training_participants is
'Player attendance, RPE and internal load for a Training Core session.';
comment on table public.external_development_sessions is
'Player-specific development performed outside the club/team training session.';
comment on table public.player360_activity_types is
'Configurable activity catalog for Training and External Development.';

commit;

select
  'PLAYER360_PHASE4B_APPLY' as section,
  to_regclass('public.training_sessions') is not null as training_sessions_ok,
  to_regclass('public.training_blocks') is not null as training_blocks_ok,
  to_regclass('public.training_participants') is not null as training_participants_ok,
  to_regclass('public.external_development_sessions') is not null as external_development_ok,
  to_regclass('public.player360_activity_types') is not null as activity_catalog_ok,
  to_regprocedure('public.iq_v4_create_training_session(uuid,date,text,text,integer,numeric,time,time,jsonb,jsonb)') is not null as create_training_rpc_ok,
  to_regprocedure('public.iq_v4_create_external_development(uuid,uuid,date,text,text,uuid,text,text,text,integer,numeric,numeric,text,text,jsonb,jsonb)') is not null as create_external_rpc_ok;
