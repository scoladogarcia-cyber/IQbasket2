-- =============================================================================
-- IQBasket V11.1 - Scoped entitlement grants for Family Pilot
-- Date: 2026-09-05
-- Purpose:
--   * prevent a temporary Family pilot from unlocking every subject in an account;
--   * introduce a reusable entitlement-grant primitive scoped to PLAYER/TEAM/CLUB;
--   * keep explicit account overrides authoritative over grants;
--   * migrate/remove any V11 pilot account overrides safely.
-- =============================================================================

begin;

do $v11_1$
begin
  if to_regclass('public.saas_family_pilot_enrollments') is null
     or to_regclass('public.saas_entitlement_overrides') is null
     or to_regprocedure('iq_private.saas_validate_entitlement_value()') is null
     or to_regprocedure('iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)') is null then
    raise exception 'FAMILY_PILOT_SCOPED_GRANT_PREREQUISITES_MISSING';
  end if;
end
$v11_1$;

create table if not exists public.saas_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  entitlement_code text not null references public.saas_entitlement_catalog(code) on delete cascade,
  subject_type text not null,
  player_id uuid null references public.players(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete cascade,
  club_id uuid null references public.clubs(id) on delete cascade,
  beneficiary_scope text not null,
  boolean_value boolean null,
  integer_value integer null,
  text_value text null,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  source_type text not null,
  source_id uuid null,
  reason text null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  revoked_by uuid null references public.user_profiles(id) on delete set null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_grant_subject_type_check check (subject_type in ('PLAYER','TEAM','CLUB')),
  constraint saas_grant_subject_shape_check check (
    (subject_type='PLAYER' and player_id is not null and team_id is null and club_id is null)
    or (subject_type='TEAM' and player_id is null and team_id is not null and club_id is null)
    or (subject_type='CLUB' and player_id is null and team_id is null and club_id is not null)
  ),
  constraint saas_grant_beneficiary_check check (
    beneficiary_scope in ('ACCOUNT_MEMBERS','AUTHORIZED_STAFF','ALL_AUTHORIZED')
  ),
  constraint saas_grant_status_check check (status in ('ACTIVE','REVOKED')),
  constraint saas_grant_window_check check (valid_until > valid_from),
  constraint saas_grant_integer_check check (integer_value is null or integer_value>=0),
  constraint saas_grant_source_check check (source_type in ('FAMILY_PILOT','PROMOTION','MANUAL','INTERNAL')),
  constraint saas_grant_revoke_check check (
    (status='REVOKED' and revoked_at is not null)
    or (status='ACTIVE' and revoked_at is null)
  )
);

create unique index if not exists saas_entitlement_grant_source_uq
  on public.saas_entitlement_grants(source_type,source_id,entitlement_code)
  where source_id is not null;
create index if not exists saas_entitlement_grant_account_idx
  on public.saas_entitlement_grants(billing_account_id,status,valid_until);
create index if not exists saas_entitlement_grant_player_idx
  on public.saas_entitlement_grants(player_id,entitlement_code,status,valid_until)
  where subject_type='PLAYER';

alter table public.saas_entitlement_grants enable row level security;
revoke all on table public.saas_entitlement_grants from public,anon,authenticated;
drop policy if exists iq_saas_entitlement_grants_no_direct_client_access
  on public.saas_entitlement_grants;
create policy iq_saas_entitlement_grants_no_direct_client_access
  on public.saas_entitlement_grants for all to anon,authenticated
  using (false) with check (false);

drop trigger if exists saas_validate_entitlement_grant on public.saas_entitlement_grants;
create trigger saas_validate_entitlement_grant before insert or update
  on public.saas_entitlement_grants for each row
  execute function iq_private.saas_validate_entitlement_value();
drop trigger if exists saas_entitlement_grant_touch on public.saas_entitlement_grants;
create trigger saas_entitlement_grant_touch before update
  on public.saas_entitlement_grants for each row
  execute function iq_private.saas_touch_updated_at();

