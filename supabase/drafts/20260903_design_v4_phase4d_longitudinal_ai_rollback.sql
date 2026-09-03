-- =============================================================================
-- IQBasket v4 · Phase 4D Longitudinal Analytics + AI Evidence · DESIGN REHEARSAL
-- Date: 2026-09-03
--
-- This script ALWAYS ends in ROLLBACK. It must not install production objects.
-- Measurements, deterministic snapshots and AI interpretations remain separate.
-- Associations are descriptive evidence only and never authorize a causal claim.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.team_seasons') is null
     or to_regclass('public.teams') is null
     or to_regclass('public.players') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.team_season_memberships') is null
     or to_regclass('public.club_season_memberships') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.roster_membership_stints') is null
     or to_regclass('public.analytics_runs') is null
     or to_regclass('public.training_sessions') is null
     or to_regclass('public.player_evaluations') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v4_touch_updated_at()') is null then
    raise exception 'PLAYER360_PHASE4D_PREREQUISITES_MISSING';
  end if;

  if to_regclass('public.player_longitudinal_snapshots') is not null
     or to_regclass('public.player_ai_insights') is not null then
    raise exception 'PLAYER360_PHASE4D_ALREADY_INSTALLED';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Authorization: independent actions, least privilege, ready for ABAC evolution.
-- -----------------------------------------------------------------------------

create or replace function public.iq_v4_has_player360_action_role(
  p_team_season_id uuid,
  p_team_roles text[],
  p_club_roles text[],
  p_profile_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4d$
  select
    auth.uid() is not null
    and p_team_season_id is not null
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
              and upper(m.function_role) = any(coalesce(p_team_roles, array[]::text[]))
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
              and upper(cm.function_role) = any(coalesce(p_club_roles, array[]::text[]))
          )

          or exists (
            select 1
            from public.user_profiles up
            cross join lateral jsonb_array_elements_text(
              coalesce(to_jsonb(up.assigned_team_ids), '[]'::jsonb)
            ) assigned(team_id)
            where up.id = auth.uid()
              and assigned.team_id = ts.team_id::text
              and upper(coalesce(up.global_role, up.role, 'USER'))
                  = any(coalesce(p_profile_roles, array[]::text[]))
          )
        )
    );
$iq4d$;

create or replace function public.iq_v4_can_view_longitudinal_analytics(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4d$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );
$iq4d$;

create or replace function public.iq_v4_can_generate_longitudinal_analytics(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4d$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );
$iq4d$;

create or replace function public.iq_v4_can_view_ai_insights(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4d$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );
$iq4d$;

create or replace function public.iq_v4_can_generate_ai_insights(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4d$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );
$iq4d$;

create or replace function public.iq_v4_can_review_ai_insights(
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4d$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'],
    array['ADMIN','ENTRENADOR']
  );
$iq4d$;

