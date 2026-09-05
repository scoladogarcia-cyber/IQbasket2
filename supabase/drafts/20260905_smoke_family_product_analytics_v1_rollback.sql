-- Functional Product Analytics V1 smoke. ALWAYS rolls back.
begin;

create temp table product_analytics_smoke_state(
  superadmin_id uuid,
  invited_id uuid,
  player_id uuid,
  event_id uuid,
  metrics jsonb
) on commit drop;

insert into product_analytics_smoke_state(superadmin_id,invited_id,player_id)
select sa.id,iv.id,p.id
from public.user_profiles sa
cross join public.user_profiles iv
cross join lateral (select id from public.players order by id limit 1) p
where lower(sa.email)='scolado@nechigroup.com'
  and lower(iv.email)='test@test.com';

do $smoke$
begin
  if (select count(*) from product_analytics_smoke_state)<>1 then
    raise exception 'PRODUCT_ANALYTICS_SMOKE_CONTEXT_MISSING';
  end if;
end
$smoke$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',s.superadmin_id::text,'email','scolado@nechigroup.com','role','authenticated')::text,
  true
) from product_analytics_smoke_state s;

update product_analytics_smoke_state s
set event_id=public.iq_v9_track_product_event(
  'FAMILY_WORKSPACE_VIEWED',s.player_id,'FAMILY_WORKSPACE','DASHBOARD',
  null,'FAMILY_VALUE_V1','A',6
);

update product_analytics_smoke_state
set metrics=public.iq_v9_product_metrics(30);

do $smoke$
declare v product_analytics_smoke_state%rowtype;
begin
  select * into v from product_analytics_smoke_state;
  if v.event_id is null then raise exception 'PRODUCT_ANALYTICS_SMOKE_TRACK_FAILED'; end if;
  if coalesce((v.metrics->>'unique_users')::integer,0)<1 then
    raise exception 'PRODUCT_ANALYTICS_SMOKE_METRICS_FAILED';
  end if;
  if not exists(select 1 from public.product_analytics_events e where e.id=v.event_id) then
    raise exception 'PRODUCT_ANALYTICS_SMOKE_EVENT_MISSING';
  end if;
end
$smoke$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',s.invited_id::text,'email','test@test.com','role','authenticated')::text,
  true
) from product_analytics_smoke_state s;

do $smoke$
declare v_player uuid;
begin
  select player_id into v_player from product_analytics_smoke_state;
  begin
    perform public.iq_v9_track_product_event(
      'FAMILY_PLAN_INTEREST_CLICKED',v_player,'FAMILY_WORKSPACE','INSIGHT_READY','FAMILY',null,null,6
    );
    raise exception 'PRODUCT_ANALYTICS_SMOKE_UNRELATED_PLAYER_OPEN';
  exception
    when sqlstate '42501' then null;
  end;
end
$smoke$;

select 'PRODUCT_ANALYTICS_SMOKE' as section,
  event_id is not null as tracked,
  coalesce((metrics->>'unique_users')::integer,0)>=1 as metrics_ok
from product_analytics_smoke_state;

rollback;
select 'PRODUCT_ANALYTICS_SMOKE_ROLLBACK_OK' as section;
