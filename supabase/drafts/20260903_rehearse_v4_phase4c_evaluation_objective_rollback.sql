-- =============================================================================
-- IQBasket v4 · Phase 4C · Player Evaluation + Objective Profile
-- Branch: feature/player360-core-v1
-- Date: 2026-09-03
--
-- PURPOSE
-- - Add configurable evaluation metrics without hardcoded sport columns.
-- - Store dated, revision-preserving human evaluations.
-- - Store one versioned objective profile per player/team-season.
-- - Expose deterministic objective gaps without AI inference.
-- - Keep direct authenticated mutations closed; writes go through controlled RPCs.
--
-- IMPORTANT
-- - Existing game/stat/roster/training tables are not modified.
-- - Player/family access is NOT enabled in this phase.
-- - AI output is not stored as evaluation evidence.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.team_seasons') is null
     or to_regclass('public.players') is null
     or to_regclass('public.training_sessions') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v4_can_view_player360_team_season(uuid)') is null
     or to_regprocedure('public.iq_v4_touch_updated_at()') is null then
    raise exception 'PLAYER360_PHASE4C_PREREQUISITES_MISSING';
  end if;

  if to_regclass('public.player360_evaluation_metrics') is not null
     or to_regclass('public.player_evaluations') is not null
     or to_regclass('public.player_evaluation_scores') is not null
     or to_regclass('public.player_objective_profiles') is not null
     or to_regclass('public.player_objective_targets') is not null then
    raise exception 'PLAYER360_PHASE4C_ALREADY_INSTALLED';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Authorization helpers
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_can_manage_evaluation(
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
                'AYUDANTE'
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
                'ENTRENADOR'
              )
          )
        )
    );
$$;

