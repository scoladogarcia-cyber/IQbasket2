-- =============================================================================
-- IQBasket SaaS - Resource-scoped Entitlement Grants V1
-- Date: 2026-09-05
-- Purpose:
--   * add temporary/manual capabilities scoped to one PLAYER, TEAM or CLUB;
--   * preserve plan entitlements as the commercial baseline;
--   * preserve account overrides as the highest-priority operational control;
--   * provide a provider-neutral primitive for pilots, promotions and sponsorships.
--
-- Precedence within an eligible billing account:
--   ACCOUNT OVERRIDE > RESOURCE-SCOPED GRANT > PLAN.
--
-- Security invariants:
--   * a grant never creates sports/privacy access;
--   * an effective subscription and billing-subject coverage remain mandatory;
--   * no direct anon/authenticated table access;
--   * the internal resolver remains inaccessible to authenticated clients.
-- =============================================================================

begin;

do $grant_prereq$
begin
  if to_regclass('public.saas_billing_accounts') is null
     or to_regclass('public.saas_entitlement_catalog') is null
     or to_regclass('public.saas_entitlement_overrides') is null
     or to_regprocedure('iq_private.saas_validate_entitlement_value()') is null
     or to_regprocedure('iq_private.saas_touch_updated_at()') is null
     or to_regprocedure('iq_private.saas_subscription_effective(uuid)') is null
     or to_regprocedure('iq_private.saas_user_can_access_subject(uuid,text,uuid,uuid)') is null
     or to_regprocedure('iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)') is null then
    raise exception 'SAAS_SCOPED_GRANT_PREREQUISITES_MISSING';
  end if;
end
$grant_prereq$;

create table public.saas_entitlement_grants (
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
  constraint saas_grant_source_check check (
    source_type in ('FAMILY_PILOT','PROMOTION','MANUAL','INTERNAL')
  ),
  constraint saas_grant_revoke_check check (
    (status='REVOKED' and revoked_at is not null)
    or (status='ACTIVE' and revoked_at is null)
  )
);

create unique index saas_entitlement_grant_source_uq
  on public.saas_entitlement_grants(source_type,source_id,entitlement_code)
  where source_id is not null;
create index saas_entitlement_grant_account_idx
  on public.saas_entitlement_grants(billing_account_id,status,valid_until);
create index saas_entitlement_grant_player_idx
  on public.saas_entitlement_grants(player_id,entitlement_code,status,valid_until)
  where subject_type='PLAYER';
create index saas_entitlement_grant_team_idx
  on public.saas_entitlement_grants(team_id,entitlement_code,status,valid_until)
  where subject_type='TEAM';
create index saas_entitlement_grant_club_idx
  on public.saas_entitlement_grants(club_id,entitlement_code,status,valid_until)
  where subject_type='CLUB';

alter table public.saas_entitlement_grants enable row level security;
revoke all on table public.saas_entitlement_grants from public,anon,authenticated;
create policy iq_saas_entitlement_grants_no_direct_client_access
  on public.saas_entitlement_grants for all to anon,authenticated
  using (false) with check (false);

create trigger saas_validate_entitlement_grant before insert or update
  on public.saas_entitlement_grants for each row
  execute function iq_private.saas_validate_entitlement_value();
create trigger saas_entitlement_grant_touch before update
  on public.saas_entitlement_grants for each row
  execute function iq_private.saas_touch_updated_at();

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
  -- Commercial state never creates authorization to the sports subject.
  if not iq_private.saas_user_can_access_subject(
    p_user_id,p_subject_type,p_subject_id,p_team_season_id
  ) then
    raise exception 'SAAS_SUBJECT_ACCESS_DENIED' using errcode='42501';
  end if;

  select * into v_catalog
  from public.saas_entitlement_catalog c
  where c.code=v_code and c.is_active;
  if v_catalog.code is null then
    return jsonb_build_object(
      'known',false,'allowed',false,'entitlement_code',v_code,
      'reason_code','ENTITLEMENT_UNKNOWN'
    );
  end if;

  with candidates as (
    select
      a.id billing_account_id,
      a.account_type,
      p.code plan_code,
      case
        when o.entitlement_code is not null then bs.subject_type
        when g.id is not null then g.subject_type
        else bs.subject_type
      end source_subject_type,
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
      select sg.*
      from public.saas_entitlement_grants sg
      where sg.billing_account_id=a.id
        and sg.entitlement_code=v_code
        and sg.status='ACTIVE'
        and sg.valid_from<=now() and sg.valid_until>now()
        and (
          (v_subject_type='PLAYER' and sg.subject_type='PLAYER' and sg.player_id=p_subject_id)
          or (v_subject_type='TEAM' and sg.subject_type='TEAM' and sg.team_id=p_subject_id)
          or (v_subject_type='CLUB' and sg.subject_type='CLUB' and sg.club_id=p_subject_id)
        )
      order by sg.valid_from desc,sg.created_at desc
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
  select * into v_result
  from candidates c
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
    'known',true,
    'entitlement_code',v_code,
    'value_type',v_catalog.value_type,
    'billing_account_id',v_result.billing_account_id,
    'account_type',v_result.account_type,
    'plan_code',v_result.plan_code,
    'beneficiary_scope',v_result.beneficiary_scope,
    'source_subject_type',v_result.source_subject_type,
    'entitlement_source',v_result.entitlement_source,
    'grant_source_type',v_result.grant_source_type,
    'grant_valid_until',v_result.grant_valid_until,
    'boolean_value',v_result.boolean_value,
    'integer_value',v_result.integer_value,
    'text_value',v_result.text_value
  );
end;
$function$;
revoke all on function iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)
  from public,anon,authenticated;

-- Security invariants.
do $grant_verify$
begin
  if not (select relrowsecurity from pg_class where oid='public.saas_entitlement_grants'::regclass) then
    raise exception 'SAAS_SCOPED_GRANTS_RLS_NOT_ENABLED';
  end if;
  if has_table_privilege('anon','public.saas_entitlement_grants','SELECT')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','SELECT')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','INSERT')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','UPDATE')
     or has_table_privilege('authenticated','public.saas_entitlement_grants','DELETE') then
    raise exception 'SAAS_SCOPED_GRANTS_DIRECT_CLIENT_ACCESS_OPEN';
  end if;
  if has_function_privilege(
    'authenticated',
    'iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)',
    'EXECUTE'
  ) then raise exception 'SAAS_SCOPED_GRANTS_RESOLVER_EXPOSED'; end if;
end
$grant_verify$;

commit;

select
  'SAAS_SCOPED_ENTITLEMENT_GRANTS_V1' as section,
  to_regclass('public.saas_entitlement_grants') is not null as table_ok,
  to_regprocedure('iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)') is not null as resolver_ok;
