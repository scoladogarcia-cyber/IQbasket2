-- =============================================================================
-- IQBasket Player 360 Phase 4G - FREE_ONLY AI Gateway
-- ADDITIVE/HARDENING:
-- - audits every real LLM request;
-- - enforces backend RBAC + restricted-data ABAC;
-- - enforces configurable monthly quotas;
-- - persists AI output only through the trusted Edge Function/service_role path;
-- - blocks variable API cost by contract (cost must be exactly zero).
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.player_longitudinal_snapshots') is null
     or to_regclass('public.player_ai_insights') is null
     or to_regprocedure('public.iq_v4_can_generate_ai_insights(uuid)') is null
     or to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null then
    raise exception 'PLAYER360_PHASE4G_PREREQUISITES_MISSING';
  end if;

  if to_regclass('public.player_ai_gateway_requests') is not null
     or to_regclass('public.ai_gateway_role_limits') is not null then
    raise exception 'PLAYER360_PHASE4G_ALREADY_INSTALLED';
  end if;
end $$;

-- Commercial/abuse-control configuration. Null monthly_requests means unlimited.
create table public.ai_gateway_role_limits (
  role_code text primary key,
  monthly_requests integer,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint ai_gateway_role_limits_role_check check (
    role_code in ('SUPERADMIN','ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO','JUGADOR','FAMILIA_TUTOR','VISOR','INVITADO')
  ),
  constraint ai_gateway_role_limits_value_check check (
    monthly_requests is null or monthly_requests >= 0
  )
);

insert into public.ai_gateway_role_limits(role_code, monthly_requests) values
  ('SUPERADMIN', null),
  ('ADMIN', 200),
  ('ENTRENADOR', 100),
  ('ANALISTA', 100),
  ('PREPARADOR_FISICO', 50),
  ('JUGADOR', 0),
  ('FAMILIA_TUTOR', 10),
  ('VISOR', 20),
  ('INVITADO', 10);

create table public.player_ai_gateway_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  snapshot_id uuid not null,
  team_season_id uuid not null,
  player_id uuid not null,
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  audience text not null,
  locale text not null default 'es',
  purpose text not null,
  provider text not null,
  model_name text not null,
  prompt_version text not null,
  input_fingerprint text not null,
  status text not null default 'REQUESTED',
  attempt_count integer not null default 1,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_eur_micros bigint not null default 0,
  insight_id uuid,
  error_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint player_ai_gateway_snapshot_scope_fk
    foreign key (snapshot_id, team_season_id, player_id)
    references public.player_longitudinal_snapshots(id, team_season_id, player_id)
    on delete restrict,
  constraint player_ai_gateway_audience_check
    check (audience in ('STAFF','PLAYER','FAMILY','EXECUTIVE')),
  constraint player_ai_gateway_purpose_check
    check (purpose in ('SPORT_PERFORMANCE','OPERATIONS')),
  constraint player_ai_gateway_provider_check
    check (provider = 'LOCAL_OPENAI_COMPATIBLE'),
  constraint player_ai_gateway_status_check
    check (status in ('REQUESTED','COMPLETED','FAILED')),
  constraint player_ai_gateway_attempt_check check (attempt_count >= 1),
  constraint player_ai_gateway_token_check check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  ),
  constraint player_ai_gateway_zero_cost_check check (estimated_cost_eur_micros = 0),
  constraint player_ai_gateway_completion_check check (
    (status = 'REQUESTED' and completed_at is null and insight_id is null)
    or (status = 'COMPLETED' and completed_at is not null and insight_id is not null)
    or (status = 'FAILED' and completed_at is not null and insight_id is null)
  )
);

create index idx_player_ai_gateway_usage
  on public.player_ai_gateway_requests(requested_by, requested_at desc);
create index idx_player_ai_gateway_scope
  on public.player_ai_gateway_requests(team_season_id, player_id, requested_at desc);

alter table public.player_ai_insights
  add column ai_gateway_request_id uuid;

