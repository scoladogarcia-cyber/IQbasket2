-- =============================================================================
-- IQBasket V11 - Family Pilot Cohort V1
-- Date: 2026-09-05
-- Purpose:
--   * validate the Family premium value hypothesis without charging;
--   * keep FAMILY_FREE as the effective subscription;
--   * add temporary PLAYER-scoped premium grants that expire automatically;
--   * preserve the future paid-plan and billing architecture untouched.
--
-- Security invariants:
--   * VIEW / ENROLL / REVOKE are explicit actions and currently SUPERADMIN-only;
--   * enrollment requires an existing active GUARDIAN relationship;
--   * pilot never creates a sports-data relationship;
--   * FAMILY_FREE remains the subscription and paid plans remain DRAFT;
--   * no Wellness, Nutrition or AI entitlement is granted;
--   * no direct client access to pilot or commercial tables.
-- =============================================================================

begin;

do $v11$
begin
  if to_regclass('public.saas_billing_accounts') is null
     or to_regclass('public.saas_entitlement_grants') is null
     or to_regclass('public.player360_subject_relationships') is null
     or to_regprocedure('iq_private.family_bootstrap_free_account(uuid,uuid)') is null
     or to_regprocedure('iq_private.account_is_active(uuid)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null then
    raise exception 'FAMILY_PILOT_V1_PREREQUISITES_MISSING';
  end if;
end
$v11$;

create table public.saas_family_pilot_enrollments (
  id uuid primary key default gen_random_uuid(),
  pilot_code text not null default 'FAMILY_VALUE_V1',
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  owner_user_id uuid not null references public.user_profiles(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  status text not null default 'ACTIVE',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  revoked_by uuid null references public.user_profiles(id) on delete set null,
  revoked_at timestamptz null,
  revocation_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_family_pilot_code_check check (pilot_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint saas_family_pilot_status_check check (status in ('ACTIVE','EXPIRED','REVOKED')),
  constraint saas_family_pilot_window_check check (ends_at > starts_at),
  constraint saas_family_pilot_revoke_check check (
    (status='REVOKED' and revoked_at is not null and revoked_by is not null)
    or (status<>'REVOKED')
  )
);

create unique index saas_family_pilot_one_active_per_account_uq
  on public.saas_family_pilot_enrollments(billing_account_id)
  where status='ACTIVE';
create index saas_family_pilot_owner_idx
  on public.saas_family_pilot_enrollments(owner_user_id,created_at desc);
create index saas_family_pilot_player_idx
  on public.saas_family_pilot_enrollments(player_id,created_at desc);

create trigger saas_family_pilot_enrollments_touch
before update on public.saas_family_pilot_enrollments
for each row execute function public.iq_v4_touch_updated_at();

alter table public.saas_family_pilot_enrollments enable row level security;
revoke all on table public.saas_family_pilot_enrollments from public,anon,authenticated;
create policy iq_saas_family_pilot_no_direct_client_access
  on public.saas_family_pilot_enrollments for all to anon,authenticated
  using (false) with check (false);

-- Explicit action boundary. All three actions are SUPERADMIN-only in V1, but the
-- action parameter is stable for a future move to delegated/scoped ABAC.
create or replace function iq_private.saas_can_manage_family_pilot(p_action text)
returns boolean language sql stable security definer set search_path=''
as $function$
  select upper(trim(coalesce(p_action,''))) in ('VIEW','ENROLL','REVOKE')
    and public.iq_v3_is_global_superadmin();
$function$;
revoke all on function iq_private.saas_can_manage_family_pilot(text)
  from public,anon,authenticated;

create or replace function iq_private.saas_family_pilot_guardian_relation(
  p_user_id uuid,p_player_id uuid
)
returns boolean language sql stable security definer set search_path=''
as $function$
  select p_user_id is not null
    and p_player_id is not null
    and iq_private.account_is_active(p_user_id)
    and (
      exists (
        select 1 from public.player360_subject_relationships r
        where r.user_id=p_user_id and r.player_id=p_player_id
          and r.relationship_type='GUARDIAN' and r.status='ACTIVE'
          and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
      )
      or exists (
        select 1 from public.user_profiles up
        where up.id=p_user_id and up.linked_player_id=p_player_id
          and upper(coalesce(up.global_role,up.role,''))='FAMILIA_TUTOR'
      )
    );
$function$;
revoke all on function iq_private.saas_family_pilot_guardian_relation(uuid,uuid)
  from public,anon,authenticated;

create or replace function public.iq_v11_family_pilot_snapshot()
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_candidates jsonb:='[]'::jsonb;
  v_enrollments jsonb:='[]'::jsonb;
  v_active integer:=0;
  v_expired integer:=0;
  v_revoked integer:=0;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.saas_can_manage_family_pilot('VIEW') then
    raise exception 'FAMILY_PILOT_VIEW_DENIED' using errcode='42501';
  end if;

  with explicit_rel as (
    select r.user_id,r.player_id,'VERIFIED_RELATION'::text relationship_source
    from public.player360_subject_relationships r
    where r.relationship_type='GUARDIAN' and r.status='ACTIVE'
      and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
  ), legacy_rel as (
    select up.id user_id,up.linked_player_id player_id,'LEGACY_PROFILE_LINK'::text relationship_source
    from public.user_profiles up
    where up.linked_player_id is not null
      and upper(coalesce(up.global_role,up.role,''))='FAMILIA_TUTOR'
  ), rel as (
    select distinct on (user_id,player_id) user_id,player_id,relationship_source
    from (
      select * from explicit_rel
      union all
      select * from legacy_rel
    ) x
    order by user_id,player_id,
      case relationship_source when 'VERIFIED_RELATION' then 1 else 2 end
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'owner_user_id',r.user_id,
    'owner_name',coalesce(nullif(trim(concat_ws(' ',up.first_name,up.last_name)),''),up.email),
    'owner_email',up.email,
    'player_id',r.player_id,
    'player_name',trim(concat_ws(' ',p.first_name,p.last_name)),
    'relationship_source',r.relationship_source,
    'eligible',true,
    'active_enrollment_id',active_e.id,
    'active_until',active_e.ends_at
  ) order by up.email,p.last_name,p.first_name),'[]'::jsonb)
  into v_candidates
  from rel r
  join public.user_profiles up on up.id=r.user_id
  join public.players p on p.id=r.player_id
  left join lateral (
    select e.id,e.ends_at
    from public.saas_family_pilot_enrollments e
    where e.owner_user_id=r.user_id and e.player_id=r.player_id
      and e.status='ACTIVE' and e.ends_at>now()
    order by e.created_at desc limit 1
  ) active_e on true
  where iq_private.saas_family_pilot_guardian_relation(r.user_id,r.player_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,
    'pilot_code',e.pilot_code,
    'billing_account_id',e.billing_account_id,
    'owner_user_id',e.owner_user_id,
    'owner_name',coalesce(nullif(trim(concat_ws(' ',up.first_name,up.last_name)),''),up.email),
    'owner_email',up.email,
    'player_id',e.player_id,
    'player_name',trim(concat_ws(' ',p.first_name,p.last_name)),
    'status',case when e.status='ACTIVE' and e.ends_at<=now() then 'EXPIRED' else e.status end,
    'starts_at',e.starts_at,
    'ends_at',e.ends_at,
    'revoked_at',e.revoked_at,
    'revocation_reason',e.revocation_reason
  ) order by e.created_at desc),'[]'::jsonb)
  into v_enrollments
  from public.saas_family_pilot_enrollments e
  join public.user_profiles up on up.id=e.owner_user_id
  join public.players p on p.id=e.player_id;

  select
    count(*) filter (where status='ACTIVE' and ends_at>now()),
    count(*) filter (where (status='ACTIVE' and ends_at<=now()) or status='EXPIRED'),
    count(*) filter (where status='REVOKED')
  into v_active,v_expired,v_revoked
  from public.saas_family_pilot_enrollments;

  return jsonb_build_object(
    'pilot_code','FAMILY_VALUE_V1',
    'active_count',coalesce(v_active,0),
    'expired_count',coalesce(v_expired,0),
    'revoked_count',coalesce(v_revoked,0),
    'candidates',v_candidates,
    'enrollments',v_enrollments,
    'sensitive_modules_included',false,
    'ai_included',false
  );
