-- IQBasket SaaS Entitlements V1 - family-first commercial foundation.
-- Additive only: this migration does not gate any existing product route.
begin;

create table public.saas_entitlement_catalog (
  code text primary key,
  name text not null,
  description text null,
  category text not null default 'CORE',
  value_type text not null,
  default_boolean boolean null,
  default_integer integer null,
  default_text text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_entitlement_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint saas_entitlement_type_check check (value_type in ('BOOLEAN','INTEGER','TEXT')),
  constraint saas_entitlement_integer_check check (default_integer is null or default_integer >= 0)
);

create table public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null,
  status text not null default 'DRAFT',
  is_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_plan_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint saas_plan_account_type_check check (
    account_type in ('FAMILY','TEAM','CLUB','ACADEMY','INTERNAL')
  ),
  constraint saas_plan_status_check check (status in ('DRAFT','ACTIVE','ARCHIVED'))
);

create table public.saas_plan_entitlements (
  plan_id uuid not null references public.saas_plans(id) on delete cascade,
  entitlement_code text not null references public.saas_entitlement_catalog(code) on delete cascade,
  beneficiary_scope text not null,
  boolean_value boolean null,
  integer_value integer null,
  text_value text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, entitlement_code),
  constraint saas_plan_beneficiary_check check (
    beneficiary_scope in ('ACCOUNT_MEMBERS','AUTHORIZED_STAFF','ALL_AUTHORIZED')
  ),
  constraint saas_plan_entitlement_integer_check check (integer_value is null or integer_value >= 0)
);
create table public.saas_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  account_type text not null,
  display_name text not null,
  owner_user_id uuid null references public.user_profiles(id) on delete set null,
  status text not null default 'ACTIVE',
  source text not null default 'MANUAL',
  external_customer_ref text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_billing_account_type_check check (
    account_type in ('FAMILY','TEAM','CLUB','ACADEMY','INTERNAL')
  ),
  constraint saas_billing_account_status_check check (status in ('ACTIVE','SUSPENDED','CLOSED')),
  constraint saas_family_owner_check check (account_type<>'FAMILY' or owner_user_id is not null),
  constraint saas_billing_account_source_check check (
    source in ('MANUAL','MIGRATION','BILLING','PROMOTION','DEMO','INTERNAL')
  )
);

create table public.saas_billing_account_members (
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  member_role text not null default 'MEMBER',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (billing_account_id,user_id),
  constraint saas_billing_member_role_check check (
    member_role in ('OWNER','ADMIN','BILLING','MEMBER')
  ),
  constraint saas_billing_member_status_check check (status in ('ACTIVE','INVITED','REVOKED'))
);

create or replace function iq_private.saas_sync_billing_owner()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if tg_op='UPDATE' and old.owner_user_id is distinct from new.owner_user_id and old.owner_user_id is not null then
    update public.saas_billing_account_members set member_role='MEMBER',updated_at=now()
    where billing_account_id=new.id and user_id=old.owner_user_id and member_role='OWNER';
  end if;
  if new.owner_user_id is not null then
    insert into public.saas_billing_account_members(billing_account_id,user_id,member_role,status)
    values(new.id,new.owner_user_id,'OWNER','ACTIVE')
    on conflict (billing_account_id,user_id) do update set member_role='OWNER',status='ACTIVE',updated_at=now();
  end if;
  return new;
end;
$function$;
revoke all on function iq_private.saas_sync_billing_owner() from public,anon,authenticated;
create trigger saas_sync_billing_owner after insert or update of owner_user_id on public.saas_billing_accounts
for each row execute function iq_private.saas_sync_billing_owner();

create table public.saas_billing_subjects (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  subject_type text not null,
  player_id uuid null references public.players(id) on delete cascade,
  team_id uuid null references public.teams(id) on delete cascade,
  club_id uuid null references public.clubs(id) on delete cascade,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_until timestamptz null,
  source text not null default 'MANUAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_billing_subject_type_check check (subject_type in ('PLAYER','TEAM','CLUB')),
  constraint saas_billing_subject_status_check check (status in ('ACTIVE','INACTIVE')),
  constraint saas_billing_subject_window_check check (valid_until is null or valid_until > valid_from),
  constraint saas_billing_subject_shape_check check (
    (subject_type='PLAYER' and player_id is not null and team_id is null and club_id is null)
    or (subject_type='TEAM' and player_id is null and team_id is not null and club_id is null)
    or (subject_type='CLUB' and player_id is null and team_id is null and club_id is not null)
  )
);