revoke all on function public.iq_v4_has_player360_action_role(uuid,text[],text[],text[]) from public, anon, authenticated;
revoke all on function public.iq_v4_can_view_longitudinal_analytics(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4_can_generate_longitudinal_analytics(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4_can_view_ai_insights(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4_can_generate_ai_insights(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4_can_review_ai_insights(uuid) from public, anon, authenticated;

grant execute on function public.iq_v4_can_view_longitudinal_analytics(uuid) to authenticated;
grant execute on function public.iq_v4_can_generate_longitudinal_analytics(uuid) to authenticated;
grant execute on function public.iq_v4_can_view_ai_insights(uuid) to authenticated;
grant execute on function public.iq_v4_can_generate_ai_insights(uuid) to authenticated;
grant execute on function public.iq_v4_can_review_ai_insights(uuid) to authenticated;

-- Deterministic output. This is not an AI resource.
create table public.player_longitudinal_snapshots (
  id uuid primary key default gen_random_uuid(),
  analytics_run_id uuid references public.analytics_runs(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  bucket_unit text not null default 'WEEK',
  contract_version text not null,
  calculation_version text not null,
  source_revision text,
  source_fingerprint text not null,
  rejected_observations integer not null default 0,
  snapshot jsonb not null,
  evidence_bundle jsonb not null,
  generated_by uuid references public.user_profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_longitudinal_period_check check (period_end >= period_start),
  constraint player_longitudinal_bucket_check check (bucket_unit in ('WEEK')),
  constraint player_longitudinal_contract_check
    check (contract_version = 'PLAYER360_LONGITUDINAL_V1'),
  constraint player_longitudinal_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object'),
  constraint player_longitudinal_evidence_object_check
    check (jsonb_typeof(evidence_bundle) = 'object'),
  constraint player_longitudinal_rejected_check check (rejected_observations >= 0),
  constraint player_longitudinal_scope_unique unique (id, team_season_id, player_id),
  constraint player_longitudinal_source_unique unique (
    team_season_id,
    player_id,
    period_start,
    period_end,
    calculation_version,
    source_fingerprint
  )
);

create index idx_player_longitudinal_scope_period
  on public.player_longitudinal_snapshots(
    team_season_id,
    player_id,
    period_end desc,
    generated_at desc
  );
create index idx_player_longitudinal_snapshot_gin
  on public.player_longitudinal_snapshots using gin(snapshot);

-- AI output. It references immutable deterministic evidence and can be reviewed.
create table public.player_ai_insights (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  team_season_id uuid not null,
  player_id uuid not null,
  audience text not null,
  locale text not null default 'es',
  provider text not null,
  model_name text not null,
  prompt_version text not null,
  evidence_version text not null default 'PLAYER360_EVIDENCE_V1',
  content jsonb not null,
  status text not null default 'DRAFT',
  requested_by uuid references public.user_profiles(id) on delete set null,
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_ai_insight_snapshot_scope_fk
    foreign key (snapshot_id, team_season_id, player_id)
    references public.player_longitudinal_snapshots(id, team_season_id, player_id)
    on delete restrict,
  constraint player_ai_insight_audience_check
    check (audience in ('STAFF','PLAYER','FAMILY','EXECUTIVE')),
  constraint player_ai_insight_status_check
    check (status in ('DRAFT','APPROVED','REJECTED','ARCHIVED')),
  constraint player_ai_insight_content_object_check
    check (jsonb_typeof(content) = 'object'),
  constraint player_ai_insight_review_check check (
    (status = 'DRAFT' and reviewed_at is null and reviewed_by is null)
    or (
      status in ('APPROVED','REJECTED','ARCHIVED')
      and reviewed_at is not null
      and reviewed_by is not null
    )
  )
);

create index idx_player_ai_insights_scope
  on public.player_ai_insights(
    team_season_id,
    player_id,
    audience,
    created_at desc
  );

create trigger trg_player_longitudinal_snapshots_touch
before update on public.player_longitudinal_snapshots
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player_ai_insights_touch
before update on public.player_ai_insights
for each row execute function public.iq_v4_touch_updated_at();

alter table public.player_longitudinal_snapshots enable row level security;
alter table public.player_ai_insights enable row level security;

revoke all on table public.player_longitudinal_snapshots from anon;
revoke all on table public.player_ai_insights from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.player_longitudinal_snapshots,
           public.player_ai_insights
  from authenticated;
grant select on table public.player_longitudinal_snapshots to authenticated;
grant select on table public.player_ai_insights to authenticated;

create policy iq_v4_longitudinal_snapshots_select
on public.player_longitudinal_snapshots
for select to authenticated
using (public.iq_v4_can_view_longitudinal_analytics(team_season_id));

create policy iq_v4_ai_insights_select
on public.player_ai_insights
for select to authenticated
using (public.iq_v4_can_view_ai_insights(team_season_id));

create or replace function public.iq_v4_save_longitudinal_snapshot(
  p_team_season_id uuid,
  p_player_id uuid,
  p_period_start date,
  p_period_end date,
  p_contract_version text,
  p_calculation_version text,
  p_source_revision text,
  p_source_fingerprint text,
  p_snapshot jsonb,
  p_evidence_bundle jsonb,
  p_rejected_observations integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4_can_generate_longitudinal_analytics(p_team_season_id) then
    raise exception 'PLAYER360_ANALYTICS_GENERATE_DENIED';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'PLAYER360_ANALYTICS_PERIOD_INVALID';
  end if;
  if p_contract_version <> 'PLAYER360_LONGITUDINAL_V1' then
    raise exception 'PLAYER360_ANALYTICS_CONTRACT_INVALID';
  end if;
  if length(trim(coalesce(p_calculation_version, ''))) = 0
     or length(trim(coalesce(p_source_fingerprint, ''))) = 0 then
    raise exception 'PLAYER360_ANALYTICS_VERSION_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_snapshot, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_evidence_bundle, 'null'::jsonb)) <> 'object' then
    raise exception 'PLAYER360_ANALYTICS_PAYLOAD_INVALID';
  end if;
  if p_snapshot ->> 'contract_version' <> p_contract_version
     or p_snapshot ->> 'calculation_version' <> p_calculation_version
     or p_evidence_bundle ->> 'evidence_version' <> 'PLAYER360_EVIDENCE_V1'
     or p_evidence_bundle ->> 'calculation_version' <> p_calculation_version then
    raise exception 'PLAYER360_ANALYTICS_PAYLOAD_VERSION_MISMATCH';
  end if;
  if not exists (
    select 1
    from public.roster_memberships rm
    join public.roster_membership_stints rms
      on rms.roster_membership_id = rm.id
    where rm.team_season_id = p_team_season_id
      and rm.player_id = p_player_id
      and rms.valid_from <= p_period_end
      and coalesce(rms.valid_until, p_period_end) >= p_period_start
  ) then
    raise exception 'PLAYER360_ANALYTICS_PLAYER_OUTSIDE_ROSTER_PERIOD';
  end if;

  select s.id into v_existing_id
  from public.player_longitudinal_snapshots s
  where s.team_season_id = p_team_season_id
    and s.player_id = p_player_id
    and s.period_start = p_period_start
    and s.period_end = p_period_end
    and s.calculation_version = p_calculation_version
    and s.source_fingerprint = p_source_fingerprint;

  if v_existing_id is not null then return v_existing_id; end if;

  insert into public.player_longitudinal_snapshots (
    team_season_id, player_id, period_start, period_end,
    bucket_unit, contract_version, calculation_version,
    source_revision, source_fingerprint, rejected_observations,
    snapshot, evidence_bundle, generated_by
  ) values (
    p_team_season_id, p_player_id, p_period_start, p_period_end,
    'WEEK', p_contract_version, trim(p_calculation_version),
    nullif(trim(coalesce(p_source_revision, '')), ''),
    trim(p_source_fingerprint), greatest(coalesce(p_rejected_observations, 0), 0),
    p_snapshot, p_evidence_bundle, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.iq_v4_save_ai_insight(
  p_snapshot_id uuid,
  p_audience text,
  p_locale text,
  p_provider text,
  p_model_name text,
  p_prompt_version text,
  p_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot public.player_longitudinal_snapshots;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_snapshot
  from public.player_longitudinal_snapshots
  where id = p_snapshot_id;

  if v_snapshot.id is null then raise exception 'PLAYER360_SNAPSHOT_NOT_FOUND'; end if;
  if not public.iq_v4_can_generate_ai_insights(v_snapshot.team_season_id) then
    raise exception 'PLAYER360_AI_GENERATE_DENIED';
  end if;
  if upper(trim(coalesce(p_audience, ''))) not in ('STAFF','PLAYER','FAMILY','EXECUTIVE') then
    raise exception 'PLAYER360_AI_AUDIENCE_INVALID';
  end if;
  if length(trim(coalesce(p_provider, ''))) = 0
     or length(trim(coalesce(p_model_name, ''))) = 0
     or length(trim(coalesce(p_prompt_version, ''))) = 0 then
    raise exception 'PLAYER360_AI_TRACEABILITY_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_content, 'null'::jsonb)) <> 'object' then
    raise exception 'PLAYER360_AI_CONTENT_INVALID';
  end if;

  insert into public.player_ai_insights (
    snapshot_id, team_season_id, player_id, audience, locale,
    provider, model_name, prompt_version, evidence_version,
    content, status, requested_by
  ) values (
    v_snapshot.id, v_snapshot.team_season_id, v_snapshot.player_id,
    upper(trim(p_audience)), lower(trim(coalesce(p_locale, 'es'))),
    trim(p_provider), trim(p_model_name), trim(p_prompt_version),
    coalesce(v_snapshot.evidence_bundle ->> 'evidence_version', 'PLAYER360_EVIDENCE_V1'),
    p_content, 'DRAFT', auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.iq_v4_review_ai_insight(
  p_insight_id uuid,
  p_status text,
  p_review_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insight public.player_ai_insights;
  v_status text := upper(trim(coalesce(p_status, '')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_status not in ('APPROVED','REJECTED','ARCHIVED') then
    raise exception 'PLAYER360_AI_REVIEW_STATUS_INVALID';
  end if;

  select * into v_insight
  from public.player_ai_insights
  where id = p_insight_id
  for update;

  if v_insight.id is null then raise exception 'PLAYER360_AI_INSIGHT_NOT_FOUND'; end if;
  if not public.iq_v4_can_review_ai_insights(v_insight.team_season_id) then
    raise exception 'PLAYER360_AI_REVIEW_DENIED';
  end if;

  update public.player_ai_insights
  set status = v_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = nullif(trim(coalesce(p_review_notes, '')), '')
  where id = p_insight_id;

  return true;
end;
$$;

create or replace function public.iq_v4_longitudinal_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'longitudinal_snapshots', true,
    'ai_insights', true,
    'human_review', true,
    'contract_version', 'PLAYER360_LONGITUDINAL_V1',
    'evidence_version', 'PLAYER360_EVIDENCE_V1'
  );
$$;

revoke all on function public.iq_v4_save_longitudinal_snapshot(
  uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer
) from public, anon, authenticated;
revoke all on function public.iq_v4_save_ai_insight(
  uuid,text,text,text,text,text,jsonb
) from public, anon, authenticated;
revoke all on function public.iq_v4_review_ai_insight(uuid,text,text) from public, anon, authenticated;
revoke all on function public.iq_v4_longitudinal_capabilities() from public, anon, authenticated;

grant execute on function public.iq_v4_save_longitudinal_snapshot(
  uuid,uuid,date,date,text,text,text,text,jsonb,jsonb,integer
) to authenticated;
grant execute on function public.iq_v4_save_ai_insight(
  uuid,text,text,text,text,text,jsonb
) to authenticated;
grant execute on function public.iq_v4_review_ai_insight(uuid,text,text) to authenticated;
grant execute on function public.iq_v4_longitudinal_capabilities() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('player_longitudinal_snapshots','player_ai_insights')
      and c.relrowsecurity
    group by n.nspname
    having count(*) = 2
  ) then
    raise exception 'PLAYER360_PHASE4D_RLS_NOT_ENABLED';
  end if;

  if has_table_privilege('authenticated','public.player_longitudinal_snapshots','INSERT')
     or has_table_privilege('authenticated','public.player_ai_insights','UPDATE') then
    raise exception 'PLAYER360_PHASE4D_DIRECT_WRITE_OPEN';
  end if;
end $$;

rollback;

select
  'PLAYER360_PHASE4D_DESIGN_ROLLBACK' as section,
  to_regclass('public.player_longitudinal_snapshots') is null as snapshots_rolled_back,
  to_regclass('public.player_ai_insights') is null as insights_rolled_back;
