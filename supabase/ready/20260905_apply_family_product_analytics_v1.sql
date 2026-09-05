-- IQBasket Family Product Analytics V1
-- First-party, data-minimized product telemetry. No sporting/sensitive payloads.
begin;

create table public.product_event_catalog (
  code text primary key,
  category text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint product_event_code_check check (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint product_event_category_check check (category in ('ACTIVATION','ENGAGEMENT','VALUE','CONVERSION','AI','DEVELOPMENT'))
);

create table public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid null references public.players(id) on delete set null,
  billing_account_id uuid null references public.saas_billing_accounts(id) on delete set null,
  event_code text not null references public.product_event_catalog(code),
  surface text not null,
  placement text null,
  current_plan_code text null,
  target_plan_code text null,
  experiment_key text null,
  variant_key text null,
  evidence_count integer null,
  occurred_at timestamptz not null default now()
);

create index product_analytics_events_user_time_idx
  on public.product_analytics_events(user_id,occurred_at desc);
create index product_analytics_events_player_time_idx
  on public.product_analytics_events(player_id,occurred_at desc)
  where player_id is not null;
create index product_analytics_events_code_time_idx
  on public.product_analytics_events(event_code,occurred_at desc);

alter table public.product_event_catalog enable row level security;
alter table public.product_analytics_events enable row level security;
revoke all on table public.product_event_catalog from public,anon,authenticated;
revoke all on table public.product_analytics_events from public,anon,authenticated;

create policy "product catalog deny direct authenticated"
  on public.product_event_catalog as restrictive for all to authenticated
  using (false) with check (false);
create policy "product analytics deny direct authenticated"
  on public.product_analytics_events as restrictive for all to authenticated
  using (false) with check (false);

insert into public.product_event_catalog(code,category,description) values
  ('FAMILY_WORKSPACE_VIEWED','ENGAGEMENT','Family workspace rendered'),
  ('FAMILY_PASSPORT_VIEWED','VALUE','Longitudinal passport viewed'),
  ('FAMILY_PLAYER_SWITCHED','ENGAGEMENT','Family switched linked player'),
  ('FAMILY_ONBOARDING_COMPLETED','ACTIVATION','First family link became usable'),
  ('FAMILY_CLAIM_STARTED','ACTIVATION','Guardian claim flow started'),
  ('FAMILY_CLAIM_SUCCEEDED','ACTIVATION','Guardian claim flow completed'),
  ('FAMILY_CLAIM_FAILED','ACTIVATION','Guardian claim flow failed');

insert into public.product_event_catalog(code,category,description) values
  ('FAMILY_INSIGHT_OFFER_VIEWED','CONVERSION','Contextual Family offer shown'),
  ('FAMILY_PLAN_INTEREST_CLICKED','CONVERSION','User expressed interest in a family plan'),
  ('FAMILY_PLAYER360_OPENED','VALUE','Family Player360 value opened'),
  ('FAMILY_OBJECTIVE_VIEWED','VALUE','Shared development objective viewed'),
  ('FAMILY_GAME_SUMMARY_VIEWED','VALUE','Family game summary viewed'),
  ('FAMILY_TRAINING_VALUE_VIEWED','DEVELOPMENT','Training value surfaced to family'),
  ('FAMILY_TECHNIFICATION_VALUE_VIEWED','DEVELOPMENT','Technification value surfaced to family'),
  ('AI_REPORT_INTEREST','AI','Interest in intelligent evolution report'),
  ('AI_WEEKLY_PLAN_INTEREST','AI','Interest in weekly intelligent plan');

create or replace function public.iq_v9_track_product_event(
  p_event_code text,
  p_player_id uuid default null,
  p_surface text default 'FAMILY_WORKSPACE',
  p_placement text default null,
  p_target_plan_code text default null,
  p_experiment_key text default null,
  p_variant_key text default null,
  p_evidence_count integer default null
)
returns uuid
language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_id uuid;
  v_product jsonb;
  v_account_id uuid;
  v_current_plan text;