create or replace function iq_private.saas_validate_billing_subject()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_account_type text;
begin
  select a.account_type into v_account_type from public.saas_billing_accounts a where a.id=new.billing_account_id;
  if v_account_type='FAMILY' and new.subject_type<>'PLAYER' then raise exception 'SAAS_FAMILY_PLAYER_SUBJECT_REQUIRED'; end if;
  if v_account_type='TEAM' and new.subject_type<>'TEAM' then raise exception 'SAAS_TEAM_SUBJECT_REQUIRED'; end if;
  if v_account_type in ('CLUB','ACADEMY') and new.subject_type<>'CLUB' then raise exception 'SAAS_CLUB_SUBJECT_REQUIRED'; end if;
  return new;
end;
$function$;
revoke all on function iq_private.saas_validate_billing_subject() from public,anon,authenticated;
create trigger saas_validate_billing_subject before insert or update on public.saas_billing_subjects
for each row execute function iq_private.saas_validate_billing_subject();

create unique index saas_billing_subject_player_uq
  on public.saas_billing_subjects(billing_account_id,player_id)
  where subject_type='PLAYER';
create unique index saas_billing_subject_team_uq
  on public.saas_billing_subjects(billing_account_id,team_id)
  where subject_type='TEAM';
create unique index saas_billing_subject_club_uq
  on public.saas_billing_subjects(billing_account_id,club_id)
  where subject_type='CLUB';

create table public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id),
  status text not null default 'ACTIVE',
  starts_at timestamptz not null default now(),
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  trial_ends_at timestamptz null,
  grace_ends_at timestamptz null,
  source text not null default 'MANUAL',
  external_subscription_ref text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saas_subscription_status_check check (
    status in ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED','CANCELLED')
  ),
  constraint saas_subscription_source_check check (
    source in ('MANUAL','MIGRATION','BILLING','PROMOTION','DEMO','INTERNAL')
  ),
  constraint saas_subscription_period_check check (
    current_period_end is null or current_period_start is null
    or current_period_end >= current_period_start
  ),
  constraint saas_subscription_trial_check check (status <> 'TRIAL' or trial_ends_at is not null),
  constraint saas_subscription_grace_check check (status <> 'GRACE' or grace_ends_at is not null)
);

create or replace function iq_private.saas_validate_subscription_plan()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_account_type text; v_plan_type text;
begin
  select a.account_type into v_account_type from public.saas_billing_accounts a where a.id=new.billing_account_id;
  select p.account_type into v_plan_type from public.saas_plans p where p.id=new.plan_id;
  if v_account_type is null or v_plan_type is null or v_account_type<>v_plan_type then
    raise exception 'SAAS_SUBSCRIPTION_PLAN_ACCOUNT_TYPE_MISMATCH';
  end if;
  return new;
end;
$function$;
revoke all on function iq_private.saas_validate_subscription_plan() from public,anon,authenticated;
create trigger saas_validate_subscription_plan before insert or update on public.saas_subscriptions
for each row execute function iq_private.saas_validate_subscription_plan();

create unique index saas_one_live_subscription_per_account
  on public.saas_subscriptions(billing_account_id)
  where status in ('TRIAL','ACTIVE','PAST_DUE','GRACE','SUSPENDED');

create table public.saas_entitlement_overrides (
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  entitlement_code text not null references public.saas_entitlement_catalog(code) on delete cascade,
  beneficiary_scope text not null,
  boolean_value boolean null,
  integer_value integer null,
  text_value text null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz null,
  reason text null,
  source text not null default 'MANUAL',
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (billing_account_id,entitlement_code),
  constraint saas_override_beneficiary_check check (
    beneficiary_scope in ('ACCOUNT_MEMBERS','AUTHORIZED_STAFF','ALL_AUTHORIZED')
  ),
  constraint saas_override_integer_check check (integer_value is null or integer_value >= 0),
  constraint saas_override_window_check check (valid_until is null or valid_until > valid_from)
);

create table public.saas_subscription_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid null references public.saas_subscriptions(id) on delete set null,
  billing_account_id uuid not null references public.saas_billing_accounts(id) on delete cascade,
  plan_id uuid null references public.saas_plans(id) on delete set null,
  status text not null,
  snapshot jsonb not null default '{}'::jsonb,
  reason text null,
  changed_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index saas_billing_member_user_idx
  on public.saas_billing_account_members(user_id,status);
create index saas_billing_subject_lookup_idx
  on public.saas_billing_subjects(subject_type,status,player_id,team_id,club_id);
create index saas_subscription_account_idx
  on public.saas_subscriptions(billing_account_id,status,current_period_end);
create index saas_subscription_history_idx
  on public.saas_subscription_history(billing_account_id,created_at desc);

-- Commercial tables are backend-owned. Browser access goes through checked RPCs.
do $block$
declare r text;
begin
  foreach r in array array[
    'saas_entitlement_catalog','saas_plans','saas_plan_entitlements',
    'saas_billing_accounts','saas_billing_account_members','saas_billing_subjects',
    'saas_subscriptions','saas_entitlement_overrides','saas_subscription_history'
  ] loop
    execute format('alter table public.%I enable row level security',r);
    execute format('revoke all on table public.%I from public,anon,authenticated',r);
    execute format(
      'create policy iq_saas_no_direct_client_access on public.%I for all to anon,authenticated using (false) with check (false)',r
    );
  end loop;