create or replace function public.iq_v4_can_view_private_evaluation(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.iq_v4_can_manage_evaluation(p_team_season_id);
$$;

create or replace function public.iq_v4_can_manage_objective_profile(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.iq_v4_can_manage_evaluation(p_team_season_id);
$$;

revoke all on function public.iq_v4_can_manage_evaluation(uuid) from public;
revoke all on function public.iq_v4_can_view_private_evaluation(uuid) from public;
revoke all on function public.iq_v4_can_manage_objective_profile(uuid) from public;

grant execute on function public.iq_v4_can_manage_evaluation(uuid) to authenticated;
grant execute on function public.iq_v4_can_view_private_evaluation(uuid) to authenticated;
grant execute on function public.iq_v4_can_manage_objective_profile(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Configurable evaluation metric catalog
-- -----------------------------------------------------------------------------

create table public.player360_evaluation_metrics (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid
    references public.team_seasons(id) on delete cascade,
  code text not null,
  domain_code text not null,
  name text not null,
  description text,
  scale_min numeric(8,3) not null default 0,
  scale_max numeric(8,3) not null default 10,
  scale_step numeric(8,3) not null default 0.5,
  higher_is_better boolean not null default true,
  sensitivity text not null default 'PRIVATE_SPORTING',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_eval_metric_code_nonempty check (length(trim(code)) > 0),
  constraint player360_eval_metric_domain_nonempty check (length(trim(domain_code)) > 0),
  constraint player360_eval_metric_name_nonempty check (length(trim(name)) > 0),
  constraint player360_eval_metric_scale_order check (scale_max > scale_min),
  constraint player360_eval_metric_step_check check (scale_step > 0),
  constraint player360_eval_metric_sensitivity_check
    check (sensitivity in ('STANDARD','PRIVATE_SPORTING'))
);

create unique index uq_player360_eval_metric_global_code
  on public.player360_evaluation_metrics(upper(code))
  where team_season_id is null;

create unique index uq_player360_eval_metric_scope_code
  on public.player360_evaluation_metrics(team_season_id, upper(code))
  where team_season_id is not null;

create index idx_player360_eval_metric_scope_domain
  on public.player360_evaluation_metrics(team_season_id, domain_code, is_active, sort_order);

-- Global default template. These are configurable definitions, not schema columns.
insert into public.player360_evaluation_metrics (
  team_season_id, code, domain_code, name, description,
  scale_min, scale_max, scale_step, higher_is_better,
  sensitivity, is_active, sort_order
)
values
  (null,'BALL_HANDLING','TECHNICAL','Manejo de balón','Control, protección y cambio de dirección con balón.',0,10,0.5,true,'PRIVATE_SPORTING',true,10),
  (null,'PASSING','TECHNICAL','Pase','Calidad, precisión, timing y variedad de pase.',0,10,0.5,true,'PRIVATE_SPORTING',true,20),
  (null,'SHOOTING','TECHNICAL','Tiro','Ejecución, equilibrio, selección y consistencia de tiro.',0,10,0.5,true,'PRIVATE_SPORTING',true,30),
  (null,'FINISHING','TECHNICAL','Finalización','Recursos y eficacia cerca del aro.',0,10,0.5,true,'PRIVATE_SPORTING',true,40),
  (null,'FOOTWORK','TECHNICAL','Trabajo de pies','Calidad de apoyos, paradas, pivotes y coordinación específica.',0,10,0.5,true,'PRIVATE_SPORTING',true,50),

  (null,'DECISION_MAKING','TACTICAL','Toma de decisiones','Elección y velocidad de respuesta ante contextos de juego.',0,10,0.5,true,'PRIVATE_SPORTING',true,110),
  (null,'OFF_BALL_SPACING','TACTICAL','Juego sin balón y espacios','Ocupación de espacios, cortes y generación de ventajas sin balón.',0,10,0.5,true,'PRIVATE_SPORTING',true,120),
  (null,'PICK_ROLL_READING','TACTICAL','Lectura de bloqueo directo','Identificación y explotación de respuestas defensivas en P&R.',0,10,0.5,true,'PRIVATE_SPORTING',true,130),
  (null,'TEAM_DEFENSE','TACTICAL','Defensa colectiva','Ayudas, rotaciones, comunicación y disciplina defensiva.',0,10,0.5,true,'PRIVATE_SPORTING',true,140),
  (null,'TRANSITION_PLAY','TACTICAL','Transición','Lectura y ejecución en transición ofensiva y defensiva.',0,10,0.5,true,'PRIVATE_SPORTING',true,150),

  (null,'SPEED_ACCELERATION','PHYSICAL','Velocidad y aceleración','Capacidad de acelerar y desplazarse a alta velocidad.',0,10,0.5,true,'PRIVATE_SPORTING',true,210),
  (null,'AGILITY','PHYSICAL','Agilidad','Cambio de dirección, frenada y re-aceleración.',0,10,0.5,true,'PRIVATE_SPORTING',true,220),
  (null,'STRENGTH','PHYSICAL','Fuerza','Capacidad de producir y soportar fuerza en acciones de juego.',0,10,0.5,true,'PRIVATE_SPORTING',true,230),
  (null,'EXPLOSIVENESS','PHYSICAL','Explosividad','Producción rápida de fuerza, salto y primeras acciones.',0,10,0.5,true,'PRIVATE_SPORTING',true,240),
  (null,'ENDURANCE','PHYSICAL','Resistencia específica','Capacidad de sostener rendimiento y repetir esfuerzos.',0,10,0.5,true,'PRIVATE_SPORTING',true,250);

-- -----------------------------------------------------------------------------
-- 3. Dated revision-preserving evaluations
-- -----------------------------------------------------------------------------

create table public.player_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluation_key uuid not null default gen_random_uuid(),
  revision integer not null default 1,
  supersedes_evaluation_id uuid
    references public.player_evaluations(id) on delete restrict,
  team_season_id uuid not null
    references public.team_seasons(id) on delete restrict,
  player_id uuid not null
    references public.players(id) on delete restrict,
  evaluation_date date not null,
  title text not null,
  evaluation_type text not null default 'GENERAL',
  source_type text not null default 'CLUB_COACH',
  evaluator_user_id uuid references public.user_profiles(id) on delete set null,
  evaluator_name text,
  summary text,
  strengths text,
  development_priorities text,
  is_private boolean not null default false,
  share_with_player boolean not null default false,
  status text not null default 'CURRENT',
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_evaluations_revision_check check (revision > 0),
  constraint player_evaluations_title_nonempty check (length(trim(title)) > 0),
  constraint player_evaluations_type_nonempty check (length(trim(evaluation_type)) > 0),
  constraint player_evaluations_source_nonempty check (length(trim(source_type)) > 0),
  constraint player_evaluations_status_check
    check (status in ('CURRENT','SUPERSEDED','ARCHIVED')),
  constraint player_evaluations_scope_unique unique (id, team_season_id),
  constraint player_evaluations_chain_revision_unique unique (evaluation_key, revision)
);

create index idx_player_evaluations_player_date
  on public.player_evaluations(player_id, team_season_id, evaluation_date desc, created_at desc);

create index idx_player_evaluations_current
  on public.player_evaluations(team_season_id, player_id, status, evaluation_date desc);

create table public.player_evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null,
  team_season_id uuid not null,
  metric_definition_id uuid
    references public.player360_evaluation_metrics(id) on delete set null,
  metric_code text not null,
  domain_code text not null,
  metric_name text not null,
  scale_min numeric(8,3) not null,
  scale_max numeric(8,3) not null,
  higher_is_better boolean not null default true,
  score numeric(8,3) not null,
  confidence numeric(5,4),
  notes text,
  evidence text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint player_eval_scores_parent_scope_fk
    foreign key (evaluation_id, team_season_id)
    references public.player_evaluations(id, team_season_id)
    on delete cascade,
  constraint player_eval_scores_metric_nonempty check (length(trim(metric_code)) > 0),
  constraint player_eval_scores_scale_order check (scale_max > scale_min),
  constraint player_eval_scores_range_check check (score between scale_min and scale_max),
  constraint player_eval_scores_confidence_check
    check (confidence is null or confidence between 0 and 1),
  constraint player_eval_scores_unique unique (evaluation_id, metric_code)
);

create index idx_player_eval_scores_metric
  on public.player_evaluation_scores(team_season_id, metric_code, evaluation_id);

-- -----------------------------------------------------------------------------
-- 4. Versioned objective profile
-- -----------------------------------------------------------------------------

create table public.player_objective_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key uuid not null default gen_random_uuid(),
  revision integer not null default 1,
  supersedes_profile_id uuid
    references public.player_objective_profiles(id) on delete restrict,
  team_season_id uuid not null
    references public.team_seasons(id) on delete restrict,
  player_id uuid not null
    references public.players(id) on delete restrict,
  effective_date date not null,
  target_date date,
  title text not null,
  rationale text,
  status text not null default 'ACTIVE',
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_objective_profiles_revision_check check (revision > 0),
  constraint player_objective_profiles_title_nonempty check (length(trim(title)) > 0),
  constraint player_objective_profiles_date_order
    check (target_date is null or target_date >= effective_date),
  constraint player_objective_profiles_status_check
    check (status in ('ACTIVE','SUPERSEDED','ARCHIVED')),
  constraint player_objective_profiles_scope_unique unique (id, team_season_id),
  constraint player_objective_profiles_chain_revision_unique unique (profile_key, revision)
);

create unique index uq_player_objective_profiles_one_active
  on public.player_objective_profiles(team_season_id, player_id)
  where status = 'ACTIVE';

