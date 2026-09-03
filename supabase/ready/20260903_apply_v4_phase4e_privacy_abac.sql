-- =============================================================================
-- IQBasket Player 360 Phase 4E.1 - Privacy / Consent / ABAC foundation
-- ADDITIVE. Does NOT create Nutrition/Recovery/Neuro data tables.
-- =============================================================================

begin;

do $iq4e$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('public.players') is null
     or to_regclass('public.team_seasons') is null
     or to_regclass('public.roster_memberships') is null
     or to_regclass('public.team_season_memberships') is null
     or to_regclass('public.club_season_memberships') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_v4_has_player360_action_role(uuid,text[],text[],text[])') is null
     or to_regprocedure('public.iq_v4_touch_updated_at()') is null then
    raise exception 'PLAYER360_PHASE4E_PREREQUISITES_MISSING';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='user_profiles'
      and column_name='linked_player_id'
  ) then
    raise exception 'PLAYER360_PHASE4E_LINKED_PLAYER_ID_REQUIRED';
  end if;

  if to_regclass('public.player360_subject_relationships') is not null
     or to_regclass('public.player360_processing_authorizations') is not null
     or to_regclass('public.player360_sensitive_access_requests') is not null
     or to_regclass('public.player360_sensitive_access_grants') is not null
     or to_regclass('public.player360_privacy_audit_log') is not null then
    raise exception 'PLAYER360_PHASE4E_ALREADY_INSTALLED';
  end if;
end
$iq4e$;

-- -----------------------------------------------------------------------------
-- 1. Privacy governance resources
-- -----------------------------------------------------------------------------

create table public.player360_subject_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  relationship_type text not null,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  verification_source text,
  verified_by uuid references public.user_profiles(id) on delete set null,
  revoked_by uuid references public.user_profiles(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_subject_relationship_type_check
    check (relationship_type in ('SELF','GUARDIAN')),
  constraint player360_subject_relationship_status_check
    check (status in ('ACTIVE','REVOKED','EXPIRED','SUSPENDED')),
  constraint player360_subject_relationship_validity_check
    check (valid_until is null or valid_until > valid_from),
  constraint player360_subject_relationship_revoke_check
    check (
      (status <> 'REVOKED' and revoked_at is null)
      or (status = 'REVOKED' and revoked_at is not null)
    )
);

create index idx_player360_subject_relationship_user
  on public.player360_subject_relationships(user_id, status, valid_until);
create index idx_player360_subject_relationship_player
  on public.player360_subject_relationships(player_id, status, valid_until);

create table public.player360_processing_authorizations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  modules text[] not null,
  purposes text[] not null,
  authorization_type text not null,
  legal_basis_code text not null,
  special_category_condition_code text not null,
  ai_processing_allowed boolean not null default false,
  representative_user_id uuid references public.user_profiles(id) on delete set null,
  evidence_reference text,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  recorded_by uuid not null references public.user_profiles(id) on delete restrict,
  revoked_by uuid references public.user_profiles(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_processing_authorization_modules_check
    check (
      cardinality(modules) > 0
      and modules <@ array['nutrition','recovery','neuro_cognitive']::text[]
    ),
  constraint player360_processing_authorization_purposes_check
    check (
      cardinality(purposes) > 0
      and purposes <@ array[
        'SPORT_PERFORMANCE','PLAYER_SELF_SERVICE','FAMILY_SUPPORT','OPERATIONS'
      ]::text[]
    ),
  constraint player360_processing_authorization_type_check
    check (authorization_type in ('CONSENT','GUARDIAN_CONSENT','OTHER_DOCUMENTED_BASIS')),
  constraint player360_processing_authorization_status_check
    check (status in ('ACTIVE','REVOKED','EXPIRED','SUSPENDED')),
  constraint player360_processing_authorization_validity_check
    check (valid_until is null or valid_until > valid_from),
  constraint player360_processing_authorization_codes_check
    check (
      length(trim(legal_basis_code)) > 0
      and length(trim(special_category_condition_code)) > 0
    ),
  constraint player360_processing_authorization_revoke_check
    check (
      (status <> 'REVOKED' and revoked_at is null)
      or (status = 'REVOKED' and revoked_at is not null)
    )
);