alter table public.player_ai_insights
  add constraint player_ai_insights_gateway_request_unique unique (ai_gateway_request_id),
  add constraint player_ai_insights_gateway_request_fk
    foreign key (ai_gateway_request_id)
    references public.player_ai_gateway_requests(id)
    on delete restrict;

alter table public.player_ai_gateway_requests
  add constraint player_ai_gateway_insight_fk
  foreign key (insight_id) references public.player_ai_insights(id) on delete restrict;

alter table public.ai_gateway_role_limits enable row level security;
alter table public.player_ai_gateway_requests enable row level security;

revoke all on table public.ai_gateway_role_limits from public, anon, authenticated;
revoke all on table public.player_ai_gateway_requests from public, anon, authenticated;

-- Keep quotas centrally editable by trusted backend/admin tooling, not browser code.
grant select on table public.ai_gateway_role_limits to service_role;
grant select, insert, update on table public.player_ai_gateway_requests to service_role;

create trigger trg_player_ai_gateway_requests_touch
before update on public.player_ai_gateway_requests
for each row execute function public.iq_v4_touch_updated_at();

-- Detects sensitive modules directly from persisted evidence so callers cannot
-- hide a restricted module by omitting a flag in the request payload.
create or replace function public.iq_v4g_detect_sensitive_modules(p_evidence jsonb)
returns text[]
language sql
immutable
security definer
set search_path = ''
as $iq4g$
  with facts as (
    select value as fact
    from jsonb_array_elements(coalesce(p_evidence -> 'facts', '[]'::jsonb))
  ), keys as (
    select nullif(fact ->> 'metric_key','') as metric_key from facts
    union all
    select nullif(fact ->> 'left_metric_key','') from facts
    union all
    select nullif(fact ->> 'right_metric_key','') from facts
  ), modules as (
    select lower(split_part(metric_key,'.',1)) as module
    from keys
    where metric_key is not null
  )
  select coalesce(array_agg(distinct module order by module), array[]::text[])
  from modules
  where module in ('nutrition','recovery','neuro_cognitive');
$iq4g$;

-- Resolves quota from the highest active contextual role. This is independent
-- from UI limits so backend abuse control cannot be bypassed by client changes.
create or replace function public.iq_v4g_monthly_request_limit(p_team_season_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $iq4g$
declare
  v_role text := 'INVITADO';
  v_limit integer;
begin
  if auth.uid() is null then return 0; end if;

  if public.iq_v3_is_global_superadmin() then
    v_role := 'SUPERADMIN';
  elsif public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'],
    array['ADMIN']
  ) then
    v_role := 'ADMIN';
  elsif public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ENTRENADOR','AYUDANTE'],
    array[]::text[],
    array['ENTRENADOR']
  ) then
    v_role := 'ENTRENADOR';
  elsif public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ANALISTA'],array['ANALISTA'],array['ANALISTA']
  ) then
    v_role := 'ANALISTA';
  elsif public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['PREPARADOR_FISICO'],array[]::text[],array['PREPARADOR_FISICO']
  ) then
    v_role := 'PREPARADOR_FISICO';
  end if;

  select monthly_requests into v_limit
  from public.ai_gateway_role_limits
  where role_code = v_role and enabled;

  return coalesce(v_limit, -1); -- -1 = unlimited
end;
$iq4g$;

