-- =============================================================================
-- IQBasket Player 360 Phase 4E.2 - Nutrition + Recovery manual check-ins
-- ADDITIVE. Manual input only. External imports and sensitive clinical fields
-- remain disabled / out of scope.
-- =============================================================================

begin;

do $iq4e2$
begin
  if to_regclass('public.player360_subject_relationships') is null
     or to_regclass('public.player360_processing_authorizations') is null
     or to_regclass('public.player360_sensitive_access_grants') is null
     or to_regprocedure('public.iq_v4e_can_access_sensitive_resource(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.iq_v4e_subject_relation(uuid)') is null
     or to_regprocedure('public.iq_v3_player_eligible_on_date(uuid,uuid,date)') is null
     or to_regprocedure('public.iq_v4_touch_updated_at()') is null then
    raise exception 'PLAYER360_PHASE4E2_PREREQUISITES_MISSING';
  end if;

  if to_regclass('public.player360_wellness_metric_catalog') is not null
     or to_regclass('public.player360_wellness_entries') is not null
     or to_regclass('public.player360_wellness_observations') is not null then
    raise exception 'PLAYER360_PHASE4E2_ALREADY_INSTALLED';
  end if;
end
$iq4e2$;

-- -----------------------------------------------------------------------------
-- 1. Configurable metric catalog
-- -----------------------------------------------------------------------------

create table public.player360_wellness_metric_catalog (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid references public.team_seasons(id) on delete restrict,
  module text not null,
  code text not null,
  name text not null,
  description text,
  value_type text not null,
  unit text,
  min_value numeric,
  max_value numeric,
  step numeric,
  options jsonb not null default '[]'::jsonb,
  sensitivity text not null default 'WELLNESS_RESTRICTED',
  enabled boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 100,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player360_wellness_metric_module_check
    check (module in ('nutrition','recovery')),
  constraint player360_wellness_metric_code_check
    check (code = upper(code) and length(trim(code)) > 0),
  constraint player360_wellness_metric_type_check
    check (value_type in ('NUMBER','SCALE','BOOLEAN','CHOICE')),
  constraint player360_wellness_metric_sensitivity_check
    check (sensitivity = 'WELLNESS_RESTRICTED'),
  constraint player360_wellness_metric_options_check
    check (jsonb_typeof(options) = 'array'),
  constraint player360_wellness_metric_range_check
    check (
      (min_value is null or max_value is null or max_value >= min_value)
      and (step is null or step > 0)
    )
);

create unique index ux_player360_wellness_metric_global
  on public.player360_wellness_metric_catalog(module,code)
  where team_season_id is null;

create unique index ux_player360_wellness_metric_team_season
  on public.player360_wellness_metric_catalog(team_season_id,module,code)
  where team_season_id is not null;

create index idx_player360_wellness_metric_lookup
  on public.player360_wellness_metric_catalog(team_season_id,module,enabled,sort_order);

-- -----------------------------------------------------------------------------
-- 2. Manual check-ins + structured observations
-- -----------------------------------------------------------------------------

create table public.player360_wellness_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  module text not null,
  entry_date date not null,
  purpose text not null,
  source_type text not null,
  captured_by uuid not null references public.user_profiles(id) on delete restrict,
  status text not null default 'ACTIVE',
  archived_by uuid references public.user_profiles(id) on delete set null,
  archived_at timestamptz,
  archive_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id) on delete set null,
  constraint player360_wellness_entry_module_check
    check (module in ('nutrition','recovery')),
  constraint player360_wellness_entry_purpose_check
    check (purpose in (
      'SPORT_PERFORMANCE','PLAYER_SELF_SERVICE','FAMILY_SUPPORT','OPERATIONS'
    )),
  constraint player360_wellness_entry_source_check
    check (source_type in ('PLAYER_SELF_REPORT','GUARDIAN_REPORT','STAFF_MANUAL')),
  constraint player360_wellness_entry_status_check
    check (status in ('ACTIVE','ARCHIVED')),
  constraint player360_wellness_entry_archive_reason_check
    check (
      archive_reason_code is null
      or archive_reason_code in ('USER_ARCHIVE','STAFF_CORRECTION','DATA_QUALITY')
    ),
  constraint player360_wellness_entry_archive_check
    check (
      (status='ACTIVE' and archived_at is null and archived_by is null)
      or (status='ARCHIVED' and archived_at is not null and archived_by is not null)
    )
);