create index idx_player360_processing_authorization_scope
  on public.player360_processing_authorizations(
    team_season_id, player_id, status, valid_until
  );

create table public.player360_sensitive_access_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  modules text[] not null,
  actions text[] not null,
  purposes text[] not null,
  justification text not null,
  status text not null default 'PENDING',
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_sensitive_request_modules_check
    check (
      cardinality(modules) > 0
      and modules <@ array['nutrition','recovery','neuro_cognitive']::text[]
    ),
  constraint player360_sensitive_request_actions_check
    check (
      cardinality(actions) > 0
      and actions <@ array['READ','CREATE','UPDATE','DELETE','EXPORT','AI_PROCESS']::text[]
    ),
  constraint player360_sensitive_request_purposes_check
    check (
      cardinality(purposes) > 0
      and purposes <@ array['SPORT_PERFORMANCE','OPERATIONS']::text[]
    ),
  constraint player360_sensitive_request_status_check
    check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  constraint player360_sensitive_request_review_check
    check (
      (status = 'PENDING' and reviewed_at is null and reviewed_by is null)
      or (status <> 'PENDING' and reviewed_at is not null and reviewed_by is not null)
    ),
  constraint player360_sensitive_request_justification_check
    check (length(trim(justification)) > 0)
);

create index idx_player360_sensitive_request_scope
  on public.player360_sensitive_access_requests(
    team_season_id, player_id, status, created_at desc
  );
create index idx_player360_sensitive_request_actor
  on public.player360_sensitive_access_requests(
    requested_by, status, created_at desc
  );

create table public.player360_sensitive_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  request_id uuid references public.player360_sensitive_access_requests(id) on delete set null,
  modules text[] not null,
  actions text[] not null,
  purposes text[] not null,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid not null references public.user_profiles(id) on delete restrict,
  grant_reason text not null,
  revoked_by uuid references public.user_profiles(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_sensitive_grant_modules_check
    check (
      cardinality(modules) > 0
      and modules <@ array['nutrition','recovery','neuro_cognitive']::text[]
    ),
  constraint player360_sensitive_grant_actions_check
    check (
      cardinality(actions) > 0
      and actions <@ array['READ','CREATE','UPDATE','DELETE','EXPORT','AI_PROCESS']::text[]
    ),
  constraint player360_sensitive_grant_purposes_check
    check (
      cardinality(purposes) > 0
      and purposes <@ array[
        'SPORT_PERFORMANCE','PLAYER_SELF_SERVICE','FAMILY_SUPPORT','OPERATIONS'
      ]::text[]
    ),
  constraint player360_sensitive_grant_status_check
    check (status in ('ACTIVE','REVOKED','EXPIRED','SUSPENDED')),
  constraint player360_sensitive_grant_validity_check
    check (valid_until is null or valid_until > valid_from),
  constraint player360_sensitive_grant_reason_check
    check (length(trim(grant_reason)) > 0),
  constraint player360_sensitive_grant_revoke_check
    check (
      (status <> 'REVOKED' and revoked_at is null)
      or (status = 'REVOKED' and revoked_at is not null)
    )
);

create index idx_player360_sensitive_grant_actor_scope
  on public.player360_sensitive_access_grants(
    user_id, team_season_id, player_id, status, valid_until
  );

create table public.player360_privacy_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  player_id uuid references public.players(id) on delete set null,
  team_season_id uuid references public.team_seasons(id) on delete set null,
  module text,
  action text,
  purpose text,
  decision text,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint player360_privacy_audit_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create index idx_player360_privacy_audit_scope
  on public.player360_privacy_audit_log(
    team_season_id, player_id, occurred_at desc
  );
create index idx_player360_privacy_audit_actor
  on public.player360_privacy_audit_log(actor_user_id, occurred_at desc);

create trigger trg_player360_subject_relationships_touch
before update on public.player360_subject_relationships
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player360_processing_authorizations_touch
before update on public.player360_processing_authorizations
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player360_sensitive_access_requests_touch
before update on public.player360_sensitive_access_requests
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player360_sensitive_access_grants_touch
before update on public.player360_sensitive_access_grants
for each row execute function public.iq_v4_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Authorization helpers
-- -----------------------------------------------------------------------------