begin
  if auth.uid() is null or not public.iq_account_is_active() then
    raise exception 'ACCOUNT_ACTIVE_AUTH_REQUIRED' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.product_event_catalog c
    where c.code=upper(trim(coalesce(p_event_code,''))) and c.is_active
  ) then raise exception 'PRODUCT_EVENT_NOT_ALLOWED'; end if;

  if p_surface not in (
    'FAMILY_WORKSPACE','FAMILY_ONBOARDING','PLAYER360_FAMILY',
    'TRAINING_FAMILY','GAME_FAMILY','PRICING_EXPERIMENT'
  ) then raise exception 'PRODUCT_EVENT_SURFACE_INVALID'; end if;
  if p_placement is not null and p_placement !~ '^[A-Z0-9_]{1,64}$' then
    raise exception 'PRODUCT_EVENT_PLACEMENT_INVALID';
  end if;
  if p_experiment_key is not null and p_experiment_key !~ '^[A-Z0-9_]{1,64}$' then
    raise exception 'PRODUCT_EVENT_EXPERIMENT_INVALID';
  end if;
  if p_variant_key is not null and p_variant_key !~ '^[A-Z0-9_]{1,32}$' then
    raise exception 'PRODUCT_EVENT_VARIANT_INVALID';
  end if;
  if p_evidence_count is not null and (p_evidence_count<0 or p_evidence_count>10000) then
    raise exception 'PRODUCT_EVENT_EVIDENCE_INVALID';
  end if;

  if p_player_id is not null then
    if not iq_private.family_can_view_player(auth.uid(),p_player_id)
       and not public.iq_v3_is_global_superadmin() then
      raise exception 'PRODUCT_EVENT_PLAYER_ACCESS_DENIED' using errcode='42501';
    end if;
    v_product:=public.iq_v8_family_product_snapshot(p_player_id);
    v_account_id:=nullif(v_product->>'billing_account_id','')::uuid;
    v_current_plan:=nullif(v_product->>'plan_code','');
  end if;

  if p_target_plan_code is not null and not exists (
    select 1 from public.saas_plans p
    where p.code=p_target_plan_code and p.account_type='FAMILY'
  ) then raise exception 'PRODUCT_EVENT_TARGET_PLAN_INVALID'; end if;

  insert into public.product_analytics_events(
    user_id,player_id,billing_account_id,event_code,surface,placement,
    current_plan_code,target_plan_code,experiment_key,variant_key,evidence_count
  ) values (
    auth.uid(),p_player_id,v_account_id,upper(trim(p_event_code)),p_surface,p_placement,
    v_current_plan,p_target_plan_code,p_experiment_key,p_variant_key,p_evidence_count
  ) returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)
  from public,anon,authenticated;
grant execute on function public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)
  to authenticated;

create or replace function public.iq_v9_product_metrics(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare
  v_since timestamptz;
  v_events jsonb;
  v_users integer;
  v_players integer;
  v_offers integer;
  v_interest integer;
begin
  if auth.uid() is null or not public.iq_account_is_active()
     or not public.iq_v3_is_global_superadmin() then
    raise exception 'PRODUCT_METRICS_ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_days<1 or p_days>366 then raise exception 'PRODUCT_METRICS_RANGE_INVALID'; end if;
  v_since:=now()-make_interval(days=>p_days);

  select coalesce(jsonb_object_agg(event_code,total),'{}'::jsonb)
    into v_events
  from (
    select event_code,count(*)::integer total
    from public.product_analytics_events
    where occurred_at>=v_since group by event_code order by event_code
  ) x;

  select count(distinct user_id)::integer,count(distinct player_id)::integer,
    count(*) filter(where event_code='FAMILY_INSIGHT_OFFER_VIEWED')::integer,
    count(*) filter(where event_code='FAMILY_PLAN_INTEREST_CLICKED')::integer
  into v_users,v_players,v_offers,v_interest
  from public.product_analytics_events where occurred_at>=v_since;

  return jsonb_build_object(
    'window_days',p_days,
    'since',v_since,
    'unique_users',coalesce(v_users,0),
    'unique_players',coalesce(v_players,0),
    'offer_views',coalesce(v_offers,0),
    'interest_clicks',coalesce(v_interest,0),
    'interest_rate',case when coalesce(v_offers,0)=0 then 0
      else round((v_interest::numeric/v_offers::numeric)*100,1) end,
    'events',v_events,
    'family_plans',(select coalesce(jsonb_object_agg(p.code,p.status),'{}'::jsonb)
      from public.saas_plans p where p.account_type='FAMILY')
  );
end;
$function$;
revoke all on function public.iq_v9_product_metrics(integer)
  from public,anon,authenticated;
grant execute on function public.iq_v9_product_metrics(integer) to authenticated;

-- Invariants.
do $v9$
begin
  if has_table_privilege('authenticated','public.product_analytics_events','SELECT')
     or has_table_privilege('authenticated','public.product_analytics_events','INSERT') then
    raise exception 'PRODUCT_ANALYTICS_DIRECT_CLIENT_ACCESS_OPEN';
  end if;
  if has_function_privilege('anon','public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)','EXECUTE') then
    raise exception 'PRODUCT_ANALYTICS_ANON_TRACK_OPEN';
  end if;
  if not has_function_privilege('authenticated','public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)','EXECUTE') then
    raise exception 'PRODUCT_ANALYTICS_TRACK_RPC_CLOSED';
  end if;
end
$v9$;

commit;

select
  'FAMILY_PRODUCT_ANALYTICS_V1_APPLY' as section,
  to_regclass('public.product_analytics_events') is not null as events_ok,
  to_regprocedure('public.iq_v9_track_product_event(text,uuid,text,text,text,text,text,integer)') is not null as track_ok,
  to_regprocedure('public.iq_v9_product_metrics(integer)') is not null as metrics_ok;