create index idx_player360_wellness_entry_scope
  on public.player360_wellness_entries(
    team_season_id,player_id,module,status,entry_date desc
  );

create table public.player360_wellness_observations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.player360_wellness_entries(id) on delete cascade,
  metric_catalog_id uuid not null references public.player360_wellness_metric_catalog(id) on delete restrict,
  metric_code text not null,
  value_type text not null,
  numeric_value numeric,
  boolean_value boolean,
  choice_value text,
  unit text,
  quality numeric not null default 1,
  created_at timestamptz not null default now(),
  constraint player360_wellness_observation_type_check
    check (value_type in ('NUMBER','SCALE','BOOLEAN','CHOICE')),
  constraint player360_wellness_observation_single_value_check
    check (num_nonnulls(numeric_value,boolean_value,choice_value)=1),
  constraint player360_wellness_observation_quality_check
    check (quality >= 0 and quality <= 1),
  constraint player360_wellness_observation_code_check
    check (metric_code = upper(metric_code) and length(trim(metric_code)) > 0)
);

create unique index ux_player360_wellness_observation_metric
  on public.player360_wellness_observations(entry_id,metric_code);

create index idx_player360_wellness_observation_entry
  on public.player360_wellness_observations(entry_id,metric_code);

create trigger trg_player360_wellness_metric_touch
before update on public.player360_wellness_metric_catalog
for each row execute function public.iq_v4_touch_updated_at();

create trigger trg_player360_wellness_entry_touch
before update on public.player360_wellness_entries
for each row execute function public.iq_v4_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Seed product defaults. No body metrics, calories, clinical fields or text.
-- -----------------------------------------------------------------------------

insert into public.player360_wellness_metric_catalog(
  team_season_id,module,code,name,description,value_type,unit,
  min_value,max_value,step,options,sensitivity,enabled,is_system,sort_order
) values
  (null,'recovery','SLEEP_DURATION_HOURS','Duración del sueño',
   'Horas de sueño percibidas/registradas en el último descanso.',
   'NUMBER','HOURS',0,16,0.25,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,10),
  (null,'recovery','SLEEP_QUALITY','Calidad del sueño',
   'Valoración subjetiva del descanso.','SCALE','SCALE_1_5',1,5,1,
   '[]'::jsonb,'WELLNESS_RESTRICTED',true,true,20),
  (null,'recovery','FATIGUE','Fatiga percibida',
   'Sensación general de fatiga antes de la actividad.','SCALE','SCALE_1_5',1,5,1,
   '[]'::jsonb,'WELLNESS_RESTRICTED',true,true,30),
  (null,'recovery','MUSCLE_SORENESS','Molestia muscular percibida',
   'Nivel global de carga o molestia muscular percibida; no es un diagnóstico.',
   'SCALE','SCALE_1_5',1,5,1,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,40),
  (null,'recovery','READINESS','Preparación percibida',
   'Sensación general de preparación para entrenar o competir.',
   'SCALE','SCALE_1_5',1,5,1,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,50),
  (null,'nutrition','HYDRATION_ADHERENCE','Hidratación percibida',
   'Cumplimiento percibido de la pauta personal de hidratación.',
   'SCALE','SCALE_1_5',1,5,1,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,10),
  (null,'nutrition','MEAL_REGULARITY','Regularidad de ingestas',
   'Regularidad percibida respecto a la pauta personal.',
   'SCALE','SCALE_1_5',1,5,1,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,20),
  (null,'nutrition','PRE_TRAINING_FUELING','Ingesta previa planificada',
   'Se siguió la pauta personal prevista antes de la actividad.',
   'BOOLEAN','BOOLEAN',null,null,null,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,30),
  (null,'nutrition','POST_TRAINING_RECOVERY','Recuperación posterior planificada',
   'Se siguió la pauta personal prevista tras la actividad.',
   'BOOLEAN','BOOLEAN',null,null,null,'[]'::jsonb,'WELLNESS_RESTRICTED',true,true,40);