create function public.iq_v4e_can_admin_privacy(p_team_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO'],
    array['ADMIN']
  );
$iq4e$;

create function public.iq_v4e_can_request_sensitive_access(p_team_season_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );
$iq4e$;

create function public.iq_v4e_subject_relation(p_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select coalesce(
    (
      select r.relationship_type
      from public.player360_subject_relationships r
      where r.user_id = auth.uid()
        and r.player_id = p_player_id
        and r.status = 'ACTIVE'
        and r.valid_from <= now()
        and (r.valid_until is null or r.valid_until > now())
      order by case r.relationship_type when 'SELF' then 0 else 1 end, r.created_at desc
      limit 1
    ),
    (
      select case
        when upper(coalesce(up.global_role, up.role, '')) = 'JUGADOR' then 'SELF'
        when upper(coalesce(up.global_role, up.role, '')) = 'FAMILIA_TUTOR' then 'GUARDIAN'
        else null
      end
      from public.user_profiles up
      where up.id = auth.uid()
        and up.linked_player_id = p_player_id
    ),
    'NONE'
  );
$iq4e$;

create function public.iq_v4e_has_processing_authorization(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select exists (
    select 1
    from public.player360_processing_authorizations a
    where a.player_id = p_player_id
      and a.team_season_id = p_team_season_id
      and a.status = 'ACTIVE'
      and a.valid_from <= now()
      and (a.valid_until is null or a.valid_until > now())
      and lower(trim(p_module)) = any(a.modules)
      and upper(trim(p_purpose)) = any(a.purposes)
      and length(trim(a.legal_basis_code)) > 0
      and length(trim(a.special_category_condition_code)) > 0
      and (
        upper(trim(p_action)) <> 'AI_PROCESS'
        or a.ai_processing_allowed
      )
  );
$iq4e$;

create function public.iq_v4e_has_sensitive_grant(
  p_user_id uuid,
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select exists (
    select 1
    from public.player360_sensitive_access_grants g
    where g.user_id = p_user_id
      and g.player_id = p_player_id
      and g.team_season_id = p_team_season_id
      and g.status = 'ACTIVE'
      and g.valid_from <= now()
      and (g.valid_until is null or g.valid_until > now())
      and lower(trim(p_module)) = any(g.modules)
      and upper(trim(p_action)) = any(g.actions)
      and upper(trim(p_purpose)) = any(g.purposes)
  );
$iq4e$;

create function public.iq_v4e_user_has_player_context(
  p_user_id uuid,
  p_player_id uuid,
  p_team_season_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select
    p_user_id is not null
    and p_player_id is not null
    and p_team_season_id is not null
    and exists (
      select 1
      from public.team_seasons ts
      join public.teams t on t.id = ts.team_id
      where ts.id = p_team_season_id
        and (
          exists (
            select 1
            from public.player360_subject_relationships r
            where r.user_id = p_user_id
              and r.player_id = p_player_id
              and r.status = 'ACTIVE'
              and r.valid_from <= now()
              and (r.valid_until is null or r.valid_until > now())
          )
          or exists (
            select 1
            from public.user_profiles up
            where up.id = p_user_id
              and up.linked_player_id = p_player_id
              and upper(coalesce(up.global_role, up.role, '')) in ('JUGADOR','FAMILIA_TUTOR')
          )
          or exists (
            select 1
            from public.team_season_memberships m
            where m.user_id = p_user_id
              and m.team_season_id = ts.id
              and upper(coalesce(m.status,'ACTIVE')) = 'ACTIVE'
              and (m.valid_from is null or m.valid_from <= now())
              and (m.valid_until is null or m.valid_until > now())
          )
          or exists (
            select 1
            from public.club_season_memberships cm
            where cm.user_id = p_user_id
              and cm.club_id = t.club_id
              and cm.season_id = ts.season_id
              and upper(coalesce(cm.status,'ACTIVE')) = 'ACTIVE'
              and (cm.valid_from is null or cm.valid_from <= now())
              and (cm.valid_until is null or cm.valid_until > now())
          )
          or exists (
            select 1
            from public.user_profiles up
            where up.id = p_user_id
              and upper(coalesce(up.global_role, up.role, '')) = 'SUPERADMIN'
          )
          or exists (
            select 1
            from public.user_profiles up
            cross join lateral jsonb_array_elements_text(
              coalesce(to_jsonb(up.assigned_team_ids), '[]'::jsonb)
            ) assigned(team_id)
            where up.id = p_user_id
              and assigned.team_id = ts.team_id::text
          )
        )
    );
$iq4e$;

create function public.iq_v4e_can_access_sensitive_resource(
  p_player_id uuid,
  p_team_season_id uuid,
  p_module text,
  p_action text,
  p_purpose text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $iq4e$
declare
  v_module text := lower(trim(coalesce(p_module,'')));
  v_action text := upper(trim(coalesce(p_action,'')));
  v_purpose text := upper(trim(coalesce(p_purpose,'')));
  v_relation text;
  v_representative_ok boolean := false;
  v_staff_context boolean := false;
begin
  if auth.uid() is null then return false; end if;
  if v_module not in ('nutrition','recovery','neuro_cognitive') then return false; end if;
  if v_action not in ('READ','CREATE','UPDATE','DELETE','EXPORT','AI_PROCESS') then return false; end if;
  if v_purpose not in (
    'SPORT_PERFORMANCE','PLAYER_SELF_SERVICE','FAMILY_SUPPORT','OPERATIONS'
  ) then return false; end if;

  if not exists (
    select 1 from public.roster_memberships rm
    where rm.player_id = p_player_id
      and rm.team_season_id = p_team_season_id
  ) then
    return false;
  end if;

  if not public.iq_v4e_has_processing_authorization(
    p_player_id, p_team_season_id, v_module, v_action, v_purpose
  ) then
    return false;
  end if;

  v_relation := public.iq_v4e_subject_relation(p_player_id);

  -- Export and AI processing always require an explicit grant, including SELF/GUARDIAN.
  if v_action in ('EXPORT','AI_PROCESS') then
    return public.iq_v4e_has_sensitive_grant(
      auth.uid(), p_player_id, p_team_season_id, v_module, v_action, v_purpose
    );
  end if;

  if v_relation = 'SELF' then
    return v_purpose = 'PLAYER_SELF_SERVICE'
      and v_action in ('READ','CREATE','UPDATE');
  end if;

  if v_relation = 'GUARDIAN' then
    select exists (
      select 1
      from public.player360_processing_authorizations a
      where a.player_id = p_player_id
        and a.team_season_id = p_team_season_id
        and a.status = 'ACTIVE'
        and a.valid_from <= now()
        and (a.valid_until is null or a.valid_until > now())
        and v_module = any(a.modules)
        and v_purpose = any(a.purposes)
        and (a.representative_user_id is null or a.representative_user_id = auth.uid())
    ) into v_representative_ok;

    return v_purpose = 'FAMILY_SUPPORT'
      and v_action in ('READ','CREATE','UPDATE')
      and v_representative_ok;
  end if;

  v_staff_context := public.iq_v4_has_player360_action_role(
    p_team_season_id,
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
    array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
    array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
  );

  if not v_staff_context then return false; end if;
  if v_purpose not in ('SPORT_PERFORMANCE','OPERATIONS') then return false; end if;

  return public.iq_v4e_has_sensitive_grant(
    auth.uid(), p_player_id, p_team_season_id, v_module, v_action, v_purpose
  );
end;
$iq4e$;

create function public.iq_v4e_log_privacy_event(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_player_id uuid,
  p_team_season_id uuid,
  p_action text,
  p_purpose text,
  p_decision text,
  p_reason_code text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $iq4e$
  insert into public.player360_privacy_audit_log(
    actor_user_id, event_type, entity_type, entity_id,
    player_id, team_season_id, action, purpose,
    decision, reason_code, metadata
  ) values (
    auth.uid(), trim(p_event_type), nullif(trim(coalesce(p_entity_type,'')),''),
    p_entity_id, p_player_id, p_team_season_id,
    nullif(upper(trim(coalesce(p_action,''))),''),
    nullif(upper(trim(coalesce(p_purpose,''))),''),
    nullif(upper(trim(coalesce(p_decision,''))),''),
    nullif(trim(coalesce(p_reason_code,'')),''),
    coalesce(p_metadata,'{}'::jsonb)
  );
$iq4e$;

-- -----------------------------------------------------------------------------
-- 3. Controlled mutation RPCs
-- -----------------------------------------------------------------------------

create function public.iq_v4e_record_subject_relationship(
  p_team_season_id uuid,
  p_user_id uuid,
  p_player_id uuid,
  p_relationship_type text,
  p_valid_until timestamptz default null,
  p_verification_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_id uuid;
  v_type text := upper(trim(coalesce(p_relationship_type,'')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PLAYER360_PRIVACY_ADMIN_DENIED';
  end if;
  if v_type not in ('SELF','GUARDIAN') then
    raise exception 'PLAYER360_PRIVACY_RELATION_INVALID';
  end if;
  if not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id = p_team_season_id and rm.player_id = p_player_id
  ) then
    raise exception 'PLAYER360_PRIVACY_PLAYER_SCOPE_INVALID';
  end if;

  insert into public.player360_subject_relationships(
    user_id, player_id, relationship_type, valid_until,
    verification_source, verified_by
  ) values (
    p_user_id, p_player_id, v_type, p_valid_until,
    nullif(trim(coalesce(p_verification_source,'')),''), auth.uid()
  ) returning id into v_id;

  perform public.iq_v4e_log_privacy_event(
    'SUBJECT_RELATIONSHIP_RECORDED','SUBJECT_RELATIONSHIP',v_id,
    p_player_id,p_team_season_id,'CREATE',null,'ALLOW','ADMIN_RECORDED',
    jsonb_build_object('relationship_type',v_type,'target_user_id',p_user_id)
  );
  return v_id;
end;
$iq4e$;

create function public.iq_v4e_revoke_subject_relationship(
  p_team_season_id uuid,
  p_relationship_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_row public.player360_subject_relationships;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PLAYER360_PRIVACY_ADMIN_DENIED';
  end if;

  select * into v_row
  from public.player360_subject_relationships
  where id = p_relationship_id
  for update;
  if v_row.id is null then raise exception 'PLAYER360_PRIVACY_RELATION_NOT_FOUND'; end if;

  update public.player360_subject_relationships
  set status='REVOKED', revoked_by=auth.uid(), revoked_at=now(),
      revocation_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_relationship_id;

  perform public.iq_v4e_log_privacy_event(
    'SUBJECT_RELATIONSHIP_REVOKED','SUBJECT_RELATIONSHIP',p_relationship_id,
    v_row.player_id,p_team_season_id,'UPDATE',null,'ALLOW','ADMIN_REVOKED','{}'::jsonb
  );
  return true;
end;
$iq4e$;

create function public.iq_v4e_record_processing_authorization(
  p_team_season_id uuid,
  p_player_id uuid,
  p_modules text[],
  p_purposes text[],
  p_authorization_type text,
  p_legal_basis_code text,
  p_special_category_condition_code text,
  p_ai_processing_allowed boolean default false,
  p_representative_user_id uuid default null,
  p_valid_until timestamptz default null,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_id uuid;
  v_modules text[];
  v_purposes text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PLAYER360_PRIVACY_ADMIN_DENIED';
  end if;
  if not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id=p_team_season_id and rm.player_id=p_player_id
  ) then
    raise exception 'PLAYER360_PRIVACY_PLAYER_SCOPE_INVALID';
  end if;

  select array_agg(distinct lower(trim(x))) into v_modules
  from unnest(coalesce(p_modules,array[]::text[])) x
  where length(trim(x)) > 0;
  select array_agg(distinct upper(trim(x))) into v_purposes
  from unnest(coalesce(p_purposes,array[]::text[])) x
  where length(trim(x)) > 0;

  insert into public.player360_processing_authorizations(
    player_id,team_season_id,modules,purposes,authorization_type,
    legal_basis_code,special_category_condition_code,ai_processing_allowed,
    representative_user_id,valid_until,evidence_reference,recorded_by
  ) values (
    p_player_id,p_team_season_id,v_modules,v_purposes,
    upper(trim(p_authorization_type)),
    trim(p_legal_basis_code),trim(p_special_category_condition_code),
    coalesce(p_ai_processing_allowed,false),p_representative_user_id,
    p_valid_until,nullif(trim(coalesce(p_evidence_reference,'')),''),auth.uid()
  ) returning id into v_id;

  perform public.iq_v4e_log_privacy_event(
    'PROCESSING_AUTHORIZATION_RECORDED','PROCESSING_AUTHORIZATION',v_id,
    p_player_id,p_team_season_id,'CREATE',null,'ALLOW','ADMIN_RECORDED',
    jsonb_build_object('modules',v_modules,'purposes',v_purposes,'ai_processing_allowed',coalesce(p_ai_processing_allowed,false))
  );
  return v_id;
end;
$iq4e$;

create function public.iq_v4e_revoke_processing_authorization(
  p_authorization_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_row public.player360_processing_authorizations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row
  from public.player360_processing_authorizations
  where id=p_authorization_id
  for update;
  if v_row.id is null then raise exception 'PLAYER360_PRIVACY_AUTHORIZATION_NOT_FOUND'; end if;
  if not public.iq_v4e_can_admin_privacy(v_row.team_season_id) then
    raise exception 'PLAYER360_PRIVACY_ADMIN_DENIED';
  end if;

  update public.player360_processing_authorizations
  set status='REVOKED',revoked_by=auth.uid(),revoked_at=now(),
      revocation_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_authorization_id;

  perform public.iq_v4e_log_privacy_event(
    'PROCESSING_AUTHORIZATION_REVOKED','PROCESSING_AUTHORIZATION',p_authorization_id,
    v_row.player_id,v_row.team_season_id,'UPDATE',null,'ALLOW','ADMIN_REVOKED','{}'::jsonb
  );
  return true;
end;
$iq4e$;

create function public.iq_v4e_request_sensitive_access(
  p_team_season_id uuid,
  p_player_id uuid,
  p_modules text[],
  p_actions text[],
  p_purposes text[],
  p_justification text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_id uuid;
  v_modules text[];
  v_actions text[];
  v_purposes text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_request_sensitive_access(p_team_season_id) then
    raise exception 'PLAYER360_PRIVACY_REQUEST_DENIED';
  end if;
  if not exists (
    select 1 from public.roster_memberships rm
    where rm.team_season_id=p_team_season_id and rm.player_id=p_player_id
  ) then
    raise exception 'PLAYER360_PRIVACY_PLAYER_SCOPE_INVALID';
  end if;

  select array_agg(distinct lower(trim(x))) into v_modules
  from unnest(coalesce(p_modules,array[]::text[])) x where length(trim(x))>0;
  select array_agg(distinct upper(trim(x))) into v_actions
  from unnest(coalesce(p_actions,array[]::text[])) x where length(trim(x))>0;
  select array_agg(distinct upper(trim(x))) into v_purposes
  from unnest(coalesce(p_purposes,array[]::text[])) x where length(trim(x))>0;

  insert into public.player360_sensitive_access_requests(
    requested_by,player_id,team_season_id,modules,actions,purposes,justification
  ) values (
    auth.uid(),p_player_id,p_team_season_id,v_modules,v_actions,v_purposes,trim(p_justification)
  ) returning id into v_id;

  perform public.iq_v4e_log_privacy_event(
    'SENSITIVE_ACCESS_REQUESTED','ACCESS_REQUEST',v_id,
    p_player_id,p_team_season_id,'CREATE',null,'ALLOW','REQUEST_CREATED',
    jsonb_build_object('modules',v_modules,'actions',v_actions,'purposes',v_purposes)
  );
  return v_id;
end;
$iq4e$;

create function public.iq_v4e_grant_sensitive_access(
  p_team_season_id uuid,
  p_user_id uuid,
  p_player_id uuid,
  p_modules text[],
  p_actions text[],
  p_purposes text[],
  p_valid_until timestamptz,
  p_reason text,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_id uuid;
  v_modules text[];
  v_actions text[];
  v_purposes text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.iq_v4e_can_admin_privacy(p_team_season_id) then
    raise exception 'PLAYER360_PRIVACY_ADMIN_DENIED';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'PLAYER360_PRIVACY_SELF_GRANT_DENIED';
  end if;
  if not public.iq_v4e_user_has_player_context(p_user_id,p_player_id,p_team_season_id) then
    raise exception 'PLAYER360_PRIVACY_TARGET_SCOPE_INVALID';
  end if;

  select array_agg(distinct lower(trim(x))) into v_modules
  from unnest(coalesce(p_modules,array[]::text[])) x where length(trim(x))>0;
  select array_agg(distinct upper(trim(x))) into v_actions
  from unnest(coalesce(p_actions,array[]::text[])) x where length(trim(x))>0;
  select array_agg(distinct upper(trim(x))) into v_purposes
  from unnest(coalesce(p_purposes,array[]::text[])) x where length(trim(x))>0;

  insert into public.player360_sensitive_access_grants(
    user_id,player_id,team_season_id,request_id,modules,actions,purposes,
    valid_until,granted_by,grant_reason
  ) values (
    p_user_id,p_player_id,p_team_season_id,p_request_id,v_modules,v_actions,v_purposes,
    p_valid_until,auth.uid(),trim(p_reason)
  ) returning id into v_id;

  if p_request_id is not null then
    update public.player360_sensitive_access_requests
    set status='APPROVED',reviewed_by=auth.uid(),reviewed_at=now(),
        review_notes='Approved via grant '||v_id::text
    where id=p_request_id
      and requested_by=p_user_id
      and player_id=p_player_id
      and team_season_id=p_team_season_id
      and status='PENDING';
  end if;

  perform public.iq_v4e_log_privacy_event(
    'SENSITIVE_ACCESS_GRANTED','ACCESS_GRANT',v_id,
    p_player_id,p_team_season_id,'CREATE',null,'ALLOW','ADMIN_GRANTED',
    jsonb_build_object('target_user_id',p_user_id,'modules',v_modules,'actions',v_actions,'purposes',v_purposes)
  );
  return v_id;
end;
$iq4e$;

create function public.iq_v4e_revoke_sensitive_access_grant(
  p_grant_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $iq4e$
declare
  v_row public.player360_sensitive_access_grants;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row
  from public.player360_sensitive_access_grants
  where id=p_grant_id
  for update;
  if v_row.id is null then raise exception 'PLAYER360_PRIVACY_GRANT_NOT_FOUND'; end if;
  if not public.iq_v4e_can_admin_privacy(v_row.team_season_id) then
    raise exception 'PLAYER360_PRIVACY_ADMIN_DENIED';
  end if;

  update public.player360_sensitive_access_grants
  set status='REVOKED',revoked_by=auth.uid(),revoked_at=now(),
      revocation_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_grant_id;

  perform public.iq_v4e_log_privacy_event(
    'SENSITIVE_ACCESS_REVOKED','ACCESS_GRANT',p_grant_id,
    v_row.player_id,v_row.team_season_id,'UPDATE',null,'ALLOW','ADMIN_REVOKED',
    jsonb_build_object('target_user_id',v_row.user_id)
  );
  return true;
end;
$iq4e$;

create function public.iq_v4e_privacy_capabilities(p_team_season_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $iq4e$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'privacy_foundation', true,
    'restricted_modules_enabled', false,
    'can_admin_privacy', public.iq_v4e_can_admin_privacy(p_team_season_id),
    'can_request_sensitive_access', public.iq_v4e_can_request_sensitive_access(p_team_season_id),
    'research_enabled', false,
    'client_ai_provider_allowed', false
  );
$iq4e$;

-- -----------------------------------------------------------------------------
-- 4. RLS + privileges. No direct table access in 4E.1.
-- -----------------------------------------------------------------------------

alter table public.player360_subject_relationships enable row level security;
alter table public.player360_processing_authorizations enable row level security;
alter table public.player360_sensitive_access_requests enable row level security;
alter table public.player360_sensitive_access_grants enable row level security;
alter table public.player360_privacy_audit_log enable row level security;

revoke all on table
  public.player360_subject_relationships,
  public.player360_processing_authorizations,
  public.player360_sensitive_access_requests,
  public.player360_sensitive_access_grants,
  public.player360_privacy_audit_log
from public, anon, authenticated;

revoke all on function public.iq_v4e_can_admin_privacy(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4e_can_request_sensitive_access(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4e_subject_relation(uuid) from public, anon, authenticated;
revoke all on function public.iq_v4e_has_processing_authorization(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_has_sensitive_grant(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_user_has_player_context(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_log_privacy_event(text,text,uuid,uuid,uuid,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.iq_v4e_record_subject_relationship(uuid,uuid,uuid,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_revoke_subject_relationship(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_record_processing_authorization(uuid,uuid,text[],text[],text,text,text,boolean,uuid,timestamptz,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_revoke_processing_authorization(uuid,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_request_sensitive_access(uuid,uuid,text[],text[],text[],text) from public, anon, authenticated;
revoke all on function public.iq_v4e_grant_sensitive_access(uuid,uuid,uuid,text[],text[],text[],timestamptz,text,uuid) from public, anon, authenticated;
revoke all on function public.iq_v4e_revoke_sensitive_access_grant(uuid,text) from public, anon, authenticated;
revoke all on function public.iq_v4e_privacy_capabilities(uuid) from public, anon, authenticated;

grant execute on function public.iq_v4e_can_admin_privacy(uuid) to authenticated;
grant execute on function public.iq_v4e_can_request_sensitive_access(uuid) to authenticated;
grant execute on function public.iq_v4e_subject_relation(uuid) to authenticated;
grant execute on function public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.iq_v4e_record_subject_relationship(uuid,uuid,uuid,text,timestamptz,text) to authenticated;
grant execute on function public.iq_v4e_revoke_subject_relationship(uuid,uuid,text) to authenticated;
grant execute on function public.iq_v4e_record_processing_authorization(uuid,uuid,text[],text[],text,text,text,boolean,uuid,timestamptz,text) to authenticated;
grant execute on function public.iq_v4e_revoke_processing_authorization(uuid,text) to authenticated;
grant execute on function public.iq_v4e_request_sensitive_access(uuid,uuid,text[],text[],text[],text) to authenticated;
grant execute on function public.iq_v4e_grant_sensitive_access(uuid,uuid,uuid,text[],text[],text[],timestamptz,text,uuid) to authenticated;
grant execute on function public.iq_v4e_revoke_sensitive_access_grant(uuid,text) to authenticated;
grant execute on function public.iq_v4e_privacy_capabilities(uuid) to authenticated;

do $iq4e$
begin
  if has_table_privilege('authenticated','public.player360_processing_authorizations','SELECT')
     or has_table_privilege('authenticated','public.player360_sensitive_access_grants','SELECT')
     or has_table_privilege('authenticated','public.player360_privacy_audit_log','SELECT')
     or has_table_privilege('authenticated','public.player360_processing_authorizations','INSERT')
     or has_table_privilege('authenticated','public.player360_sensitive_access_grants','UPDATE') then
    raise exception 'PLAYER360_PHASE4E_DIRECT_TABLE_ACCESS_OPEN';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.iq_v4e_has_processing_authorization(uuid,uuid,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.iq_v4e_has_sensitive_grant(uuid,uuid,uuid,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.iq_v4e_log_privacy_event(text,text,uuid,uuid,uuid,text,text,text,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'PLAYER360_PHASE4E_INTERNAL_HELPER_EXPOSED';
  end if;
end
$iq4e$;

commit;

select
  'PLAYER360_PHASE4E_APPLY' as section,
  to_regclass('public.player360_subject_relationships') is not null as relationships_ok,
  to_regclass('public.player360_processing_authorizations') is not null as authorizations_ok,
  to_regclass('public.player360_sensitive_access_requests') is not null as requests_ok,
  to_regclass('public.player360_sensitive_access_grants') is not null as grants_ok,
  to_regclass('public.player360_privacy_audit_log') is not null as audit_ok,
  to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is not null as abac_ok;