-- Resolver precedence is deliberate:
-- ACCOUNT OVERRIDE > RESOURCE-SCOPED GRANT > PLAN.
-- A promotion can add value but can never bypass an explicit account override.
create or replace function iq_private.saas_effective_entitlement_for_user(
  p_user_id uuid,p_subject_type text,p_subject_id uuid,p_team_season_id uuid,p_entitlement_code text
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_code text:=upper(trim(coalesce(p_entitlement_code,'')));
  v_subject_type text:=upper(trim(coalesce(p_subject_type,'')));
  v_catalog public.saas_entitlement_catalog%rowtype;
  v_result record;
begin
  if not iq_private.saas_user_can_access_subject(
    p_user_id,p_subject_type,p_subject_id,p_team_season_id
  ) then
    raise exception 'SAAS_SUBJECT_ACCESS_DENIED' using errcode='42501';
  end if;

  select * into v_catalog from public.saas_entitlement_catalog c
  where c.code=v_code and c.is_active;
  if v_catalog.code is null then
    return jsonb_build_object(
      'known',false,'allowed',false,'entitlement_code',v_code,'reason_code','ENTITLEMENT_UNKNOWN'
    );
  end if;

  with candidates as (
    select a.id billing_account_id,a.account_type,p.code plan_code,
      coalesce(g.subject_type,bs.subject_type) source_subject_type,
      coalesce(o.beneficiary_scope,g.beneficiary_scope,pe.beneficiary_scope) beneficiary_scope,
      coalesce(o.boolean_value,g.boolean_value,pe.boolean_value) boolean_value,
      coalesce(o.integer_value,g.integer_value,pe.integer_value) integer_value,
      coalesce(o.text_value,g.text_value,pe.text_value) text_value,
      case
        when o.entitlement_code is not null then 'ACCOUNT_OVERRIDE'
        when g.id is not null then 'SCOPED_GRANT'
        else 'PLAN'
      end entitlement_source,
      case when o.entitlement_code is null then g.source_type else null end grant_source_type,
      case when o.entitlement_code is null then g.valid_until else null end grant_valid_until,
      case bs.subject_type when 'PLAYER' then 30 when 'TEAM' then 20 else 10 end specificity
    from public.saas_subscriptions s
    join public.saas_billing_accounts a on a.id=s.billing_account_id
    join public.saas_plans p on p.id=s.plan_id
    join public.saas_billing_subjects bs on bs.billing_account_id=a.id
    left join public.saas_plan_entitlements pe
      on pe.plan_id=p.id and pe.entitlement_code=v_code
    left join public.saas_entitlement_overrides o
      on o.billing_account_id=a.id and o.entitlement_code=v_code
      and o.valid_from<=now() and (o.valid_until is null or o.valid_until>now())
    left join lateral (
      select grant.*
      from public.saas_entitlement_grants grant
      where grant.billing_account_id=a.id
        and grant.entitlement_code=v_code
        and grant.status='ACTIVE'
        and grant.valid_from<=now() and grant.valid_until>now()
        and (
          (v_subject_type='PLAYER' and grant.subject_type='PLAYER' and grant.player_id=p_subject_id)
          or (v_subject_type='TEAM' and grant.subject_type='TEAM' and grant.team_id=p_subject_id)
          or (v_subject_type='CLUB' and grant.subject_type='CLUB' and grant.club_id=p_subject_id)
        )
      order by grant.valid_from desc,grant.created_at desc
      limit 1
    ) g on true
    where iq_private.saas_subscription_effective(s.id)
      and (pe.entitlement_code is not null or o.entitlement_code is not null or g.id is not null)
      and iq_private.saas_subject_covers(bs.id,p_subject_type,p_subject_id,p_team_season_id)
      and case coalesce(o.beneficiary_scope,g.beneficiary_scope,pe.beneficiary_scope)
        when 'ACCOUNT_MEMBERS' then iq_private.saas_account_member(a.id,p_user_id)
        when 'AUTHORIZED_STAFF' then iq_private.saas_user_is_staff(
          p_user_id,p_subject_type,p_subject_id,p_team_season_id
        )
        when 'ALL_AUTHORIZED' then true
        else false
      end
  )
  select * into v_result from candidates c
  order by
    case v_catalog.value_type
      when 'BOOLEAN' then case when coalesce(c.boolean_value,false) then 1 else 0 end
      when 'INTEGER' then coalesce(c.integer_value,0)
      when 'TEXT' then case when nullif(trim(coalesce(c.text_value,'')),'') is not null then 1 else 0 end
      else 0
    end desc,
    c.specificity desc,
    case c.account_type when 'FAMILY' then 5 when 'TEAM' then 4 when 'CLUB' then 3 when 'ACADEMY' then 2 else 1 end desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'known',true,'allowed',false,'entitlement_code',v_code,
      'value_type',v_catalog.value_type,'reason_code','ENTITLEMENT_NOT_INCLUDED'
    );
  end if;

  return jsonb_build_object(
    'known',true,'entitlement_code',v_code,'value_type',v_catalog.value_type,
    'billing_account_id',v_result.billing_account_id,'account_type',v_result.account_type,
    'plan_code',v_result.plan_code,'beneficiary_scope',v_result.beneficiary_scope,
    'source_subject_type',v_result.source_subject_type,
    'entitlement_source',v_result.entitlement_source,
    'grant_source_type',v_result.grant_source_type,
    'grant_valid_until',v_result.grant_valid_until,
    'boolean_value',v_result.boolean_value,'integer_value',v_result.integer_value,
    'text_value',v_result.text_value
  );