-- -----------------------------------------------------------------------------
-- 4. Read-only capabilities / catalog
-- -----------------------------------------------------------------------------

create function public.iq_v4e2_wellness_capabilities(
  p_team_season_id uuid,
  p_player_id uuid,
  p_module text,
  p_purpose text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $iq4e2$
  select jsonb_build_object(
    'ready', auth.uid() is not null,
    'module', lower(trim(coalesce(p_module,''))),
    'manual_input_enabled', true,
    'external_import_enabled', false,
    'recommendations_enabled', true,
    'ai_processing_enabled', false,
    'can_read', public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,lower(trim(p_module)),'READ',upper(trim(p_purpose))
    ),
    'can_create', public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,lower(trim(p_module)),'CREATE',upper(trim(p_purpose))
    ),
    'can_update', public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,lower(trim(p_module)),'UPDATE',upper(trim(p_purpose))
    ),
    'can_archive', public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,lower(trim(p_module)),'UPDATE',upper(trim(p_purpose))
    )
  );
$iq4e2$;

create function public.iq_v4e2_list_wellness_metric_catalog(
  p_team_season_id uuid,
  p_module text
)
returns table(
  id uuid,
  module text,
  code text,
  name text,
  description text,
  value_type text,
  unit text,
  min_value numeric,
  max_value numeric,
  step numeric,
  options jsonb,
  sort_order integer,
  is_system boolean
)
language sql
stable
security definer
set search_path = ''
as $iq4e2$
  select distinct on (m.module,m.code)
    m.id,m.module,m.code,m.name,m.description,m.value_type,m.unit,
    m.min_value,m.max_value,m.step,m.options,m.sort_order,m.is_system
  from public.player360_wellness_metric_catalog m
  where auth.uid() is not null
    and m.enabled
    and m.module=lower(trim(coalesce(p_module,'')))
    and (m.team_season_id is null or m.team_season_id=p_team_season_id)
  order by
    m.module,m.code,
    case when m.team_season_id=p_team_season_id then 0 else 1 end,
    m.sort_order,
    m.created_at desc;
$iq4e2$;

-- -----------------------------------------------------------------------------
-- 5. Secured read of manual entries
-- -----------------------------------------------------------------------------

create function public.iq_v4e2_list_wellness_entries(
  p_team_season_id uuid,
  p_player_id uuid,
  p_module text,
  p_purpose text,
  p_from date default null,
  p_to date default null,
  p_limit integer default 100
)
returns table(
  id uuid,
  player_id uuid,
  team_season_id uuid,
  module text,
  entry_date date,
  source_type text,
  captured_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  observations jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $iq4e2$
declare
  v_module text := lower(trim(coalesce(p_module,'')));
  v_purpose text := upper(trim(coalesce(p_purpose,'')));
  v_limit integer := least(greatest(coalesce(p_limit,100),1),500);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_module not in ('nutrition','recovery') then
    raise exception 'PLAYER360_WELLNESS_MODULE_INVALID';
  end if;
  if not public.iq_v4e_can_access_sensitive_resource(
    p_player_id,p_team_season_id,v_module,'READ',v_purpose
  ) then
    raise exception 'PLAYER360_WELLNESS_READ_DENIED';
  end if;

  return query
  select
    e.id,e.player_id,e.team_season_id,e.module,e.entry_date,e.source_type,
    e.captured_by,e.created_at,e.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'metric_code',o.metric_code,
            'value_type',o.value_type,
            'value',
              case
                when o.value_type in ('NUMBER','SCALE') then to_jsonb(o.numeric_value)
                when o.value_type='BOOLEAN' then to_jsonb(o.boolean_value)
                else to_jsonb(o.choice_value)
              end,
            'unit',o.unit,
            'quality',o.quality
          )
          order by m.sort_order,o.metric_code
        )
        from public.player360_wellness_observations o
        join public.player360_wellness_metric_catalog m on m.id=o.metric_catalog_id
        where o.entry_id=e.id
      ),
      '[]'::jsonb
    ) as observations
  from public.player360_wellness_entries e
  where e.team_season_id=p_team_season_id
    and e.player_id=p_player_id
    and e.module=v_module
    and e.status='ACTIVE'
    and (p_from is null or e.entry_date>=p_from)
    and (p_to is null or e.entry_date<=p_to)
  order by e.entry_date desc,e.created_at desc
  limit v_limit;