end
$block$;

insert into public.saas_entitlement_catalog(
  code,name,description,category,value_type,default_boolean,default_integer,default_text
) values
  ('PLAYER_PROFILE','Player profile','Longitudinal identity and basic player profile.','FAMILY','BOOLEAN',false,null,null),
  ('GAME_HISTORY','Game history','Games and historical participation for the player.','FAMILY','BOOLEAN',false,null,null),
  ('BASIC_STATS','Basic stats','Essential player and game statistics.','FAMILY','BOOLEAN',false,null,null),
  ('BASIC_TIMELINE','Basic timeline','Basic evolution timeline.','FAMILY','BOOLEAN',false,null,null),
  ('ADVANCED_ANALYTICS','Advanced analytics','Advanced metrics, comparisons and trends.','ANALYTICS','BOOLEAN',false,null,null),
  ('PLAYER360','Player 360','Integrated longitudinal player view.','ANALYTICS','BOOLEAN',false,null,null),
  ('PLAYER_GOALS','Player goals','Development objectives and follow-up.','DEVELOPMENT','BOOLEAN',false,null,null),
  ('DEVELOPMENT_PLAN','Development plan','Structured player development plan.','DEVELOPMENT','BOOLEAN',false,null,null),
  ('TECHNIFICATION','Technification','Individual and external development tracking.','DEVELOPMENT','BOOLEAN',false,null,null),
  ('FAMILY_INSIGHTS','Family insights','Family-oriented interpretation of progress.','FAMILY','BOOLEAN',false,null,null),
  ('REPORT_EXPORT','Report export','Premium export of reports.','REPORTING','BOOLEAN',false,null,null),
  ('WELLNESS','Wellness','Wellness and readiness tracking subject to privacy rules.','SENSITIVE','BOOLEAN',false,null,null),
  ('NUTRITION_RECOVERY','Nutrition and recovery','Sensitive nutrition/recovery module subject to ABAC.','SENSITIVE','BOOLEAN',false,null,null),
  ('PRIVACY_CENTER','Privacy center','Consent, access and sensitive-data governance.','GOVERNANCE','BOOLEAN',false,null,null),
  ('AI_INSIGHTS','AI insights','Evidence-governed AI interpretation.','AI','BOOLEAN',false,null,null),
  ('AI_WEEKLY_PLAN','AI weekly plan','Action-oriented weekly development plan.','AI','BOOLEAN',false,null,null),
  ('ROSTER_MANAGEMENT','Roster management','Team roster and eligibility management.','TEAM','BOOLEAN',false,null,null),
  ('LIVE_GAME','Live game','Live statistics and play-by-play capture.','TEAM','BOOLEAN',false,null,null),
  ('TRAINING_MANAGEMENT','Training management','Team training planning and recording.','TEAM','BOOLEAN',false,null,null),
  ('CLUB_ADMIN','Club administration','Central multi-team administration.','ORGANIZATION','BOOLEAN',false,null,null),
  ('AUDIT_LOG','Audit log','Advanced administrative and security traceability.','GOVERNANCE','BOOLEAN',false,null,null),
  ('API_ACCESS','API access','Governed external API integration.','INTEGRATION','BOOLEAN',false,null,null),
  ('WHITE_LABEL','White label','Organization branding.','ORGANIZATION','BOOLEAN',false,null,null),
  ('MAX_PLAYERS','Maximum players','Maximum player subjects covered by the billing account.','LIMIT','INTEGER',null,0,null),
  ('MAX_ACTIVE_TEAMS','Maximum active teams','Maximum active teams covered by the billing account.','LIMIT','INTEGER',null,0,null),
  ('AI_MONTHLY_UNITS','Monthly AI units','Monthly included AI operations.','LIMIT','INTEGER',null,0,null),
  ('EXPORT_MONTHLY_UNITS','Monthly exports','Monthly premium report exports.','LIMIT','INTEGER',null,0,null);