end;
$function$;
revoke all on function iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)
  from public,anon,authenticated;

-- Migrate any V11 pilot still active at the moment this hardening is applied.
insert into public.saas_entitlement_grants(
  billing_account_id,entitlement_code,subject_type,player_id,beneficiary_scope,
  boolean_value,integer_value,text_value,status,valid_from,valid_until,
  source_type,source_id,reason,created_by
)
select
  e.billing_account_id,o.entitlement_code,'PLAYER',e.player_id,o.beneficiary_scope,
  o.boolean_value,o.integer_value,o.text_value,'ACTIVE',
  greatest(o.valid_from,e.starts_at),least(o.valid_until,e.ends_at),
  'FAMILY_PILOT',e.id,'FAMILY_PILOT_V1_SCOPED',coalesce(o.created_by,e.created_by)
from public.saas_family_pilot_enrollments e
join public.saas_entitlement_overrides o
  on o.billing_account_id=e.billing_account_id
 and o.source='PROMOTION'
 and o.reason='FAMILY_PILOT_V1:' || e.id::text
where e.status='ACTIVE' and e.ends_at>now()
  and o.valid_until>greatest(o.valid_from,e.starts_at)
on conflict (source_type,source_id,entitlement_code) where source_id is not null
  do nothing;

delete from public.saas_entitlement_overrides
where source='PROMOTION' and coalesce(reason,'') like 'FAMILY_PILOT_V1:%';