end;
$iq4e2$;

-- -----------------------------------------------------------------------------
-- 6. Save/update manual entry. Source type is derived server-side.
-- -----------------------------------------------------------------------------

create function public.iq_v4e2_save_manual_wellness_entry(
  p_entry_id uuid,
  p_team_season_id uuid,
  p_player_id uuid,
  p_module text,
  p_entry_date date,
  p_purpose text,
  p_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $iq4e2$
declare
  v_id uuid;
  v_existing public.player360_wellness_entries;
  v_module text := lower(trim(coalesce(p_module,'')));
  v_purpose text := upper(trim(coalesce(p_purpose,'')));
  v_relation text;
  v_source_type text;
  v_item jsonb;
  v_metric_id uuid;
  v_metric_code text;
  v_value_type text;
  v_unit text;
  v_min numeric;
  v_max numeric;
  v_step numeric;
  v_options jsonb;
  v_numeric numeric;
  v_boolean boolean;
  v_choice text;
  v_count integer;
  v_distinct integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_module not in ('nutrition','recovery') then
    raise exception 'PLAYER360_WELLNESS_MODULE_INVALID';
  end if;
  if p_entry_date is null or p_entry_date>current_date then
    raise exception 'PLAYER360_WELLNESS_DATE_INVALID';
  end if;
  if not public.iq_v3_player_eligible_on_date(
    p_player_id,p_team_season_id,p_entry_date
  ) then
    raise exception 'PLAYER360_WELLNESS_PLAYER_NOT_ELIGIBLE';
  end if;
  if p_values is null
     or jsonb_typeof(p_values)<>'array'
     or jsonb_array_length(p_values)=0
     or jsonb_array_length(p_values)>20 then
    raise exception 'PLAYER360_WELLNESS_VALUES_INVALID';
  end if;

  select count(*),count(distinct upper(trim(x->>'metric_code')))
    into v_count,v_distinct
  from jsonb_array_elements(p_values) x;

  if v_count<>v_distinct then
    raise exception 'PLAYER360_WELLNESS_DUPLICATE_METRIC';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_values) x
    where jsonb_typeof(x)<>'object'
       or not (x ? 'metric_code')
       or not (x ? 'value')
       or (x - 'metric_code' - 'value') <> '{}'::jsonb
  ) then
    raise exception 'PLAYER360_WELLNESS_VALUE_SHAPE_INVALID';
  end if;

  v_relation := public.iq_v4e_subject_relation(p_player_id);
  v_source_type := case
    when v_relation='SELF' then 'PLAYER_SELF_REPORT'
    when v_relation='GUARDIAN' then 'GUARDIAN_REPORT'
    else 'STAFF_MANUAL'
  end;

  if p_entry_id is null then
    if not public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,v_module,'CREATE',v_purpose
    ) then
      raise exception 'PLAYER360_WELLNESS_CREATE_DENIED';
    end if;

    insert into public.player360_wellness_entries(
      player_id,team_season_id,module,entry_date,purpose,source_type,
      captured_by,updated_by
    ) values (
      p_player_id,p_team_season_id,v_module,p_entry_date,v_purpose,v_source_type,
      auth.uid(),auth.uid()
    ) returning id into v_id;
  else
    select * into v_existing
    from public.player360_wellness_entries
    where id=p_entry_id
    for update;

    if v_existing.id is null then
      raise exception 'PLAYER360_WELLNESS_ENTRY_NOT_FOUND';
    end if;
    if v_existing.player_id<>p_player_id
       or v_existing.team_season_id<>p_team_season_id
       or v_existing.module<>v_module then
      raise exception 'PLAYER360_WELLNESS_ENTRY_SCOPE_MISMATCH';
    end if;
    if v_existing.status<>'ACTIVE' then
      raise exception 'PLAYER360_WELLNESS_ENTRY_ARCHIVED';
    end if;
    if not public.iq_v4e_can_access_sensitive_resource(
      p_player_id,p_team_season_id,v_module,'UPDATE',v_purpose
    ) then
      raise exception 'PLAYER360_WELLNESS_UPDATE_DENIED';
    end if;

    update public.player360_wellness_entries
    set entry_date=p_entry_date,
        purpose=v_purpose,
        updated_by=auth.uid()
    where id=p_entry_id;

    delete from public.player360_wellness_observations
    where entry_id=p_entry_id;

    v_id:=p_entry_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_values)
  loop
    v_metric_code:=upper(trim(v_item->>'metric_code'));

    select
      m.id,m.value_type,m.unit,m.min_value,m.max_value,m.step,m.options
      into v_metric_id,v_value_type,v_unit,v_min,v_max,v_step,v_options
    from public.player360_wellness_metric_catalog m
    where m.enabled
      and m.module=v_module
      and m.code=v_metric_code
      and (m.team_season_id is null or m.team_season_id=p_team_season_id)
    order by
      case when m.team_season_id=p_team_season_id then 0 else 1 end,
      m.created_at desc
    limit 1;

    if v_metric_id is null then
      raise exception 'PLAYER360_WELLNESS_METRIC_NOT_FOUND:%',v_metric_code;
    end if;

    v_numeric:=null;
    v_boolean:=null;
    v_choice:=null;

    if v_value_type in ('NUMBER','SCALE') then
      if jsonb_typeof(v_item->'value')<>'number' then
        raise exception 'PLAYER360_WELLNESS_NUMERIC_REQUIRED:%',v_metric_code;
      end if;
      v_numeric:=(v_item->>'value')::numeric;

      if v_min is not null and v_numeric<v_min then
        raise exception 'PLAYER360_WELLNESS_VALUE_BELOW_MIN:%',v_metric_code;
      end if;
      if v_max is not null and v_numeric>v_max then
        raise exception 'PLAYER360_WELLNESS_VALUE_ABOVE_MAX:%',v_metric_code;
      end if;
      if v_step is not null
         and mod(v_numeric-coalesce(v_min,0),v_step)<>0 then
        raise exception 'PLAYER360_WELLNESS_VALUE_STEP_INVALID:%',v_metric_code;
      end if;
    elsif v_value_type='BOOLEAN' then
      if jsonb_typeof(v_item->'value')<>'boolean' then
        raise exception 'PLAYER360_WELLNESS_BOOLEAN_REQUIRED:%',v_metric_code;
      end if;
      v_boolean:=(v_item->>'value')::boolean;
    elsif v_value_type='CHOICE' then
      if jsonb_typeof(v_item->'value')<>'string' then
        raise exception 'PLAYER360_WELLNESS_CHOICE_REQUIRED:%',v_metric_code;
      end if;
      v_choice:=upper(trim(v_item->>'value'));
      if not exists (
        select 1 from jsonb_array_elements_text(v_options) option_value
        where upper(trim(option_value))=v_choice
      ) then
        raise exception 'PLAYER360_WELLNESS_CHOICE_INVALID:%',v_metric_code;
      end if;
    else
      raise exception 'PLAYER360_WELLNESS_TYPE_UNSUPPORTED:%',v_metric_code;
    end if;

    insert into public.player360_wellness_observations(
      entry_id,metric_catalog_id,metric_code,value_type,
      numeric_value,boolean_value,choice_value,unit,quality
    ) values (
      v_id,v_metric_id,v_metric_code,v_value_type,
      v_numeric,v_boolean,v_choice,v_unit,1
    );
  end loop;

  return v_id;