insert into public.saas_plans(code,name,account_type,status,is_public,metadata) values
  ('FAMILY_FREE','Family Free','FAMILY','ACTIVE',true,'{"stage":"acquisition"}'::jsonb),
  ('FAMILY','Family','FAMILY','DRAFT',true,'{"stage":"pricing_hypothesis"}'::jsonb),
  ('FAMILY_PRO','Family Pro','FAMILY','DRAFT',true,'{"stage":"pricing_hypothesis"}'::jsonb),
  ('TEAM_STARTER','Team Starter','TEAM','DRAFT',true,'{"stage":"pricing_hypothesis"}'::jsonb),
  ('TEAM_PRO','Team Pro','TEAM','DRAFT',true,'{"stage":"pricing_hypothesis"}'::jsonb),
  ('CLUB','Club','CLUB','DRAFT',true,'{"stage":"pricing_hypothesis"}'::jsonb),
  ('ACADEMY','Academy','ACADEMY','DRAFT',true,'{"stage":"pricing_hypothesis"}'::jsonb),
  ('INTERNAL_FULL','Internal Full','INTERNAL','ACTIVE',false,'{"stage":"internal"}'::jsonb);

-- Family plans deliberately separate observation, interpretation and action.
with v(plan_code,code,scope,bv,iv,tv) as (values
  ('FAMILY_FREE','PLAYER_PROFILE','ACCOUNT_MEMBERS',true,null::integer,null::text),
  ('FAMILY_FREE','GAME_HISTORY','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_FREE','BASIC_STATS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_FREE','BASIC_TIMELINE','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_FREE','MAX_PLAYERS','ACCOUNT_MEMBERS',null,1,null),

  ('FAMILY','PLAYER_PROFILE','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','GAME_HISTORY','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','BASIC_STATS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','BASIC_TIMELINE','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','ADVANCED_ANALYTICS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','PLAYER360','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','PLAYER_GOALS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','DEVELOPMENT_PLAN','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','TECHNIFICATION','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','FAMILY_INSIGHTS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','REPORT_EXPORT','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY','MAX_PLAYERS','ACCOUNT_MEMBERS',null,2,null),
  ('FAMILY','EXPORT_MONTHLY_UNITS','ACCOUNT_MEMBERS',null,20,null),

  ('FAMILY_PRO','PLAYER_PROFILE','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','GAME_HISTORY','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','BASIC_STATS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','BASIC_TIMELINE','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','ADVANCED_ANALYTICS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','PLAYER360','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','PLAYER_GOALS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','DEVELOPMENT_PLAN','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','TECHNIFICATION','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','FAMILY_INSIGHTS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','REPORT_EXPORT','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','WELLNESS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','PRIVACY_CENTER','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','AI_INSIGHTS','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','AI_WEEKLY_PLAN','ACCOUNT_MEMBERS',true,null,null),
  ('FAMILY_PRO','MAX_PLAYERS','ACCOUNT_MEMBERS',null,4,null),
  ('FAMILY_PRO','AI_MONTHLY_UNITS','ACCOUNT_MEMBERS',null,0,null),
  ('FAMILY_PRO','EXPORT_MONTHLY_UNITS','ACCOUNT_MEMBERS',null,100,null),
  ('TEAM_STARTER','BASIC_STATS','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_STARTER','GAME_HISTORY','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_STARTER','ROSTER_MANAGEMENT','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_STARTER','LIVE_GAME','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_STARTER','TRAINING_MANAGEMENT','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_STARTER','MAX_ACTIVE_TEAMS','AUTHORIZED_STAFF',null,1,null),

  ('TEAM_PRO','BASIC_STATS','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','GAME_HISTORY','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','ROSTER_MANAGEMENT','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','LIVE_GAME','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','TRAINING_MANAGEMENT','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','ADVANCED_ANALYTICS','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','PLAYER360','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','PLAYER_GOALS','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','DEVELOPMENT_PLAN','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','TECHNIFICATION','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','REPORT_EXPORT','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','AI_INSIGHTS','AUTHORIZED_STAFF',true,null,null),
  ('TEAM_PRO','MAX_ACTIVE_TEAMS','AUTHORIZED_STAFF',null,1,null),
  ('TEAM_PRO','AI_MONTHLY_UNITS','AUTHORIZED_STAFF',null,0,null),
  ('TEAM_PRO','EXPORT_MONTHLY_UNITS','AUTHORIZED_STAFF',null,250,null),
  ('CLUB','BASIC_STATS','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','GAME_HISTORY','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','ROSTER_MANAGEMENT','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','LIVE_GAME','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','TRAINING_MANAGEMENT','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','ADVANCED_ANALYTICS','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','PLAYER360','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','PLAYER_GOALS','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','DEVELOPMENT_PLAN','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','TECHNIFICATION','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','REPORT_EXPORT','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','PRIVACY_CENTER','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','CLUB_ADMIN','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','AUDIT_LOG','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','AI_INSIGHTS','AUTHORIZED_STAFF',true,null,null),
  ('CLUB','MAX_ACTIVE_TEAMS','AUTHORIZED_STAFF',null,10,null),
  ('CLUB','AI_MONTHLY_UNITS','AUTHORIZED_STAFF',null,0,null),
  ('CLUB','EXPORT_MONTHLY_UNITS','AUTHORIZED_STAFF',null,2000,null),

  ('ACADEMY','CLUB_ADMIN','AUTHORIZED_STAFF',true,null,null),
  ('ACADEMY','AUDIT_LOG','AUTHORIZED_STAFF',true,null,null),
  ('ACADEMY','API_ACCESS','AUTHORIZED_STAFF',true,null,null),
  ('ACADEMY','WHITE_LABEL','AUTHORIZED_STAFF',true,null,null),
  ('ACADEMY','MAX_ACTIVE_TEAMS','AUTHORIZED_STAFF',null,30,null),
  ('ACADEMY','AI_MONTHLY_UNITS','AUTHORIZED_STAFF',null,0,null),
  ('ACADEMY','EXPORT_MONTHLY_UNITS','AUTHORIZED_STAFF',null,10000,null)
)
insert into public.saas_plan_entitlements(
  plan_id,entitlement_code,beneficiary_scope,boolean_value,integer_value,text_value
)
select p.id,v.code,v.scope,v.bv,v.iv,v.tv
from v join public.saas_plans p on p.code=v.plan_code;