create index idx_player_objective_profiles_player
  on public.player_objective_profiles(player_id, team_season_id, status, effective_date desc);

create table public.player_objective_targets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  team_season_id uuid not null,
  metric_definition_id uuid
    references public.player360_evaluation_metrics(id) on delete set null,
  metric_code text not null,
  domain_code text not null,
  metric_name text not null,
  scale_min numeric(8,3) not null,
  scale_max numeric(8,3) not null,
  higher_is_better boolean not null default true,
  target_score numeric(8,3) not null,
  priority_weight numeric(8,3) not null default 1,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint player_objective_targets_parent_scope_fk
    foreign key (profile_id, team_season_id)
    references public.player_objective_profiles(id, team_season_id)
    on delete cascade,
  constraint player_objective_targets_metric_nonempty check (length(trim(metric_code)) > 0),
  constraint player_objective_targets_scale_order check (scale_max > scale_min),
  constraint player_objective_targets_range_check
    check (target_score between scale_min and scale_max),
  constraint player_objective_targets_weight_check
    check (priority_weight > 0 and priority_weight <= 100),
  constraint player_objective_targets_unique unique (profile_id, metric_code)
);

create index idx_player_objective_targets_metric
  on public.player_objective_targets(team_season_id, metric_code, profile_id);

-- -----------------------------------------------------------------------------
-- 5. Timestamp triggers
-- -----------------------------------------------------------------------------

create trigger trg_player360_eval_metrics_touch
before update on public.player360_evaluation_metrics
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player_evaluations_touch
before update on public.player_evaluations
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player_objective_profiles_touch
before update on public.player_objective_profiles
for each row execute function public.iq_v4_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. RLS: read is scoped, direct writes are closed
-- -----------------------------------------------------------------------------

alter table public.player360_evaluation_metrics enable row level security;
alter table public.player_evaluations enable row level security;
alter table public.player_evaluation_scores enable row level security;
alter table public.player_objective_profiles enable row level security;
alter table public.player_objective_targets enable row level security;

create policy iq_v4_eval_metrics_select
on public.player360_evaluation_metrics
for select to authenticated
using (
  team_season_id is null
  or public.iq_v4_can_view_player360_team_season(team_season_id)
);

create policy iq_v4_player_evaluations_select
on public.player_evaluations
for select to authenticated
using (
  public.iq_v4_can_view_player360_team_season(team_season_id)
  and (
    not is_private
    or public.iq_v4_can_view_private_evaluation(team_season_id)
  )
);

create policy iq_v4_player_eval_scores_select
on public.player_evaluation_scores
for select to authenticated
using (
  exists (
    select 1
    from public.player_evaluations e
    where e.id = player_evaluation_scores.evaluation_id
      and public.iq_v4_can_view_player360_team_season(e.team_season_id)
      and (
        not e.is_private
        or public.iq_v4_can_view_private_evaluation(e.team_season_id)
      )
  )
);

create policy iq_v4_objective_profiles_select
on public.player_objective_profiles
for select to authenticated
using (public.iq_v4_can_view_player360_team_season(team_season_id));

create policy iq_v4_objective_targets_select
on public.player_objective_targets
for select to authenticated
using (
  exists (
    select 1
    from public.player_objective_profiles p
    where p.id = player_objective_targets.profile_id
      and public.iq_v4_can_view_player360_team_season(p.team_season_id)
  )
);

revoke insert, update, delete
  on public.player360_evaluation_metrics,
     public.player_evaluations,
     public.player_evaluation_scores,
     public.player_objective_profiles,
     public.player_objective_targets
  from authenticated;