end;
$iq4e2$;

-- -----------------------------------------------------------------------------
-- 7. Archive instead of physical delete
-- -----------------------------------------------------------------------------

create function public.iq_v4e2_archive_wellness_entry(
  p_entry_id uuid,
  p_purpose text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $iq4e2$
declare
  v_row public.player360_wellness_entries;
  v_purpose text := upper(trim(coalesce(p_purpose,'')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_row
  from public.player360_wellness_entries
  where id=p_entry_id
  for update;

  if v_row.id is null then
    raise exception 'PLAYER360_WELLNESS_ENTRY_NOT_FOUND';
  end if;
  if v_row.status='ARCHIVED' then return true; end if;

  if not public.iq_v4e_can_access_sensitive_resource(
    v_row.player_id,v_row.team_season_id,v_row.module,'UPDATE',v_purpose
  ) then
    raise exception 'PLAYER360_WELLNESS_ARCHIVE_DENIED';
  end if;

  update public.player360_wellness_entries
  set status='ARCHIVED',
      archived_by=auth.uid(),
      archived_at=now(),
      archive_reason_code='USER_ARCHIVE',
      updated_by=auth.uid()
  where id=p_entry_id;

  return true;
end;
$iq4e2$;

-- -----------------------------------------------------------------------------
-- 8. RLS / grants. All personal wellness rows remain RPC-only.
-- -----------------------------------------------------------------------------

alter table public.player360_wellness_metric_catalog enable row level security;
alter table public.player360_wellness_entries enable row level security;
alter table public.player360_wellness_observations enable row level security;

revoke all on table
  public.player360_wellness_metric_catalog,
  public.player360_wellness_entries,
  public.player360_wellness_observations
from public,anon,authenticated;

revoke all on function public.iq_v4e2_wellness_capabilities(uuid,uuid,text,text)
from public,anon,authenticated;
revoke all on function public.iq_v4e2_list_wellness_metric_catalog(uuid,text)
from public,anon,authenticated;
revoke all on function public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)
from public,anon,authenticated;
revoke all on function public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)
from public,anon,authenticated;
revoke all on function public.iq_v4e2_archive_wellness_entry(uuid,text)
from public,anon,authenticated;

grant execute on function public.iq_v4e2_wellness_capabilities(uuid,uuid,text,text)
to authenticated;
grant execute on function public.iq_v4e2_list_wellness_metric_catalog(uuid,text)
to authenticated;
grant execute on function public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)
to authenticated;
grant execute on function public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)
to authenticated;
grant execute on function public.iq_v4e2_archive_wellness_entry(uuid,text)
to authenticated;