create or replace function public.iq_v11_family_pilot_enroll(
  p_owner_user_id uuid,
  p_player_id uuid,
  p_trial_days integer default 28
)
returns jsonb
language plpgsql volatile security definer set search_path=''
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

  v_bootstrap:=iq_private.family_bootstrap_free_account(p_owner_user_id,p_player_id);
  v_account_id:=nullif(v_bootstrap->>'billing_account_id','')::uuid;
  v_plan_code:=upper(coalesce(v_bootstrap->>'plan_code',''));

  if v_account_id is null or not coalesce((v_bootstrap->>'subject_covered')::boolean,false) then
    raise exception 'FAMILY_PILOT_FREE_ACCOUNT_UNAVAILABLE';
  end if;
  if v_plan_code<>'FAMILY_FREE' then
    raise exception 'FAMILY_PILOT_REQUIRES_FREE_PLAN';
  end if;

  -- FAMILY_FREE is one-player by contract. Refuse a corrupted/misconfigured
  -- account rather than letting an account-level ambiguity enter the pilot.
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
      'enrollment_id',v_existing_id,'billing_account_id',v_account_id,'ends_at',v_existing_end
    );
  end if;

  if exists (
    select 1 from public.saas_entitlement_overrides o
    where o.billing_account_id=v_account_id
      and o.entitlement_code in (
        'ADVANCED_ANALYTICS','PLAYER360','PLAYER_GOALS','DEVELOPMENT_PLAN',
        'TECHNIFICATION','FAMILY_INSIGHTS','REPORT_EXPORT','EXPORT_MONTHLY_UNITS'
      )
      and o.valid_from<=v_now and (o.valid_until is null or o.valid_until>v_now)
  ) then raise exception 'FAMILY_PILOT_ACTIVE_ACCOUNT_OVERRIDE_CONFLICT'; end if;

  v_end:=v_now+make_interval(days=>p_trial_days);
  insert into public.saas_family_pilot_enrollments(
    pilot_code,billing_account_id,owner_user_id,player_id,status,
    starts_at,ends_at,created_by,metadata
  ) values (
    'FAMILY_VALUE_V1',v_account_id,p_owner_user_id,p_player_id,'ACTIVE',
    v_now,v_end,auth.uid(),
    jsonb_build_object('duration_days',p_trial_days,'source','SUPERADMIN_COHORT_V1','grant_scope','PLAYER')
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
    'success',true,'reason_code','FAMILY_PILOT_ENROLLED',
    'enrollment_id',v_enrollment_id,'billing_account_id',v_account_id,
    'owner_user_id',p_owner_user_id,'player_id',p_player_id,
    'starts_at',v_now,'ends_at',v_end,'plan_code','FAMILY_FREE',
    'grant_scope','PLAYER','ai_included',false,'sensitive_modules_included',false
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
returns jsonb
language plpgsql volatile security definer set search_path=''
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

  select * into v_row from public.saas_family_pilot_enrollments e
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

-- Security/product invariants.
do $verify$
begin
  if not (select relrowsecurity from pg_class where oid='public.saas_entitlement_grants'::regclass) then
    raise exception 'SAAS_SCOPED_GRANTS_RLS_NOT_ENABLED';
  end if;
  if has_table_privilege('anon','public.saas_entitlement_grants','SELECT')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','SELECT')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','INSERT')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','UPDATE') then
    raise exception 'SAAS_SCOPED_GRANTS_DIRECT_CLIENT_ACCESS_OPEN';
  end if;
  if has_function_privilege(
    'authenticated','iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)','EXECUTE'
  ) then raise exception 'SAAS_SCOPED_GRANTS_RESOLVER_EXPOSED'; end if;
  if exists (
    select 1 from public.saas_entitlement_overrides
    where source='PROMOTION' and coalesce(reason,'') like 'FAMILY_PILOT_V1:%'
  ) then raise exception 'FAMILY_PILOT_ACCOUNT_OVERRIDE_REMAINS'; end if;
  if exists (
    select 1 from public.saas_entitlement_grants g
    where g.source_type='FAMILY_PILOT'
      and g.entitlement_code in ('WELLNESS','NUTRITION_RECOVERY','AI_INSIGHTS','AI_WEEKLY_PLAN')
  ) then raise exception 'FAMILY_PILOT_SENSITIVE_OR_AI_GRANT_PRESENT'; end if;
  if exists (
    select 1 from public.saas_plans
    where code in ('FAMILY','FAMILY_PRO') and status<>'DRAFT'
  ) then raise exception 'FAMILY_PAID_PLAN_ACTIVATED_BY_SCOPED_GRANT'; end if;
end
$verify$;

commit;

select
  'FAMILY_PILOT_SCOPED_GRANTS_V1' as section,
  to_regclass('public.saas_entitlement_grants') is not null as grant_table_ok,
  to_regprocedure('public.iq_v11_family_pilot_enroll(uuid,uuid,integer)') is not null as enroll_ok,
  to_regprocedure('public.iq_v11_family_pilot_revoke(uuid,text)') is not null as revoke_ok;