grant select
  on public.player360_evaluation_metrics,
     public.player_evaluations,
     public.player_evaluation_scores,
     public.player_objective_profiles,
     public.player_objective_targets
  to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Metric catalog RPCs
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_list_evaluation_metrics(
  p_team_season_id uuid
)
returns table (
  id uuid,
  team_season_id uuid,
  code text,
  domain_code text,
  name text,
  description text,
  scale_min numeric,
  scale_max numeric,
  scale_step numeric,
  higher_is_better boolean,
  sensitivity text,
  is_active boolean,
  sort_order integer,
  source_scope text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_view_player360_team_season(p_team_season_id) then
    raise exception 'EVALUATION_VIEW_DENIED';
  end if;

  return query
  with candidates as (
    select
      m.*,
      row_number() over (
        partition by upper(m.code)
        order by
          case when m.team_season_id = p_team_season_id then 0 else 1 end,
          m.updated_at desc,
          m.id
      ) as rn
    from public.player360_evaluation_metrics m
    where m.is_active
      and (m.team_season_id is null or m.team_season_id = p_team_season_id)
  )
  select
    c.id,
    c.team_season_id,
    c.code,
    c.domain_code,
    c.name,
    c.description,
    c.scale_min,
    c.scale_max,
    c.scale_step,
    c.higher_is_better,
    c.sensitivity,
    c.is_active,
    c.sort_order,
    case when c.team_season_id is null then 'GLOBAL' else 'TEAM_SEASON' end
  from candidates c
  where c.rn = 1
  order by c.sort_order, c.domain_code, c.name;
end;
$$;

create or replace function public.iq_v4_upsert_evaluation_metric(
  p_team_season_id uuid,
  p_code text,
  p_domain_code text,
  p_name text,
  p_description text default null,
  p_scale_min numeric default 0,
  p_scale_max numeric default 10,
  p_scale_step numeric default 0.5,
  p_higher_is_better boolean default true,
  p_sensitivity text default 'PRIVATE_SPORTING',
  p_is_active boolean default true,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_domain text := upper(trim(coalesce(p_domain_code, '')));
  v_sensitivity text := upper(trim(coalesce(p_sensitivity, 'PRIVATE_SPORTING')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_team_season_id is null then
    if not public.iq_v3_is_global_superadmin() then
      raise exception 'GLOBAL_METRIC_MANAGE_DENIED';
    end if;
  elsif not public.iq_v4_can_manage_evaluation(p_team_season_id) then
    raise exception 'EVALUATION_MANAGE_DENIED';
  end if;

  if v_code = '' or v_domain = '' or length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'EVALUATION_METRIC_REQUIRED_FIELDS';
  end if;

  if p_scale_max <= p_scale_min or p_scale_step <= 0 then
    raise exception 'EVALUATION_METRIC_INVALID_SCALE';
  end if;

  if v_sensitivity not in ('STANDARD','PRIVATE_SPORTING') then
    raise exception 'EVALUATION_METRIC_INVALID_SENSITIVITY';
  end if;

  select m.id
    into v_id
  from public.player360_evaluation_metrics m
  where m.team_season_id is not distinct from p_team_season_id
    and upper(m.code) = v_code
  limit 1;

  if v_id is null then
    insert into public.player360_evaluation_metrics (
      team_season_id, code, domain_code, name, description,
      scale_min, scale_max, scale_step, higher_is_better,
      sensitivity, is_active, sort_order, created_by, updated_by
    )
    values (
      p_team_season_id, v_code, v_domain, trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      p_scale_min, p_scale_max, p_scale_step, p_higher_is_better,
      v_sensitivity, p_is_active, p_sort_order, auth.uid(), auth.uid()
    )
    returning id into v_id;
  else
    update public.player360_evaluation_metrics
    set
      domain_code = v_domain,
      name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      scale_min = p_scale_min,
      scale_max = p_scale_max,
      scale_step = p_scale_step,
      higher_is_better = p_higher_is_better,
      sensitivity = v_sensitivity,
      is_active = p_is_active,
      sort_order = p_sort_order,
      updated_by = auth.uid()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Evaluation RPCs
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_save_player_evaluation(
  p_team_season_id uuid,
  p_player_id uuid,
  p_evaluation_date date,
  p_title text,
  p_evaluation_type text default 'GENERAL',
  p_source_type text default 'CLUB_COACH',
  p_evaluator_name text default null,
  p_summary text default null,
  p_strengths text default null,
  p_development_priorities text default null,
  p_is_private boolean default false,
  p_share_with_player boolean default false,
  p_scores jsonb default '[]'::jsonb,
  p_provenance jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_existing_evaluation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_evaluation_key uuid := gen_random_uuid();
  v_revision integer := 1;
  v_existing public.player_evaluations;
  v_metric public.player360_evaluation_metrics;
  v_score jsonb;
  v_metric_code text;
  v_score_value numeric;
  v_confidence numeric;
  v_season_start date;
  v_season_end date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_manage_evaluation(p_team_season_id) then
    raise exception 'EVALUATION_MANAGE_DENIED';
  end if;

  select sc.start_date, sc.end_date
    into v_season_start, v_season_end
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where ts.id = p_team_season_id;

  if not found then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if (v_season_start is not null and p_evaluation_date < v_season_start)
     or (v_season_end is not null and p_evaluation_date > v_season_end) then
    raise exception 'EVALUATION_DATE_OUTSIDE_SEASON';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    p_player_id, p_team_season_id, p_evaluation_date
  ) then
    raise exception 'PLAYER_NOT_ELIGIBLE_ON_EVALUATION_DATE';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'EVALUATION_TITLE_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_scores, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_scores, '[]'::jsonb)) = 0 then
    raise exception 'EVALUATION_SCORES_REQUIRED';
  end if;

  if p_existing_evaluation_id is not null then
    select *
      into v_existing
    from public.player_evaluations e
    where e.id = p_existing_evaluation_id
    for update;

    if v_existing.id is null then
      raise exception 'EVALUATION_NOT_FOUND';
    end if;

    if v_existing.status <> 'CURRENT' then
      raise exception 'EVALUATION_REVISION_NOT_CURRENT';
    end if;

    if v_existing.team_season_id <> p_team_season_id
       or v_existing.player_id <> p_player_id then
      raise exception 'EVALUATION_REVISION_SCOPE_MISMATCH';
    end if;

    v_evaluation_key := v_existing.evaluation_key;
    v_revision := v_existing.revision + 1;

    update public.player_evaluations
    set
      status = 'SUPERSEDED',
      updated_by = auth.uid()
    where id = v_existing.id;
  end if;

  insert into public.player_evaluations (
    evaluation_key, revision, supersedes_evaluation_id,
    team_season_id, player_id, evaluation_date, title,
    evaluation_type, source_type, evaluator_user_id, evaluator_name,
    summary, strengths, development_priorities,
    is_private, share_with_player, status,
    provenance, metadata, created_by, updated_by
  )
  values (
    v_evaluation_key, v_revision, p_existing_evaluation_id,
    p_team_season_id, p_player_id, p_evaluation_date, trim(p_title),
    upper(trim(coalesce(p_evaluation_type, 'GENERAL'))),
    upper(trim(coalesce(p_source_type, 'CLUB_COACH'))),
    auth.uid(),
    nullif(trim(coalesce(p_evaluator_name, '')), ''),
    nullif(trim(coalesce(p_summary, '')), ''),
    nullif(trim(coalesce(p_strengths, '')), ''),
    nullif(trim(coalesce(p_development_priorities, '')), ''),
    coalesce(p_is_private, false),
    coalesce(p_share_with_player, false),
    'CURRENT',
    coalesce(p_provenance, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid(), auth.uid()
  )
  returning id into v_id;

  for v_score in
    select value
    from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    v_metric_code := upper(trim(coalesce(v_score ->> 'metric_code', '')));
    if v_metric_code = '' then
      raise exception 'EVALUATION_METRIC_CODE_REQUIRED';
    end if;

    select m.*
      into v_metric
    from public.player360_evaluation_metrics m
    where m.is_active
      and upper(m.code) = v_metric_code
      and (m.team_season_id is null or m.team_season_id = p_team_season_id)
    order by case when m.team_season_id = p_team_season_id then 0 else 1 end,
             m.updated_at desc,
             m.id
    limit 1;

    if v_metric.id is null then
      raise exception 'EVALUATION_METRIC_NOT_FOUND:%', v_metric_code;
    end if;

    v_score_value := nullif(v_score ->> 'score', '')::numeric;
    v_confidence := nullif(v_score ->> 'confidence', '')::numeric;

    if v_score_value is null
       or v_score_value < v_metric.scale_min
       or v_score_value > v_metric.scale_max then
      raise exception 'EVALUATION_SCORE_OUT_OF_RANGE:%', v_metric_code;
    end if;

    if v_confidence is not null and (v_confidence < 0 or v_confidence > 1) then
      raise exception 'EVALUATION_CONFIDENCE_OUT_OF_RANGE:%', v_metric_code;
    end if;

    insert into public.player_evaluation_scores (
      evaluation_id, team_season_id, metric_definition_id,
      metric_code, domain_code, metric_name,
      scale_min, scale_max, higher_is_better,
      score, confidence, notes, evidence, metadata
    )
    values (
      v_id, p_team_season_id, v_metric.id,
      v_metric.code, v_metric.domain_code, v_metric.name,
      v_metric.scale_min, v_metric.scale_max, v_metric.higher_is_better,
      v_score_value, v_confidence,
      nullif(trim(coalesce(v_score ->> 'notes', '')), ''),
      nullif(trim(coalesce(v_score ->> 'evidence', '')), ''),
      coalesce(v_score -> 'metadata', '{}'::jsonb)
    );
  end loop;

  return v_id;
end;
$$;

create or replace function public.iq_v4_archive_player_evaluation(
  p_evaluation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eval public.player_evaluations;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
    into v_eval
  from public.player_evaluations
  where id = p_evaluation_id
  for update;

  if v_eval.id is null then
    raise exception 'EVALUATION_NOT_FOUND';
  end if;

  if not public.iq_v4_can_manage_evaluation(v_eval.team_season_id) then
    raise exception 'EVALUATION_MANAGE_DENIED';
  end if;

  if v_eval.status = 'SUPERSEDED' then
    raise exception 'EVALUATION_SUPERSEDED_IMMUTABLE';
  end if;

  update public.player_evaluations
  set status = 'ARCHIVED', updated_by = auth.uid()
  where id = p_evaluation_id;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Objective profile RPCs
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_save_objective_profile(
  p_team_season_id uuid,
  p_player_id uuid,
  p_effective_date date,
  p_target_date date,
  p_title text,
  p_rationale text default null,
  p_targets jsonb default '[]'::jsonb,
  p_provenance jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_expected_active_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_profile_key uuid := gen_random_uuid();
  v_revision integer := 1;
  v_active public.player_objective_profiles;
  v_metric public.player360_evaluation_metrics;
  v_target jsonb;
  v_metric_code text;
  v_target_score numeric;
  v_weight numeric;
  v_season_start date;
  v_season_end date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.iq_v4_can_manage_objective_profile(p_team_season_id) then
    raise exception 'OBJECTIVE_PROFILE_MANAGE_DENIED';
  end if;

  select sc.start_date, sc.end_date
    into v_season_start, v_season_end
  from public.team_seasons ts
  join public.season_catalog sc on sc.id = ts.season_id
  where ts.id = p_team_season_id;

  if not found then
    raise exception 'TEAM_SEASON_NOT_FOUND';
  end if;

  if (v_season_start is not null and p_effective_date < v_season_start)
     or (v_season_end is not null and p_effective_date > v_season_end) then
    raise exception 'OBJECTIVE_EFFECTIVE_DATE_OUTSIDE_SEASON';
  end if;

  if p_target_date is not null
     and (
       p_target_date < p_effective_date
       or (v_season_end is not null and p_target_date > v_season_end)
     ) then
    raise exception 'OBJECTIVE_TARGET_DATE_INVALID';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    p_player_id, p_team_season_id, p_effective_date
  ) then
    raise exception 'PLAYER_NOT_ELIGIBLE_ON_OBJECTIVE_DATE';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'OBJECTIVE_PROFILE_TITLE_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_targets, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_targets, '[]'::jsonb)) = 0 then
    raise exception 'OBJECTIVE_TARGETS_REQUIRED';
  end if;

  select *
    into v_active
  from public.player_objective_profiles p
  where p.team_season_id = p_team_season_id
    and p.player_id = p_player_id
    and p.status = 'ACTIVE'
  for update;

  if p_expected_active_profile_id is not null
     and (v_active.id is null or v_active.id <> p_expected_active_profile_id) then
    raise exception 'OBJECTIVE_PROFILE_CONCURRENT_CHANGE';
  end if;

  if v_active.id is not null then
    v_profile_key := v_active.profile_key;
    v_revision := v_active.revision + 1;

    update public.player_objective_profiles
    set status = 'SUPERSEDED', updated_by = auth.uid()
    where id = v_active.id;
  end if;

  insert into public.player_objective_profiles (
    profile_key, revision, supersedes_profile_id,
    team_season_id, player_id, effective_date, target_date,
    title, rationale, status, provenance, metadata,
    created_by, updated_by
  )
  values (
    v_profile_key, v_revision, v_active.id,
    p_team_season_id, p_player_id, p_effective_date, p_target_date,
    trim(p_title), nullif(trim(coalesce(p_rationale, '')), ''),
    'ACTIVE', coalesce(p_provenance, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    auth.uid(), auth.uid()
  )
  returning id into v_id;

  for v_target in
    select value
    from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb))
  loop
    v_metric_code := upper(trim(coalesce(v_target ->> 'metric_code', '')));
    if v_metric_code = '' then
      raise exception 'OBJECTIVE_METRIC_CODE_REQUIRED';
    end if;

    select m.*
      into v_metric
    from public.player360_evaluation_metrics m
    where m.is_active
      and upper(m.code) = v_metric_code
      and (m.team_season_id is null or m.team_season_id = p_team_season_id)
    order by case when m.team_season_id = p_team_season_id then 0 else 1 end,
             m.updated_at desc,
             m.id
    limit 1;

    if v_metric.id is null then
      raise exception 'OBJECTIVE_METRIC_NOT_FOUND:%', v_metric_code;
    end if;

    v_target_score := nullif(v_target ->> 'target_score', '')::numeric;
    v_weight := coalesce(nullif(v_target ->> 'priority_weight', '')::numeric, 1);

    if v_target_score is null
       or v_target_score < v_metric.scale_min
       or v_target_score > v_metric.scale_max then
      raise exception 'OBJECTIVE_TARGET_OUT_OF_RANGE:%', v_metric_code;
    end if;

    if v_weight <= 0 or v_weight > 100 then
      raise exception 'OBJECTIVE_WEIGHT_OUT_OF_RANGE:%', v_metric_code;
    end if;

    insert into public.player_objective_targets (
      profile_id, team_season_id, metric_definition_id,
      metric_code, domain_code, metric_name,
      scale_min, scale_max, higher_is_better,
      target_score, priority_weight, notes, metadata
    )
    values (
      v_id, p_team_season_id, v_metric.id,
      v_metric.code, v_metric.domain_code, v_metric.name,
      v_metric.scale_min, v_metric.scale_max, v_metric.higher_is_better,
      v_target_score, v_weight,
      nullif(trim(coalesce(v_target ->> 'notes', '')), ''),
      coalesce(v_target -> 'metadata', '{}'::jsonb)
    );
  end loop;

  return v_id;
end;
$$;

create or replace function public.iq_v4_archive_objective_profile(
  p_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.player_objective_profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
    into v_profile
  from public.player_objective_profiles
  where id = p_profile_id
  for update;

  if v_profile.id is null then
    raise exception 'OBJECTIVE_PROFILE_NOT_FOUND';
  end if;

  if not public.iq_v4_can_manage_objective_profile(v_profile.team_season_id) then
    raise exception 'OBJECTIVE_PROFILE_MANAGE_DENIED';
  end if;

  if v_profile.status = 'SUPERSEDED' then
    raise exception 'OBJECTIVE_PROFILE_SUPERSEDED_IMMUTABLE';
  end if;

  update public.player_objective_profiles
  set status = 'ARCHIVED', updated_by = auth.uid()
  where id = p_profile_id;

  return true;
end;
$$;

create or replace function public.iq_v4_get_player_objective_gap(
  p_profile_id uuid
)
returns table (
  profile_id uuid,
  player_id uuid,
  team_season_id uuid,
  metric_code text,
  domain_code text,
  metric_name text,
  current_score numeric,
  target_score numeric,
  gap_to_target numeric,
  priority_weight numeric,
  last_evaluation_date date,
  current_evaluation_id uuid,
  data_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.player_objective_profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
    into v_profile
  from public.player_objective_profiles p
  where p.id = p_profile_id;

  if v_profile.id is null then
    raise exception 'OBJECTIVE_PROFILE_NOT_FOUND';
  end if;

  if not public.iq_v4_can_view_player360_team_season(v_profile.team_season_id) then
    raise exception 'OBJECTIVE_PROFILE_VIEW_DENIED';
  end if;

  return query
  select
    t.profile_id,
    v_profile.player_id,
    v_profile.team_season_id,
    t.metric_code,
    t.domain_code,
    t.metric_name,
    latest.score as current_score,
    t.target_score,
    case
      when latest.score is null then null
      when t.higher_is_better then t.target_score - latest.score
      else latest.score - t.target_score
    end as gap_to_target,
    t.priority_weight,
    latest.evaluation_date as last_evaluation_date,
    latest.evaluation_id as current_evaluation_id,
    case when latest.score is null then 'NO_EVALUATION' else 'AVAILABLE' end as data_status
  from public.player_objective_targets t
  left join lateral (
    select
      s.score,
      e.evaluation_date,
      e.id as evaluation_id
    from public.player_evaluation_scores s
    join public.player_evaluations e on e.id = s.evaluation_id
    where e.team_season_id = v_profile.team_season_id
      and e.player_id = v_profile.player_id
      and e.status = 'CURRENT'
      and upper(s.metric_code) = upper(t.metric_code)
      and (
        not e.is_private
        or public.iq_v4_can_view_private_evaluation(e.team_season_id)
      )
    order by e.evaluation_date desc, e.created_at desc, e.id desc
    limit 1
  ) latest on true
  where t.profile_id = p_profile_id
  order by t.domain_code, t.metric_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Capabilities
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_evaluation_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'evaluation', true,
    'objective_profile', true,
    'metric_catalog', true,
    'revision_history', true,
    'private_evaluation', true,
    'deterministic_gap', true,
    'player_family_access', false,
    'ai_writes_evidence', false,
    'contract_version', 'PLAYER360_OBSERVATION_V1'
  );
$$;

-- -----------------------------------------------------------------------------
-- 11. Function grants
-- -----------------------------------------------------------------------------

revoke all on function public.iq_v4_list_evaluation_metrics(uuid) from public;
revoke all on function public.iq_v4_upsert_evaluation_metric(
  uuid,text,text,text,text,numeric,numeric,numeric,boolean,text,boolean,integer
) from public;
revoke all on function public.iq_v4_save_player_evaluation(
  uuid,uuid,date,text,text,text,text,text,text,text,boolean,boolean,jsonb,jsonb,jsonb,uuid
) from public;
revoke all on function public.iq_v4_archive_player_evaluation(uuid) from public;
revoke all on function public.iq_v4_save_objective_profile(
  uuid,uuid,date,date,text,text,jsonb,jsonb,jsonb,uuid
) from public;
revoke all on function public.iq_v4_archive_objective_profile(uuid) from public;
revoke all on function public.iq_v4_get_player_objective_gap(uuid) from public;
revoke all on function public.iq_v4_evaluation_capabilities() from public;

grant execute on function public.iq_v4_list_evaluation_metrics(uuid) to authenticated;
grant execute on function public.iq_v4_upsert_evaluation_metric(
  uuid,text,text,text,text,numeric,numeric,numeric,boolean,text,boolean,integer
) to authenticated;
grant execute on function public.iq_v4_save_player_evaluation(
  uuid,uuid,date,text,text,text,text,text,text,text,boolean,boolean,jsonb,jsonb,jsonb,uuid
) to authenticated;
grant execute on function public.iq_v4_archive_player_evaluation(uuid) to authenticated;
grant execute on function public.iq_v4_save_objective_profile(
  uuid,uuid,date,date,text,text,jsonb,jsonb,jsonb,uuid
) to authenticated;
grant execute on function public.iq_v4_archive_objective_profile(uuid) to authenticated;
grant execute on function public.iq_v4_get_player_objective_gap(uuid) to authenticated;
grant execute on function public.iq_v4_evaluation_capabilities() to authenticated;

comment on table public.player360_evaluation_metrics is
'Configurable global/team-season metric catalog for Player 360 human evaluations.';
comment on table public.player_evaluations is
'Revision-preserving dated human evaluation header; AI is not stored here.';
comment on table public.player_evaluation_scores is
'Metric scores with historical definition snapshots for one evaluation revision.';
comment on table public.player_objective_profiles is
'Versioned active development objective profile per player/team-season.';
comment on table public.player_objective_targets is
'Metric targets and priority weights for one objective profile revision.';

-- -----------------------------------------------------------------------------
-- REHEARSAL ASSERTIONS — all changes are inside this transaction.
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
where upper(coalesce(up.global_role, up.role, 'USER')) = 'SUPERADMIN'
order by up.created_at nulls last
limit 1;

set local role authenticated;

do $$
declare
  v_team_season_id uuid;
  v_player_id uuid;
  v_eval_date date;
  v_eval_1 uuid;
  v_eval_2 uuid;
  v_eval_key_1 uuid;
  v_eval_key_2 uuid;
  v_profile_1 uuid;
  v_profile_2 uuid;
  v_profile_key_1 uuid;
  v_profile_key_2 uuid;
  v_metric_count integer;
  v_score_count integer;
  v_target_count integer;
  v_gap_shoot numeric;
  v_gap_decision numeric;
  v_custom_metric uuid;
  v_old_status text;
  v_new_revision integer;
begin
  if auth.uid() is null or not public.iq_v3_is_global_superadmin() then
    raise exception 'PHASE4C_REHEARSAL_AUTH_FAILED';
  end if;

  select
    rm.team_season_id,
    rm.player_id,
    greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
  into
    v_team_season_id,
    v_player_id,
    v_eval_date
  from public.roster_memberships rm
  join public.roster_membership_stints rs
    on rs.roster_membership_id = rm.id
  join public.team_seasons ts
    on ts.id = rm.team_season_id
  join public.season_catalog sc
    on sc.id = ts.season_id
  where rs.valid_until is null
    and greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
      <= coalesce(
        sc.end_date,
        greatest(rs.valid_from, coalesce(sc.start_date, rs.valid_from))
      )
  order by rs.valid_from desc, rm.id
  limit 1;

  if v_team_season_id is null or v_player_id is null or v_eval_date is null then
    raise exception 'PHASE4C_REHEARSAL_NO_ELIGIBLE_PLAYER';
  end if;

  if not public.iq_v3_player_eligible_on_date(
    v_player_id,
    v_team_season_id,
    v_eval_date
  ) then
    raise exception 'PHASE4C_REHEARSAL_SELECTED_PLAYER_NOT_ELIGIBLE';
  end if;

  select count(*)
    into v_metric_count
  from public.iq_v4_list_evaluation_metrics(v_team_season_id);

  if v_metric_count < 15 then
    raise exception 'ASSERT_DEFAULT_METRICS_MISSING:%', v_metric_count;
  end if;

  v_custom_metric := public.iq_v4_upsert_evaluation_metric(
    v_team_season_id,
    'COMMUNICATION',
    'TACTICAL',
    'Comunicación',
    'Comunicación funcional en ataque y defensa.',
    0, 10, 0.5, true,
    'PRIVATE_SPORTING',
    true,
    160
  );

  if v_custom_metric is null then
    raise exception 'ASSERT_CUSTOM_METRIC_NOT_CREATED';
  end if;

  v_eval_1 := public.iq_v4_save_player_evaluation(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    'ZZ Phase4C rehearsal evaluation',
    'GENERAL',
    'CLUB_COACH',
    null,
    'Evaluación sintética de ensayo.',
    'Toma de decisiones.',
    'Mejorar consistencia de tiro.',
    true,
    false,
    jsonb_build_array(
      jsonb_build_object(
        'metric_code','SHOOTING',
        'score',6.5,
        'confidence',0.9,
        'notes','Rehearsal'
      ),
      jsonb_build_object(
        'metric_code','DECISION_MAKING',
        'score',7,
        'confidence',0.85
      ),
      jsonb_build_object(
        'metric_code','COMMUNICATION',
        'score',6
      )
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL'),
    '{}'::jsonb,
    null
  );

  select evaluation_key, revision
    into v_eval_key_1, v_new_revision
  from public.player_evaluations
  where id = v_eval_1;

  if v_eval_key_1 is null or v_new_revision <> 1 then
    raise exception 'ASSERT_EVALUATION_REVISION_1_FAILED';
  end if;

  select count(*)
    into v_score_count
  from public.player_evaluation_scores
  where evaluation_id = v_eval_1;

  if v_score_count <> 3 then
    raise exception 'ASSERT_EVALUATION_SCORE_COUNT:%', v_score_count;
  end if;

  v_eval_2 := public.iq_v4_save_player_evaluation(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    'ZZ Phase4C rehearsal evaluation revised',
    'GENERAL',
    'CLUB_COACH',
    null,
    'Segunda revisión sintética.',
    'Lectura del juego.',
    'Consolidar tiro y comunicación.',
    true,
    false,
    jsonb_build_array(
      jsonb_build_object('metric_code','SHOOTING','score',7),
      jsonb_build_object('metric_code','DECISION_MAKING','score',7.5),
      jsonb_build_object('metric_code','COMMUNICATION','score',6.5)
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL_REVISION'),
    '{}'::jsonb,
    v_eval_1
  );

  select status into v_old_status
  from public.player_evaluations
  where id = v_eval_1;

  select evaluation_key, revision
    into v_eval_key_2, v_new_revision
  from public.player_evaluations
  where id = v_eval_2;

  if v_old_status <> 'SUPERSEDED'
     or v_eval_key_2 <> v_eval_key_1
     or v_new_revision <> 2 then
    raise exception 'ASSERT_EVALUATION_REVISION_HISTORY_FAILED';
  end if;

  v_profile_1 := public.iq_v4_save_objective_profile(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    null,
    'ZZ Phase4C objective rehearsal',
    'Perfil sintético.',
    jsonb_build_array(
      jsonb_build_object('metric_code','SHOOTING','target_score',8.5,'priority_weight',2),
      jsonb_build_object('metric_code','DECISION_MAKING','target_score',8,'priority_weight',1.5),
      jsonb_build_object('metric_code','COMMUNICATION','target_score',7.5,'priority_weight',1)
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL'),
    '{}'::jsonb,
    null
  );

  select profile_key, revision
    into v_profile_key_1, v_new_revision
  from public.player_objective_profiles
  where id = v_profile_1;

  if v_profile_key_1 is null or v_new_revision <> 1 then
    raise exception 'ASSERT_OBJECTIVE_PROFILE_REVISION_1_FAILED';
  end if;

  select count(*)
    into v_target_count
  from public.player_objective_targets
  where profile_id = v_profile_1;

  if v_target_count <> 3 then
    raise exception 'ASSERT_OBJECTIVE_TARGET_COUNT:%', v_target_count;
  end if;

  select gap_to_target
    into v_gap_shoot
  from public.iq_v4_get_player_objective_gap(v_profile_1)
  where metric_code = 'SHOOTING';

  select gap_to_target
    into v_gap_decision
  from public.iq_v4_get_player_objective_gap(v_profile_1)
  where metric_code = 'DECISION_MAKING';

  if v_gap_shoot is distinct from 1.5
     or v_gap_decision is distinct from 0.5 then
    raise exception 'ASSERT_OBJECTIVE_GAP_FAILED: shooting=%, decision=%',
      v_gap_shoot, v_gap_decision;
  end if;

  v_profile_2 := public.iq_v4_save_objective_profile(
    v_team_season_id,
    v_player_id,
    v_eval_date,
    null,
    'ZZ Phase4C objective rehearsal revised',
    'Segunda revisión sintética.',
    jsonb_build_array(
      jsonb_build_object('metric_code','SHOOTING','target_score',9,'priority_weight',2),
      jsonb_build_object('metric_code','DECISION_MAKING','target_score',8.5,'priority_weight',1.5),
      jsonb_build_object('metric_code','COMMUNICATION','target_score',8,'priority_weight',1)
    ),
    jsonb_build_object('test','PHASE4C_REHEARSAL_REVISION'),
    '{}'::jsonb,
    v_profile_1
  );

  select status into v_old_status
  from public.player_objective_profiles
  where id = v_profile_1;

  select profile_key, revision
    into v_profile_key_2, v_new_revision
  from public.player_objective_profiles
  where id = v_profile_2;

  if v_old_status <> 'SUPERSEDED'
     or v_profile_key_2 <> v_profile_key_1
     or v_new_revision <> 2 then
    raise exception 'ASSERT_OBJECTIVE_REVISION_HISTORY_FAILED';
  end if;

  begin
    insert into public.player_evaluations (
      team_season_id,
      player_id,
      evaluation_date,
      title,
      evaluation_type,
      source_type
    )
    values (
      v_team_season_id,
      v_player_id,
      v_eval_date,
      'ZZ SHOULD NOT INSERT',
      'GENERAL',
      'CLUB_COACH'
    );

    raise exception 'ASSERT_DIRECT_EVALUATION_WRITE_NOT_BLOCKED';
  exception
    when insufficient_privilege then
      null;
  end;

  raise notice
    'PLAYER360_PHASE4C_REHEARSAL_OK team_season=% player=% date=% eval_revision=% profile_revision=%',
    v_team_season_id,
    v_player_id,
    v_eval_date,
    v_eval_2,
    v_profile_2;
end $$;

reset role;

rollback;