do $iq4e2$
begin
  if has_table_privilege('authenticated','public.player360_wellness_entries','SELECT')
     or has_table_privilege('authenticated','public.player360_wellness_entries','INSERT')
     or has_table_privilege('authenticated','public.player360_wellness_observations','SELECT')
     or has_table_privilege('authenticated','public.player360_wellness_metric_catalog','SELECT') then
    raise exception 'PLAYER360_PHASE4E2_DIRECT_TABLE_ACCESS_OPEN';
  end if;

  if has_function_privilege(
       'anon',
       'public.iq_v4e2_list_wellness_entries(uuid,uuid,text,text,date,date,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'PLAYER360_PHASE4E2_ANON_RPC_OPEN';
  end if;
end
$iq4e2$;

commit;

select
  'PLAYER360_PHASE4E2_APPLY' as section,
  to_regclass('public.player360_wellness_metric_catalog') is not null as metric_catalog_ok,
  to_regclass('public.player360_wellness_entries') is not null as entries_ok,
  to_regclass('public.player360_wellness_observations') is not null as observations_ok,
  to_regprocedure('public.iq_v4e2_save_manual_wellness_entry(uuid,uuid,uuid,text,date,text,jsonb)') is not null as save_rpc_ok,
  (select count(*) from public.player360_wellness_metric_catalog where is_system)=9 as default_catalog_ok;