create or replace function public.iq_v4g_prepare_ai_gateway_request(
  p_snapshot_id uuid,
  p_audience text,
  p_locale text,
  p_purpose text,
  p_provider text,
  p_model_name text,
  p_prompt_version text,
  p_input_fingerprint text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $iq4g$
declare
  v_snapshot public.player_longitudinal_snapshots;
  v_existing public.player_ai_gateway_requests;
  v_sensitive_module text;
  v_limit integer;
  v_used integer;
  v_request_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_snapshot
  from public.player_longitudinal_snapshots
  where id = p_snapshot_id;
  if v_snapshot.id is null then raise exception 'PLAYER360_SNAPSHOT_NOT_FOUND'; end if;

  if not public.iq_v4_can_generate_ai_insights(v_snapshot.team_season_id) then
    raise exception 'PLAYER360_AI_GENERATE_DENIED';
  end if;

  if upper(trim(coalesce(p_audience,''))) not in ('STAFF','PLAYER','FAMILY','EXECUTIVE')
     or upper(trim(coalesce(p_purpose,''))) not in ('SPORT_PERFORMANCE','OPERATIONS') then
    raise exception 'PLAYER360_AI_GATEWAY_CONTEXT_INVALID';
  end if;

  if upper(trim(coalesce(p_provider,''))) <> 'LOCAL_OPENAI_COMPATIBLE' then
    raise exception 'PLAYER360_AI_PAID_OR_UNSUPPORTED_PROVIDER_BLOCKED';
  end if;

  if length(trim(coalesce(p_model_name,''))) = 0
     or length(trim(coalesce(p_prompt_version,''))) = 0
     or length(trim(coalesce(p_input_fingerprint,''))) < 32
     or length(trim(coalesce(p_request_key,''))) < 32 then
    raise exception 'PLAYER360_AI_TRACEABILITY_REQUIRED';
  end if;

  foreach v_sensitive_module in array public.iq_v4g_detect_sensitive_modules(v_snapshot.evidence_bundle)
  loop
    if not public.iq_v4e_can_access_sensitive_resource(
      v_snapshot.player_id,
      v_snapshot.team_season_id,
      v_sensitive_module,
      'AI_PROCESS',
      upper(trim(p_purpose))
    ) then
      raise exception 'PLAYER360_AI_SENSITIVE_PROCESSING_DENIED:%', v_sensitive_module;
    end if;
  end loop;

  select * into v_existing
  from public.player_ai_gateway_requests
  where request_key = trim(p_request_key)
  for update;

  if v_existing.id is not null then
    if v_existing.requested_by <> auth.uid() then
      raise exception 'PLAYER360_AI_REQUEST_KEY_COLLISION';
    end if;
    if v_existing.status = 'COMPLETED' then
      return jsonb_build_object(
        'request_id', v_existing.id,
        'insight_id', v_existing.insight_id,
        'deduplicated', true
      );
    elsif v_existing.status = 'REQUESTED' then
      raise exception 'PLAYER360_AI_REQUEST_ALREADY_IN_PROGRESS';
    else
      update public.player_ai_gateway_requests
      set status='REQUESTED',
          attempt_count=attempt_count+1,
          error_code=null,
          completed_at=null,
          input_tokens=null,
          output_tokens=null,
          insight_id=null,
          estimated_cost_eur_micros=0,
          requested_at=now()
      where id=v_existing.id;
      return jsonb_build_object(
        'request_id', v_existing.id,
        'insight_id', null,
        'deduplicated', false
      );
    end if;
  end if;

  v_limit := public.iq_v4g_monthly_request_limit(v_snapshot.team_season_id);
  if v_limit = 0 then raise exception 'PLAYER360_AI_MONTHLY_QUOTA_ZERO'; end if;

  if v_limit > 0 then
    select count(*) into v_used
    from public.player_ai_gateway_requests r
    where r.requested_by = auth.uid()
      and r.requested_at >= date_trunc('month', now())
      and r.requested_at < date_trunc('month', now()) + interval '1 month';
    if v_used >= v_limit then raise exception 'PLAYER360_AI_MONTHLY_QUOTA_EXCEEDED'; end if;
  end if;

  insert into public.player_ai_gateway_requests(
    request_key,snapshot_id,team_season_id,player_id,requested_by,
    audience,locale,purpose,provider,model_name,prompt_version,input_fingerprint,
    status,estimated_cost_eur_micros
  ) values (
    trim(p_request_key),v_snapshot.id,v_snapshot.team_season_id,v_snapshot.player_id,auth.uid(),
    upper(trim(p_audience)),lower(trim(coalesce(p_locale,'es'))),upper(trim(p_purpose)),
    upper(trim(p_provider)),trim(p_model_name),trim(p_prompt_version),trim(p_input_fingerprint),
    'REQUESTED',0
  ) returning id into v_request_id;

  return jsonb_build_object(
    'request_id', v_request_id,
    'insight_id', null,
    'deduplicated', false
  );
end;
$iq4g$;

create or replace function public.iq_v4g_complete_ai_gateway_request(
  p_request_id uuid,
  p_content jsonb,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_estimated_cost_eur_micros bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $iq4g$
declare
  v_request public.player_ai_gateway_requests;
  v_snapshot public.player_longitudinal_snapshots;
  v_insight_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'PLAYER360_AI_GATEWAY_SERVICE_ROLE_REQUIRED';
  end if;
  if coalesce(p_estimated_cost_eur_micros,0) <> 0 then
    raise exception 'PLAYER360_AI_PAID_COST_BLOCKED';
  end if;
  if jsonb_typeof(coalesce(p_content,'null'::jsonb)) <> 'object' then
    raise exception 'PLAYER360_AI_CONTENT_INVALID';
  end if;

  select * into v_request
  from public.player_ai_gateway_requests
  where id=p_request_id
  for update;
  if v_request.id is null then raise exception 'PLAYER360_AI_GATEWAY_REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'REQUESTED' then raise exception 'PLAYER360_AI_GATEWAY_REQUEST_NOT_OPEN'; end if;

  select * into v_snapshot from public.player_longitudinal_snapshots where id=v_request.snapshot_id;
  if v_snapshot.id is null then raise exception 'PLAYER360_SNAPSHOT_NOT_FOUND'; end if;

  insert into public.player_ai_insights(
    snapshot_id,team_season_id,player_id,audience,locale,
    provider,model_name,prompt_version,evidence_version,content,status,requested_by,
    ai_gateway_request_id
  ) values (
    v_snapshot.id,v_snapshot.team_season_id,v_snapshot.player_id,v_request.audience,v_request.locale,
    v_request.provider,v_request.model_name,v_request.prompt_version,
    coalesce(v_snapshot.evidence_bundle ->> 'evidence_version','PLAYER360_EVIDENCE_V1'),
    p_content,'DRAFT',v_request.requested_by,v_request.id
  ) returning id into v_insight_id;

  update public.player_ai_gateway_requests
  set status='COMPLETED',
      input_tokens=case when p_input_tokens is null then null else greatest(p_input_tokens,0) end,
      output_tokens=case when p_output_tokens is null then null else greatest(p_output_tokens,0) end,
      estimated_cost_eur_micros=0,
      insight_id=v_insight_id,
      completed_at=now(),
      error_code=null
  where id=v_request.id;

  return jsonb_build_object('request_id',v_request.id,'insight_id',v_insight_id);
end;
$iq4g$;

create or replace function public.iq_v4g_fail_ai_gateway_request(
  p_request_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $iq4g$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'PLAYER360_AI_GATEWAY_SERVICE_ROLE_REQUIRED';
  end if;

  update public.player_ai_gateway_requests
  set status='FAILED',
      error_code=left(nullif(trim(coalesce(p_error_code,'')),''),120),
      completed_at=now(),
      estimated_cost_eur_micros=0
  where id=p_request_id and status='REQUESTED';

  return found;
end;
$iq4g$;

revoke all on function public.iq_v4g_detect_sensitive_modules(jsonb) from public, anon, authenticated;
revoke all on function public.iq_v4g_monthly_request_limit(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4g_prepare_ai_gateway_request(uuid,text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint) from public, anon, authenticated;
revoke all on function public.iq_v4g_fail_ai_gateway_request(uuid,text) from public, anon, authenticated;

grant execute on function public.iq_v4g_prepare_ai_gateway_request(uuid,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.iq_v4g_complete_ai_gateway_request(uuid,jsonb,integer,integer,bigint) to service_role;
grant execute on function public.iq_v4g_fail_ai_gateway_request(uuid,text) to service_role;

-- Phase 4D allowed authenticated clients to persist AI text directly. Once the
-- real gateway exists, close that bypass: only the audited server path may save
-- model output. Human review remains unchanged.
revoke execute on function public.iq_v4_save_ai_insight(uuid,text,text,text,text,text,jsonb) from authenticated;

commit;