end;
$function$;
revoke all on function public.iq_v11_family_pilot_snapshot() from public,anon;
grant execute on function public.iq_v11_family_pilot_snapshot() to authenticated;

create or replace function public.iq_v11_family_pilot_enroll(
  p_owner_user_id uuid,
  p_player_id uuid,
  p_trial_days integer default 28
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_bootstrap jsonb;
  v_account_id uuid;
  v_plan_code text;
  v_enrollment_id uuid;
  v_existing_id uuid;
  v_existing_end timestamptz;
  v_now timestamptz:=now();
  v_end timestamptz;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.saas_can_manage_family_pilot('ENROLL') then
    raise exception 'FAMILY_PILOT_ENROLL_DENIED' using errcode='42501';
  end if;
  if p_trial_days is null or p_trial_days not in (7,14,28,42,56) then
    raise exception 'FAMILY_PILOT_DURATION_INVALID';
  end if;
  if not iq_private.saas_family_pilot_guardian_relation(p_owner_user_id,p_player_id) then
    raise exception 'FAMILY_PILOT_GUARDIAN_RELATION_REQUIRED' using errcode='42501';
  end if;

  -- Reuse the normal Free onboarding. This does not create a family relationship;
  -- it only materializes commercial Free state after the relationship exists.
  v_bootstrap:=iq_private.family_bootstrap_free_account(p_owner_user_id,p_player_id);
  v_account_id:=nullif(v_bootstrap->>'billing_account_id','')::uuid;
  v_plan_code:=upper(coalesce(v_bootstrap->>'plan_code',''));
  if v_account_id is null or not coalesce((v_bootstrap->>'subject_covered')::boolean,false) then
    raise exception 'FAMILY_PILOT_FREE_ACCOUNT_UNAVAILABLE';
  end if;
  if v_plan_code<>'FAMILY_FREE' then
    raise exception 'FAMILY_PILOT_REQUIRES_FREE_PLAN';
  end if;

  -- Family Free must represent exactly one active player. Fail closed if data is
  -- inconsistent rather than broadening the experiment accidentally.
  if (select count(*) from public.saas_billing_subjects bs
      where bs.billing_account_id=v_account_id and bs.subject_type='PLAYER'
        and bs.status='ACTIVE' and bs.valid_from<=v_now
        and (bs.valid_until is null or bs.valid_until>v_now))<>1 then
    raise exception 'FAMILY_PILOT_FREE_SUBJECT_CARDINALITY_INVALID';
  end if;

  update public.saas_family_pilot_enrollments
  set status='EXPIRED'
  where billing_account_id=v_account_id and status='ACTIVE' and ends_at<=v_now;

  select e.id,e.ends_at into v_existing_id,v_existing_end
  from public.saas_family_pilot_enrollments e
  where e.billing_account_id=v_account_id and e.status='ACTIVE' and e.ends_at>v_now
  order by e.created_at desc limit 1;
  if v_existing_id is not null then
    return jsonb_build_object(
      'success',true,'reason_code','FAMILY_PILOT_ALREADY_ACTIVE',
      'enrollment_id',v_existing_id,'billing_account_id',v_account_id,
      'ends_at',v_existing_end
    );
  end if;

  -- Keep the experiment attributable: explicit account controls and unrelated
  -- active grants for the same player/bundle take precedence and therefore block
  -- enrollment instead of producing a misleading pilot result.
  if exists (
    select 1 from public.saas_entitlement_overrides o
    where o.billing_account_id=v_account_id
      and o.entitlement_code in (
        'ADVANCED_ANALYTICS','PLAYER360','PLAYER_GOALS','DEVELOPMENT_PLAN',
        'TECHNIFICATION','FAMILY_INSIGHTS','REPORT_EXPORT','EXPORT_MONTHLY_UNITS'
      )
      and o.valid_from<=v_now and (o.valid_until is null or o.valid_until>v_now)
  ) then raise exception 'FAMILY_PILOT_ACTIVE_ACCOUNT_OVERRIDE_CONFLICT'; end if;

  if exists (
    select 1 from public.saas_entitlement_grants g
    where g.billing_account_id=v_account_id and g.subject_type='PLAYER'
      and g.player_id=p_player_id and g.status='ACTIVE'
      and g.valid_from<=v_now and g.valid_until>v_now
      and g.source_type<>'FAMILY_PILOT'
      and g.entitlement_code in (
        'ADVANCED_ANALYTICS','PLAYER360','PLAYER_GOALS','DEVELOPMENT_PLAN',
        'TECHNIFICATION','FAMILY_INSIGHTS','REPORT_EXPORT','EXPORT_MONTHLY_UNITS'
      )
  ) then raise exception 'FAMILY_PILOT_ACTIVE_SCOPED_GRANT_CONFLICT'; end if;

  v_end:=v_now+make_interval(days=>p_trial_days);
  insert into public.saas_family_pilot_enrollments(
    pilot_code,billing_account_id,owner_user_id,player_id,status,
    starts_at,ends_at,created_by,metadata
  ) values (
    'FAMILY_VALUE_V1',v_account_id,p_owner_user_id,p_player_id,'ACTIVE',
    v_now,v_end,auth.uid(),
    jsonb_build_object(
      'duration_days',p_trial_days,
      'source','SUPERADMIN_COHORT_V1',
      'grant_scope','PLAYER'
    )
  ) returning id into v_enrollment_id;

  insert into public.saas_entitlement_grants(
    billing_account_id,entitlement_code,subject_type,player_id,beneficiary_scope,
    boolean_value,integer_value,text_value,status,valid_from,valid_until,
    source_type,source_id,reason,created_by
  )
  select v_account_id,code,'PLAYER',p_player_id,'ACCOUNT_MEMBERS',
    true,null::integer,null::text,'ACTIVE',v_now,v_end,
    'FAMILY_PILOT',v_enrollment_id,'FAMILY_PILOT_V1_SCOPED',auth.uid()
  from unnest(array[
    'ADVANCED_ANALYTICS','PLAYER360','PLAYER_GOALS','DEVELOPMENT_PLAN',
    'TECHNIFICATION','FAMILY_INSIGHTS','REPORT_EXPORT'
  ]::text[]) code;

  insert into public.saas_entitlement_grants(
    billing_account_id,entitlement_code,subject_type,player_id,beneficiary_scope,
    boolean_value,integer_value,text_value,status,valid_from,valid_until,
    source_type,source_id,reason,created_by
  ) values (
    v_account_id,'EXPORT_MONTHLY_UNITS','PLAYER',p_player_id,'ACCOUNT_MEMBERS',
    null,20,null,'ACTIVE',v_now,v_end,
    'FAMILY_PILOT',v_enrollment_id,'FAMILY_PILOT_V1_SCOPED',auth.uid()
  );

  return jsonb_build_object(
    'success',true,
    'reason_code','FAMILY_PILOT_ENROLLED',
    'enrollment_id',v_enrollment_id,
    'billing_account_id',v_account_id,
    'owner_user_id',p_owner_user_id,
    'player_id',p_player_id,
    'starts_at',v_now,
    'ends_at',v_end,
    'plan_code','FAMILY_FREE',
    'grant_scope','PLAYER',
    'ai_included',false,
    'sensitive_modules_included',false
  );
end;
$function$;
revoke all on function public.iq_v11_family_pilot_enroll(uuid,uuid,integer)
  from public,anon;
grant execute on function public.iq_v11_family_pilot_enroll(uuid,uuid,integer)
  to authenticated;

create or replace function public.iq_v11_family_pilot_revoke(
  p_enrollment_id uuid,
  p_reason text default null
)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_row public.saas_family_pilot_enrollments%rowtype;
  v_now timestamptz:=now();
  v_reason text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not iq_private.saas_can_manage_family_pilot('REVOKE') then
    raise exception 'FAMILY_PILOT_REVOKE_DENIED' using errcode='42501';
  end if;
  if p_enrollment_id is null then raise exception 'FAMILY_PILOT_ENROLLMENT_REQUIRED'; end if;

  select * into v_row
  from public.saas_family_pilot_enrollments e
  where e.id=p_enrollment_id for update;
  if not found then raise exception 'FAMILY_PILOT_ENROLLMENT_NOT_FOUND'; end if;

  if v_row.status='REVOKED' then
    return jsonb_build_object(
      'success',true,'reason_code','FAMILY_PILOT_ALREADY_REVOKED',
      'enrollment_id',v_row.id,'revoked_at',v_row.revoked_at
    );
  end if;

  if v_row.status='EXPIRED' or v_row.ends_at<=v_now then
    if v_row.status='ACTIVE' then
      update public.saas_family_pilot_enrollments set status='EXPIRED' where id=v_row.id;
    end if;
    return jsonb_build_object(
      'success',true,'reason_code','FAMILY_PILOT_ALREADY_EXPIRED',
      'enrollment_id',v_row.id,'ends_at',v_row.ends_at
    );
  end if;

  v_reason:=left(coalesce(nullif(trim(p_reason),''),'SUPERADMIN_REVOKE'),500);
  update public.saas_family_pilot_enrollments
  set status='REVOKED',revoked_by=auth.uid(),revoked_at=v_now,revocation_reason=v_reason
  where id=v_row.id;

  update public.saas_entitlement_grants
  set status='REVOKED',revoked_by=auth.uid(),revoked_at=v_now
  where source_type='FAMILY_PILOT' and source_id=v_row.id and status='ACTIVE';

  return jsonb_build_object(
    'success',true,'reason_code','FAMILY_PILOT_REVOKED',
    'enrollment_id',v_row.id,'revoked_at',v_now
  );
end;
$function$;
revoke all on function public.iq_v11_family_pilot_revoke(uuid,text)
  from public,anon;
grant execute on function public.iq_v11_family_pilot_revoke(uuid,text)
  to authenticated;

-- Apply-time assertions.
do $verify$
begin
  if not (select relrowsecurity from pg_class where oid='public.saas_family_pilot_enrollments'::regclass) then
    raise exception 'FAMILY_PILOT_RLS_NOT_ENABLED';
  end if;
  if has_table_privilege('anon','public.saas_family_pilot_enrollments','SELECT')
     or has_table_privilege('authenticated','public.saas_family_pilot_enrollments','SELECT')
     or has_table_privilege('authenticated','public.saas_family_pilot_enrollments','INSERT')
     or has_table_privilege('authenticated','public.saas_family_pilot_enrollments','UPDATE') then
    raise exception 'FAMILY_PILOT_DIRECT_TABLE_ACCESS_OPEN';
  end if;
  if has_function_privilege('authenticated','iq_private.saas_can_manage_family_pilot(text)','EXECUTE')
     or has_function_privilege('authenticated','iq_private.saas_family_pilot_guardian_relation(uuid,uuid)','EXECUTE') then
    raise exception 'FAMILY_PILOT_PRIVATE_HELPER_EXPOSED';
  end if;
  if has_function_privilege('anon','public.iq_v11_family_pilot_snapshot()','EXECUTE')
     or has_function_privilege('anon','public.iq_v11_family_pilot_enroll(uuid,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.iq_v11_family_pilot_revoke(uuid,text)','EXECUTE') then
    raise exception 'FAMILY_PILOT_ANON_RPC_OPEN';
  end if;
  if not has_function_privilege('authenticated','public.iq_v11_family_pilot_snapshot()','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v11_family_pilot_enroll(uuid,uuid,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.iq_v11_family_pilot_revoke(uuid,text)','EXECUTE') then
    raise exception 'FAMILY_PILOT_AUTH_RPC_MISSING';
  end if;
  if exists (
    select 1 from public.saas_entitlement_grants g
    where g.source_type='FAMILY_PILOT'
      and g.entitlement_code in ('WELLNESS','NUTRITION_RECOVERY','AI_INSIGHTS','AI_WEEKLY_PLAN')
  ) then raise exception 'FAMILY_PILOT_SENSITIVE_OR_AI_GRANT_PRESENT'; end if;
  if exists (
    select 1 from public.saas_plans
    where code in ('FAMILY','FAMILY_PRO') and status<>'DRAFT'
  ) then raise exception 'FAMILY_PAID_PLAN_ACTIVATED_BY_PILOT'; end if;
end
$verify$;

commit;

select
  'FAMILY_PILOT_COHORT_V1' as section,
  to_regclass('public.saas_family_pilot_enrollments') is not null as enrollment_table_ok,
  to_regprocedure('public.iq_v11_family_pilot_snapshot()') is not null as snapshot_ok,
  to_regprocedure('public.iq_v11_family_pilot_enroll(uuid,uuid,integer)') is not null as enroll_ok,
  to_regprocedure('public.iq_v11_family_pilot_revoke(uuid,text)') is not null as revoke_ok;
