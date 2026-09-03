-- Core corrections · functional training/technification edit · inside transaction
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',up.id::text,
    'email',lower(up.email),
    'role','authenticated'
  )::text,
  true
)
from public.user_profiles up
where lower(up.email)='scolado@nechigroup.com'
limit 1;

create temp table core_training_ctx on commit drop as
select s.*
from public.training_sessions s
where upper(coalesce(s.status,'PLANNED'))<>'ARCHIVED'
order by s.created_at
limit 1;

create temp table core_training_participants_before on commit drop as
select tp.*
from public.training_participants tp
join core_training_ctx c on c.id=tp.training_session_id;

create temp table core_external_ctx on commit drop as
select e.*
from public.external_development_sessions e
order by e.created_at
limit 1;

do $$
declare
  v core_training_ctx%rowtype;
  v_participants jsonb;
begin
  select * into v from core_training_ctx;
  if v.id is null then raise exception 'CORE_TRAINING_TEST_SESSION_MISSING'; end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('player_id',tp.player_id) order by tp.player_id::text),
    '[]'::jsonb
  )
  into v_participants
  from core_training_participants_before tp;

  perform public.iq_v4_update_training_session(
    v.id,
    v.session_date,
    v.title || ' [functional test]',
    v.objective,
    v.duration_minutes,
    v.intensity,
    v.start_time,
    v.end_time,
    '[]'::jsonb,
    v_participants
  );

  if not exists(
    select 1 from public.training_sessions s
    where s.id=v.id and s.title=v.title || ' [functional test]'
  ) then
    raise exception 'CORE_TRAINING_UPDATE_NOT_APPLIED';
  end if;

  if (
    select count(*) from public.training_participants tp
    where tp.training_session_id=v.id
  ) <> (
    select count(*) from core_training_participants_before
  ) then
    raise exception 'CORE_TRAINING_PARTICIPANT_COUNT_CHANGED';
  end if;

  if exists(
    select 1
    from core_training_participants_before b
    full join public.training_participants a on a.id=b.id
    where a.training_session_id=v.id
      and (
        a.id is null or b.id is null
        or a.attendance_status is distinct from b.attendance_status
        or a.participated_minutes is distinct from b.participated_minutes
        or a.rpe is distinct from b.rpe
        or a.notes is distinct from b.notes
      )
  ) then
    raise exception 'CORE_TRAINING_CONFIRMED_ATTENDANCE_CHANGED';
  end if;
end $$;

do $$
declare
  v core_external_ctx%rowtype;
begin
  select * into v from core_external_ctx;
  if v.id is null then raise exception 'CORE_EXTERNAL_TEST_SESSION_MISSING'; end if;

  perform public.iq_v4_update_external_development(
    v.id,v.player_id,v.activity_date,v.title || ' [functional test]',
    v.activity_code,v.activity_type_id,v.provider_type,v.provider_name,
    v.objective,v.duration_minutes,v.intensity,v.rpe,v.source_type,v.notes,
    v.provenance,v.metadata
  );

  if not exists(
    select 1 from public.external_development_sessions e
    where e.id=v.id and e.title=v.title || ' [functional test]'
  ) then
    raise exception 'CORE_EXTERNAL_UPDATE_NOT_APPLIED';
  end if;
end $$;

select
  'CORE_TRAINING_FUNCTIONAL' as section,
  true as training_update_ok,
  true as attendance_preserved_ok,
  true as external_update_ok,
  true as all_ok;