insert into public.saas_plan_entitlements(
  plan_id,entitlement_code,beneficiary_scope,boolean_value,integer_value,text_value
)
select p.id,c.code,'ALL_AUTHORIZED',
  case when c.value_type='BOOLEAN' then true else null end,
  case when c.value_type='INTEGER' then
    case c.code
      when 'MAX_PLAYERS' then 999
      when 'MAX_ACTIVE_TEAMS' then 999
      when 'AI_MONTHLY_UNITS' then 10000
      else 100000
    end
    else null end,
  case when c.value_type='TEXT' then 'INTERNAL' else null end
from public.saas_plans p cross join public.saas_entitlement_catalog c
where p.code='INTERNAL_FULL';

-- Validate typed entitlement values for both plans and overrides.
create or replace function iq_private.saas_validate_entitlement_value()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_type text;
begin
  select c.value_type into v_type
  from public.saas_entitlement_catalog c
  where c.code=new.entitlement_code and c.is_active;
  if v_type is null then raise exception 'SAAS_ENTITLEMENT_UNKNOWN_OR_INACTIVE'; end if;

  if v_type='BOOLEAN' and not (
    new.boolean_value is not null and new.integer_value is null and new.text_value is null
  ) then raise exception 'SAAS_ENTITLEMENT_BOOLEAN_VALUE_REQUIRED';
  elsif v_type='INTEGER' and not (
    new.boolean_value is null and new.integer_value is not null and new.text_value is null
  ) then raise exception 'SAAS_ENTITLEMENT_INTEGER_VALUE_REQUIRED';
  elsif v_type='TEXT' and not (
    new.boolean_value is null and new.integer_value is null and new.text_value is not null
  ) then raise exception 'SAAS_ENTITLEMENT_TEXT_VALUE_REQUIRED';
  end if;
  return new;
end;
$function$;
revoke all on function iq_private.saas_validate_entitlement_value() from public,anon,authenticated;

drop trigger if exists saas_validate_plan_entitlement on public.saas_plan_entitlements;
create trigger saas_validate_plan_entitlement before insert or update
  on public.saas_plan_entitlements for each row
  execute function iq_private.saas_validate_entitlement_value();
drop trigger if exists saas_validate_override on public.saas_entitlement_overrides;
create trigger saas_validate_override before insert or update
  on public.saas_entitlement_overrides for each row
  execute function iq_private.saas_validate_entitlement_value();

create or replace function iq_private.saas_touch_updated_at()
returns trigger language plpgsql set search_path=''
as $function$
begin new.updated_at:=now(); return new; end;
$function$;
revoke all on function iq_private.saas_touch_updated_at() from public,anon,authenticated;

do $block$
declare r text;
begin
  foreach r in array array[
    'saas_entitlement_catalog','saas_plans','saas_plan_entitlements',
    'saas_billing_accounts','saas_billing_account_members','saas_billing_subjects',
    'saas_subscriptions','saas_entitlement_overrides'
  ] loop
    execute format(
      'create trigger saas_touch_updated_at before update on public.%I for each row execute function iq_private.saas_touch_updated_at()',r
    );
  end loop;
end
$block$;

create or replace function iq_private.saas_audit_subscription()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  insert into public.saas_subscription_history(
    subscription_id,billing_account_id,plan_id,status,snapshot,reason,changed_by
  ) values (
    new.id,new.billing_account_id,new.plan_id,new.status,to_jsonb(new),
    coalesce(new.metadata->>'change_reason',new.source),auth.uid()
  );
  return new;
end;
$function$;
revoke all on function iq_private.saas_audit_subscription() from public,anon,authenticated;

drop trigger if exists saas_audit_subscription on public.saas_subscriptions;
create trigger saas_audit_subscription after insert or update
  on public.saas_subscriptions for each row
  execute function iq_private.saas_audit_subscription();

create or replace function iq_private.saas_subscription_effective(p_subscription_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists (
    select 1 from public.saas_subscriptions s
    join public.saas_billing_accounts a on a.id=s.billing_account_id
    join public.saas_plans p on p.id=s.plan_id
    where s.id=p_subscription_id and a.status='ACTIVE' and p.status='ACTIVE'
      and s.starts_at<=now()
      and (
        (s.status='ACTIVE' and (s.current_period_end is null or s.current_period_end>now()))
        or (s.status='TRIAL' and s.trial_ends_at>now())
        or (s.status='GRACE' and s.grace_ends_at>now())
      )
  );
$function$;
revoke all on function iq_private.saas_subscription_effective(uuid) from public,anon,authenticated;

create or replace function iq_private.saas_account_member(
  p_account_id uuid,p_user_id uuid
)
returns boolean language sql stable security definer set search_path=''
as $function$
  select exists (
    select 1 from public.saas_billing_account_members m
    where m.billing_account_id=p_account_id
      and m.user_id=p_user_id and m.status='ACTIVE'
  );
$function$;
revoke all on function iq_private.saas_account_member(uuid,uuid) from public,anon,authenticated;

-- Paying never grants data access. This helper only mirrors existing sports
-- relationships/RBAC and is evaluated before commercial entitlement resolution.
create or replace function iq_private.saas_user_can_access_subject(
  p_user_id uuid,p_subject_type text,p_subject_id uuid,p_team_season_id uuid
)
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare v_type text:=upper(trim(coalesce(p_subject_type,'')));
begin
  if p_user_id is null or p_subject_id is null or not iq_private.account_is_active(p_user_id) then
    return false;
  end if;
  if public.iq_v3_is_global_superadmin() then return true; end if;

  if v_type='PLAYER' then
    if exists (
      select 1 from public.user_player_links l
      where l.user_id=p_user_id and l.player_id=p_subject_id
        and upper(coalesce(l.status,'ACTIVE'))='ACTIVE'
        and (l.valid_from is null or l.valid_from<=now())
        and (l.valid_until is null or l.valid_until>now())
    ) then return true; end if;

    if exists (
      select 1 from public.player360_subject_relationships r
      where r.user_id=p_user_id and r.player_id=p_subject_id and r.status='ACTIVE'
        and r.valid_from<=now() and (r.valid_until is null or r.valid_until>now())
    ) then return true; end if;

    return p_team_season_id is not null
      and public.iq_v3_player_participated_in_team_season(p_subject_id,p_team_season_id)
      and public.iq_v4_can_view_player360_team_season(p_team_season_id);
  elsif v_type='TEAM' then
    return public.iq_v5_can_access_team(p_subject_id);
  elsif v_type='CLUB' then
    return exists (
      select 1 from public.club_season_memberships cm
      where cm.user_id=p_user_id and cm.club_id=p_subject_id
        and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
        and (cm.valid_from is null or cm.valid_from<=now())
        and (cm.valid_until is null or cm.valid_until>now())
    ) or exists (
      select 1
      from public.team_season_memberships tm
      join public.team_seasons ts on ts.id=tm.team_season_id
      join public.teams t on t.id=ts.team_id
      where tm.user_id=p_user_id and t.club_id=p_subject_id
        and upper(coalesce(tm.status,'ACTIVE'))='ACTIVE'
        and (tm.valid_from is null or tm.valid_from<=now())
        and (tm.valid_until is null or tm.valid_until>now())
    ) or exists (
      select 1 from public.user_profiles up
      join public.teams t on t.id=any(coalesce(up.assigned_team_ids,'{}'::uuid[]))
      where up.id=p_user_id and t.club_id=p_subject_id
    );
  end if;
  return false;
end;
$function$;
revoke all on function iq_private.saas_user_can_access_subject(uuid,text,uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.saas_user_is_staff(
  p_user_id uuid,p_subject_type text,p_subject_id uuid,p_team_season_id uuid
)
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare v_type text:=upper(trim(coalesce(p_subject_type,'')));
begin
  if p_user_id is null or p_subject_id is null or not iq_private.account_is_active(p_user_id) then
    return false;
  end if;
  if public.iq_v3_is_global_superadmin() then return true; end if;

  if p_team_season_id is not null then
    if public.iq_v4_has_player360_action_role(
      p_team_season_id,
      array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ENTRENADOR','AYUDANTE','ANALISTA','PREPARADOR_FISICO'],
      array['ADMIN','COORDINADOR','DIRECTOR_DEPORTIVO','ANALISTA'],
      array['ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO']
    ) then return true; end if;
  end if;

  if v_type='TEAM' then
    return exists (
      select 1 from public.team_season_memberships tm
      join public.team_seasons ts on ts.id=tm.team_season_id
      where tm.user_id=p_user_id and ts.team_id=p_subject_id
        and upper(coalesce(tm.status,'ACTIVE'))='ACTIVE'
        and upper(tm.function_role) not in ('INVITADO','JUGADOR','PADRE','MADRE','TUTOR','FAMILIA')
    ) or exists (
      select 1 from public.user_profiles up
      where up.id=p_user_id and p_subject_id=any(coalesce(up.assigned_team_ids,'{}'::uuid[]))
        and (upper(coalesce(up.global_role,'')) in ('SUPERADMIN','ADMIN')
          or upper(coalesce(up.role,'')) in ('ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO','COORDINADOR','DIRECTOR_DEPORTIVO'))
    );
  elsif v_type='CLUB' then
    return exists (
      select 1 from public.club_season_memberships cm
      where cm.user_id=p_user_id and cm.club_id=p_subject_id
        and upper(coalesce(cm.status,'ACTIVE'))='ACTIVE'
        and upper(cm.function_role) not in ('INVITADO','JUGADOR','PADRE','MADRE','TUTOR','FAMILIA')
    ) or exists (
      select 1 from public.user_profiles up
      join public.teams t on t.id=any(coalesce(up.assigned_team_ids,'{}'::uuid[]))
      where up.id=p_user_id and t.club_id=p_subject_id
        and (upper(coalesce(up.global_role,'')) in ('SUPERADMIN','ADMIN')
          or upper(coalesce(up.role,'')) in ('ADMIN','ENTRENADOR','ANALISTA','PREPARADOR_FISICO','COORDINADOR','DIRECTOR_DEPORTIVO'))
    );
  end if;
  return false;
end;
$function$;
revoke all on function iq_private.saas_user_is_staff(uuid,text,uuid,uuid)
  from public,anon,authenticated;

create or replace function iq_private.saas_subject_covers(
  p_billing_subject_id uuid,p_subject_type text,p_subject_id uuid,p_team_season_id uuid
)
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare
  v_bs public.saas_billing_subjects%rowtype;
  v_type text:=upper(trim(coalesce(p_subject_type,'')));
  v_team_id uuid;
  v_club_id uuid;
begin
  select * into v_bs from public.saas_billing_subjects bs
  where bs.id=p_billing_subject_id and bs.status='ACTIVE'
    and bs.valid_from<=now() and (bs.valid_until is null or bs.valid_until>now());
  if v_bs.id is null then return false; end if;

  if v_type='PLAYER' and v_bs.subject_type='PLAYER' then
    return v_bs.player_id=p_subject_id;
  elsif v_type='TEAM' and v_bs.subject_type='TEAM' then
    return v_bs.team_id=p_subject_id;
  elsif v_type='CLUB' and v_bs.subject_type='CLUB' then
    return v_bs.club_id=p_subject_id;
  end if;

  if v_type='TEAM' and v_bs.subject_type='CLUB' then
    select t.club_id into v_club_id from public.teams t where t.id=p_subject_id;
    return v_bs.club_id=v_club_id;
  end if;

  if v_type='PLAYER' and p_team_season_id is not null
     and public.iq_v3_player_participated_in_team_season(p_subject_id,p_team_season_id) then
    select ts.team_id,t.club_id into v_team_id,v_club_id
    from public.team_seasons ts join public.teams t on t.id=ts.team_id
    where ts.id=p_team_season_id;
    if v_bs.subject_type='TEAM' then return v_bs.team_id=v_team_id; end if;
    if v_bs.subject_type='CLUB' then return v_bs.club_id=v_club_id; end if;
  end if;

  return false;
end;
$function$;
revoke all on function iq_private.saas_subject_covers(uuid,text,uuid,uuid)
  from public,anon,authenticated;
create or replace function iq_private.saas_effective_entitlement_for_user(
  p_user_id uuid,p_subject_type text,p_subject_id uuid,p_team_season_id uuid,p_entitlement_code text
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_code text:=upper(trim(coalesce(p_entitlement_code,'')));
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
      bs.subject_type source_subject_type,
      coalesce(o.beneficiary_scope,pe.beneficiary_scope) beneficiary_scope,
      coalesce(o.boolean_value,pe.boolean_value) boolean_value,
      coalesce(o.integer_value,pe.integer_value) integer_value,
      coalesce(o.text_value,pe.text_value) text_value,
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
    where iq_private.saas_subscription_effective(s.id)
      and (pe.entitlement_code is not null or o.entitlement_code is not null)
      and iq_private.saas_subject_covers(bs.id,p_subject_type,p_subject_id,p_team_season_id)
      and case coalesce(o.beneficiary_scope,pe.beneficiary_scope)
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
    'boolean_value',v_result.boolean_value,'integer_value',v_result.integer_value,
    'text_value',v_result.text_value
  );
end;
$function$;
revoke all on function iq_private.saas_effective_entitlement_for_user(uuid,text,uuid,uuid,text)
  from public,anon,authenticated;

create or replace function public.iq_saas_entitlement_check(
  p_subject_type text,p_subject_id uuid,p_team_season_id uuid,
  p_entitlement_code text,p_required_units integer default 1
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_result jsonb;
  v_type text;
  v_allowed boolean:=false;
  v_required integer:=greatest(coalesce(p_required_units,1),0);
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  v_result:=iq_private.saas_effective_entitlement_for_user(
    auth.uid(),p_subject_type,p_subject_id,p_team_season_id,p_entitlement_code
  );
  if not coalesce((v_result->>'known')::boolean,false) then return v_result; end if;
  if v_result->>'billing_account_id' is null then return v_result; end if;

  v_type:=v_result->>'value_type';
  if v_type='BOOLEAN' then v_allowed:=coalesce((v_result->>'boolean_value')::boolean,false);
  elsif v_type='INTEGER' then v_allowed:=coalesce((v_result->>'integer_value')::integer,0)>=v_required;
  elsif v_type='TEXT' then v_allowed:=nullif(trim(coalesce(v_result->>'text_value','')),'') is not null;
  end if;

  return v_result || jsonb_build_object(
    'allowed',v_allowed,
    'required_units',v_required,
    'reason_code',case when v_allowed then 'ENTITLED' else 'ENTITLEMENT_LIMIT_OR_DISABLED' end
  );
end;
$function$;
revoke all on function public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)
  from public,anon;
grant execute on function public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)
  to authenticated;

create or replace function public.iq_saas_entitlement_snapshot(
  p_subject_type text,p_subject_id uuid,p_team_season_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_entitlements jsonb;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;

  if not iq_private.saas_user_can_access_subject(
    auth.uid(),p_subject_type,p_subject_id,p_team_season_id
  ) then raise exception 'SAAS_SUBJECT_ACCESS_DENIED' using errcode='42501'; end if;

  select coalesce(jsonb_object_agg(c.code,
    iq_private.saas_effective_entitlement_for_user(
      auth.uid(),p_subject_type,p_subject_id,p_team_season_id,c.code
    )
  ),'{}'::jsonb)
  into v_entitlements
  from public.saas_entitlement_catalog c where c.is_active;

  return jsonb_build_object(
    'subject_type',upper(trim(p_subject_type)),
    'subject_id',p_subject_id,
    'team_season_id',p_team_season_id,
    'entitlements',v_entitlements
  );
end;
$function$;
revoke all on function public.iq_saas_entitlement_snapshot(text,uuid,uuid)
  from public,anon;
grant execute on function public.iq_saas_entitlement_snapshot(text,uuid,uuid)
  to authenticated;

-- No paid plan is activated here and no billing account is auto-created.
-- The schema is inert until a future checkout/admin process creates accounts,
-- subjects and subscriptions.
do $block$
begin
  if exists (
    select 1 from public.saas_plans
    where code in ('FAMILY','FAMILY_PRO','TEAM_STARTER','TEAM_PRO','CLUB','ACADEMY')
      and status<>'DRAFT'
  ) then raise exception 'SAAS_V1_PAID_PLAN_ACTIVATED_PREMATURELY'; end if;

  if exists (select 1 from public.saas_billing_accounts) then
    raise exception 'SAAS_V1_BILLING_ACCOUNT_CREATED_PREMATURELY';
  end if;

  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname like 'saas\_%' escape '\'
      and c.relkind='r' and not c.relrowsecurity
  ) then raise exception 'SAAS_V1_TABLE_WITHOUT_RLS'; end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name like 'saas\_%' escape '\'
      and grantee in ('anon','authenticated')
  ) then raise exception 'SAAS_V1_DIRECT_CLIENT_TABLE_GRANT'; end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('iq_saas_entitlement_check','iq_saas_entitlement_snapshot')
      and not p.prosecdef
  ) then raise exception 'SAAS_V1_PUBLIC_WRAPPER_NOT_SECURITY_DEFINER'; end if;

  if exists (
    select 1 from public.saas_plan_entitlements pe
    join public.saas_entitlement_catalog c on c.code=pe.entitlement_code
    where (c.value_type='BOOLEAN' and not (pe.boolean_value is not null and pe.integer_value is null and pe.text_value is null))
       or (c.value_type='INTEGER' and not (pe.boolean_value is null and pe.integer_value is not null and pe.text_value is null))
       or (c.value_type='TEXT' and not (pe.boolean_value is null and pe.integer_value is null and pe.text_value is not null))
  ) then raise exception 'SAAS_V1_PLAN_ENTITLEMENT_VALUE_SHAPE_INVALID'; end if;
end
$block$;

commit;
