-- =============================================================================
-- IQBasket Demo Universe V1 · Player 360 / Training / Wellness / AI evidence
-- SYNTHETIC / TEST-ONLY / REVERSIBLE
--
-- Completes the isolated demo team created by 20260904_apply_demo_universe_v1_core.sql.
-- No existing non-demo row is updated or deleted.
-- =============================================================================

begin;

do $demo$
declare
  v_test_user uuid;
  v_admin_user uuid;
begin
  if not exists (
    select 1 from public.team_seasons
    where id='d0000000-0000-4000-8000-000000000005'::uuid
  ) then
    raise exception 'DEMO_V1_CORE_REQUIRED';
  end if;

  if to_regclass('public.training_sessions') is null
     or to_regclass('public.training_blocks') is null
     or to_regclass('public.training_participants') is null
     or to_regclass('public.external_development_sessions') is null
     or to_regclass('public.player360_activity_types') is null
     or to_regclass('public.player_evaluations') is null
     or to_regclass('public.player_evaluation_scores') is null
     or to_regclass('public.player_objective_profiles') is null
     or to_regclass('public.player_objective_targets') is null
     or to_regclass('public.player360_wellness_metric_catalog') is null
     or to_regclass('public.player360_wellness_entries') is null
     or to_regclass('public.player360_wellness_observations') is null
     or to_regclass('public.player360_processing_authorizations') is null
     or to_regclass('public.player360_sensitive_access_grants') is null
     or to_regclass('public.player_longitudinal_snapshots') is null
     or to_regclass('public.player_ai_insights') is null then
    raise exception 'DEMO_V1_PLAYER360_PREREQUISITES_MISSING';
  end if;

  select id into v_test_user from public.user_profiles where lower(email)='test@test.com' limit 1;
  select id into v_admin_user from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1;

  if v_test_user is null then raise exception 'DEMO_V1_TEST_USER_MISSING'; end if;
  if v_admin_user is null then raise exception 'DEMO_V1_SUPERADMIN_MISSING'; end if;

  if not exists (
    select 1 from public.player360_wellness_metric_catalog
    where team_season_id is null and module='recovery' and code='DAILY_ENERGY' and enabled
  ) then
    raise exception 'DEMO_V1_DAILY_ENERGY_REQUIRED';
  end if;
end
$demo$;

-- -----------------------------------------------------------------------------
-- 1. Activity catalog
-- -----------------------------------------------------------------------------
insert into public.player360_activity_types(
  id,team_season_id,module,code,name,category,description,is_active,sort_order
) values
('d1000000-0000-4000-8000-000000000001'::uuid,'d0000000-0000-4000-8000-000000000005'::uuid,'TRAINING','TEAM_TACTICAL','Táctica colectiva','TEAM','Trabajo sintético de sistemas y lectura colectiva.',true,10),
('d1000000-0000-4000-8000-000000000002'::uuid,'d0000000-0000-4000-8000-000000000005'::uuid,'TRAINING','SKILL_FINISHING','Finalizaciones','TECHNICAL','Finalizaciones y toma de decisión cerca del aro.',true,20),
('d1000000-0000-4000-8000-000000000003'::uuid,'d0000000-0000-4000-8000-000000000005'::uuid,'TRAINING','SHOOTING','Tiro contextual','TECHNICAL','Volumen de tiro con contexto de juego.',true,30),
('d1000000-0000-4000-8000-000000000004'::uuid,'d0000000-0000-4000-8000-000000000005'::uuid,'TRAINING','CONDITIONING','Condición específica','PHYSICAL','Carga física integrada con balón.',true,40),
('d1000000-0000-4000-8000-000000000005'::uuid,'d0000000-0000-4000-8000-000000000005'::uuid,'EXTERNAL_DEVELOPMENT','INDIVIDUAL_SKILL','Tecnificación individual','TECHNICAL','Sesión externa de tecnificación sintética.',true,10),
('d1000000-0000-4000-8000-000000000006'::uuid,'d0000000-0000-4000-8000-000000000005'::uuid,'EXTERNAL_DEVELOPMENT','SPEED_AGILITY','Velocidad y agilidad','PHYSICAL','Trabajo externo sintético de aceleración y cambio de dirección.',true,20);

-- -----------------------------------------------------------------------------
-- 2. Twenty-four completed team training sessions over ~10 weeks
-- -----------------------------------------------------------------------------
with seed as (
  select gs as idx,
         current_date - (72 - gs*3) as session_date
  from generate_series(0,23) gs
)
insert into public.training_sessions(
  id,team_season_id,session_date,start_time,end_time,title,objective,
  duration_minutes,intensity,status,notes,metadata,created_by,updated_by
)
select
  ('d2000000-0000-4000-8000-' || lpad((idx+1)::text,12,'0'))::uuid,
  'd0000000-0000-4000-8000-000000000005'::uuid,
  session_date,
  '18:30'::time,
  '20:00'::time,
  'Entrenamiento Demo ' || (idx+1),
  case (idx % 4)
    when 0 then 'Construir ventajas desde bloqueo directo y ocupación de espacios.'
    when 1 then 'Mejorar finalización bajo contacto y lectura del último defensor.'
    when 2 then 'Aumentar calidad de tiro tras pase y tras bote.'
    else 'Sostener intensidad defensiva y transición durante esfuerzos repetidos.'
  end,
  90,
  (5.5 + (idx % 5)*0.5)::numeric,
  'COMPLETED',
  'Sesión sintética · IQBasket Demo Universe V1',
  jsonb_build_object('demo',true,'seed_version','DEMO_V1','session_index',idx+1),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from seed;

insert into public.training_blocks(
  training_session_id,activity_type_id,block_order,activity_code,title,objective,
  duration_minutes,intensity,metadata
)
select s.id,a.id,b.block_order,a.code,
       case b.block_order when 1 then 'Activación + fundamentos' when 2 then 'Bloque principal' else 'Juego condicionado' end,
       case b.block_order when 1 then 'Preparar patrones motores y técnicos.' when 2 then 'Desarrollar el objetivo principal de la sesión.' else 'Transferir el objetivo a decisiones con oposición.' end,
       case b.block_order when 1 then 20 when 2 then 40 else 30 end,
       case b.block_order when 1 then greatest(3,s.intensity-2) when 2 then s.intensity else greatest(4,s.intensity-0.5) end,
       jsonb_build_object('demo',true,'block',b.block_order)
from public.training_sessions s
cross join lateral (values (1),(2),(3)) b(block_order)
join public.player360_activity_types a
  on a.team_season_id=s.team_season_id
 and a.module='TRAINING'
 and a.code = case b.block_order
   when 1 then 'SHOOTING'
   when 2 then case extract(day from s.session_date)::int % 2 when 0 then 'TEAM_TACTICAL' else 'SKILL_FINISHING' end
   else 'CONDITIONING'
 end
where s.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

with ranked_players as (
  select p.id,row_number() over(order by p.jersey,p.id)::int as pi
  from public.players p
  where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid
), ranked_sessions as (
  select s.id,s.team_season_id,s.session_date,
         row_number() over(order by s.session_date,s.id)::int as si
  from public.training_sessions s
  where s.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
)
insert into public.training_participants(
  training_session_id,team_season_id,player_id,attendance_status,
  participated_minutes,rpe,notes,captured_by
)
select rs.id,rs.team_season_id,rp.id,
       case
         when ((rp.pi*7 + rs.si) % 29)=0 then 'ABSENT'
         when ((rp.pi*5 + rs.si) % 17)=0 then 'EXCUSED'
         when ((rp.pi*3 + rs.si) % 13)=0 then 'PARTIAL'
         else 'PRESENT'
       end,
       case
         when ((rp.pi*7 + rs.si) % 29)=0 or ((rp.pi*5 + rs.si) % 17)=0 then 0
         when ((rp.pi*3 + rs.si) % 13)=0 then 60
         else 90
       end,
       case
         when ((rp.pi*7 + rs.si) % 29)=0 or ((rp.pi*5 + rs.si) % 17)=0 then null
         else (4.5 + ((rp.pi+rs.si)%7)*0.5)::numeric
       end,
       'Participación sintética para demo',
       (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from ranked_sessions rs cross join ranked_players rp;

-- -----------------------------------------------------------------------------
-- 3. External individual development for six rotating players
-- -----------------------------------------------------------------------------
with rp as (
  select p.id,row_number() over(order by p.jersey,p.id)::int as pi
  from public.players p
  where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid
  order by p.jersey,p.id
  limit 6
), x as (
  select rp.*,gs as wi from rp cross join generate_series(0,3) gs
)
insert into public.external_development_sessions(
  team_season_id,player_id,activity_type_id,activity_date,title,activity_code,
  provider_type,provider_name,objective,duration_minutes,intensity,rpe,source_type,
  notes,provenance,metadata,created_by,updated_by
)
select
  'd0000000-0000-4000-8000-000000000005'::uuid,
  x.id,
  case when x.pi % 2=0 then 'd1000000-0000-4000-8000-000000000006'::uuid else 'd1000000-0000-4000-8000-000000000005'::uuid end,
  current_date - (60 - x.wi*10 - x.pi),
  case when x.pi % 2=0 then 'Sesión externa de velocidad y agilidad' else 'Tecnificación individual demo' end,
  case when x.pi % 2=0 then 'SPEED_AGILITY' else 'INDIVIDUAL_SKILL' end,
  'ACADEMY',
  'Demo Skills Lab',
  case when x.pi % 2=0 then 'Aceleración, frenada y cambio de dirección.' else 'Finalización, manejo y tiro tras bote.' end,
  60,
  (6 + (x.pi%3)*0.5)::numeric,
  (5.5 + ((x.pi+x.wi)%4)*0.5)::numeric,
  'EXTERNAL_COACH',
  'Dato sintético de demostración.',
  jsonb_build_object('source','DEMO_V1','synthetic',true),
  jsonb_build_object('demo',true,'week_index',x.wi+1),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from x;

-- -----------------------------------------------------------------------------
-- 4. Human evaluations + objective profiles
-- -----------------------------------------------------------------------------
insert into public.player_evaluations(
  team_season_id,player_id,evaluation_date,title,evaluation_type,source_type,
  evaluator_user_id,evaluator_name,summary,strengths,development_priorities,
  is_private,share_with_player,status,provenance,metadata,created_by,updated_by
)
select
  'd0000000-0000-4000-8000-000000000005'::uuid,
  p.id,
  current_date-5,
  'Evaluación integral Demo',
  'GENERAL',
  'CLUB_COACH',
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
  'Staff Demo',
  'Perfil sintético equilibrado con fortalezas y áreas de desarrollo diferenciadas.',
  case when p.jersey % 3=0 then 'Lectura, pase y ritmo.' when p.jersey % 3=1 then 'Tiro, spacing y disciplina.' else 'Defensa, rebote y contacto.' end,
  case when p.jersey % 3=0 then 'Finalización y defensa del bloqueo.' when p.jersey % 3=1 then 'Toma de decisión bajo presión.' else 'Creación con balón y tiro exterior.' end,
  false,
  true,
  'CURRENT',
  jsonb_build_object('source','DEMO_V1','synthetic',true),
  jsonb_build_object('demo',true),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from public.players p
where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid;

insert into public.player_evaluation_scores(
  evaluation_id,team_season_id,metric_definition_id,metric_code,domain_code,
  metric_name,scale_min,scale_max,higher_is_better,score,confidence,notes,evidence,metadata
)
select e.id,e.team_season_id,m.id,m.code,m.domain_code,m.name,m.scale_min,m.scale_max,
       m.higher_is_better,
       least(m.scale_max,greatest(m.scale_min,5.5 + ((p.jersey + m.sort_order/10)::int % 7)*0.5)),
       0.85,
       'Puntuación sintética para demo.',
       'Entrenamientos y partidos sintéticos del universo demo.',
       jsonb_build_object('demo',true)
from public.player_evaluations e
join public.players p on p.id=e.player_id
join public.player360_evaluation_metrics m
  on m.team_season_id is null
 and m.code in ('BALL_HANDLING','SHOOTING','DECISION_MAKING','TEAM_DEFENSE','EXPLOSIVENESS')
where e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid;

insert into public.player_objective_profiles(
  team_season_id,player_id,effective_date,target_date,title,rationale,status,
  provenance,metadata,created_by,updated_by
)
select
  'd0000000-0000-4000-8000-000000000005'::uuid,
  p.id,
  current_date-4,
  current_date+120,
  'Objetivo de desarrollo Demo',
  'Priorizar una mejora medible y equilibrada durante el siguiente bloque de trabajo.',
  'ACTIVE',
  jsonb_build_object('source','DEMO_V1','synthetic',true),
  jsonb_build_object('demo',true),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from public.players p
where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid;

insert into public.player_objective_targets(
  profile_id,team_season_id,metric_definition_id,metric_code,domain_code,metric_name,
  scale_min,scale_max,higher_is_better,target_score,priority_weight,notes,metadata
)
select op.id,op.team_season_id,m.id,m.code,m.domain_code,m.name,m.scale_min,m.scale_max,
       m.higher_is_better,
       least(m.scale_max,8.0 + ((p.jersey+m.sort_order/10)::int % 3)*0.5),
       case m.code when 'DECISION_MAKING' then 3 when 'SHOOTING' then 2 else 1 end,
       'Objetivo sintético V1',
       jsonb_build_object('demo',true)
from public.player_objective_profiles op
join public.players p on p.id=op.player_id
join public.player360_evaluation_metrics m
  on m.team_season_id is null and m.code in ('SHOOTING','DECISION_MAKING','EXPLOSIVENESS')
where op.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  and op.status='ACTIVE';

-- -----------------------------------------------------------------------------
-- 5. Synthetic privacy authorization for this isolated non-personal dataset
-- -----------------------------------------------------------------------------
insert into public.player360_processing_authorizations(
  player_id,team_season_id,modules,purposes,authorization_type,legal_basis_code,
  special_category_condition_code,ai_processing_allowed,representative_user_id,
  evidence_reference,status,valid_from,valid_until,recorded_by
)
select
  p.id,
  'd0000000-0000-4000-8000-000000000005'::uuid,
  array['nutrition','recovery']::text[],
  array['SPORT_PERFORMANCE']::text[],
  'OTHER_DOCUMENTED_BASIS',
  'SYNTHETIC_DEMO_NON_PERSONAL',
  'SYNTHETIC_TEST_DATA',
  true,
  null,
  'IQBasket Demo Universe V1 · synthetic data only',
  'ACTIVE',
  now()-interval '1 day',
  now()+interval '365 days',
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from public.players p
where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid;

insert into public.player360_sensitive_access_grants(
  user_id,player_id,team_season_id,request_id,modules,actions,purposes,status,
  valid_from,valid_until,granted_by,grant_reason
)
select
  u.id,p.id,'d0000000-0000-4000-8000-000000000005'::uuid,null,
  array['nutrition','recovery']::text[],
  case when lower(u.email)='scolado@nechigroup.com'
       then array['READ','AI_PROCESS']::text[]
       else array['READ']::text[] end,
  array['SPORT_PERFORMANCE']::text[],
  'ACTIVE',now()-interval '1 day',now()+interval '365 days',
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
  'Synthetic demo universe access; no real personal data.'
from public.players p
cross join public.user_profiles u
where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid
  and lower(u.email) in ('test@test.com','scolado@nechigroup.com');

-- -----------------------------------------------------------------------------
-- 6. Twenty-eight days of compact Recovery + Nutrition check-ins
-- -----------------------------------------------------------------------------
with days as (
  select gs as di,current_date-(28-gs) as entry_date from generate_series(1,28) gs
), players as (
  select p.id,p.jersey,row_number() over(order by p.jersey,p.id)::int as pi
  from public.players p
  where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid
)
insert into public.player360_wellness_entries(
  player_id,team_season_id,module,entry_date,purpose,source_type,captured_by,status,updated_by
)
select p.id,'d0000000-0000-4000-8000-000000000005'::uuid,m.module,d.entry_date,
       'SPORT_PERFORMANCE','STAFF_MANUAL',
       (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1),
       'ACTIVE',
       (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from days d cross join players p cross join (values ('recovery'),('nutrition')) m(module);

-- Recovery numeric/scale metrics
insert into public.player360_wellness_observations(
  entry_id,metric_catalog_id,metric_code,value_type,numeric_value,boolean_value,choice_value,unit,quality
)
select e.id,c.id,c.code,c.value_type,
       case c.code
         when 'SLEEP_DURATION_HOURS' then (6.5 + ((p.jersey + extract(day from e.entry_date)::int)%7)*0.25)::numeric
         when 'SLEEP_QUALITY' then (3 + ((p.jersey + extract(day from e.entry_date)::int)%3))::numeric
         when 'FATIGUE' then (2 + ((p.jersey*2 + extract(day from e.entry_date)::int)%4))::numeric
         when 'MUSCLE_SORENESS' then (1 + ((p.jersey + extract(day from e.entry_date)::int)%4))::numeric
         when 'READINESS' then (3 + ((p.jersey + 2*extract(day from e.entry_date)::int)%3))::numeric
         when 'DAILY_ENERGY' then (3 + ((p.jersey*3 + extract(day from e.entry_date)::int)%3))::numeric
       end,
       null,null,c.unit,0.95
from public.player360_wellness_entries e
join public.players p on p.id=e.player_id
join public.player360_wellness_metric_catalog c
  on c.team_season_id is null
 and c.module='recovery'
 and c.code in ('SLEEP_DURATION_HOURS','SLEEP_QUALITY','FATIGUE','MUSCLE_SORENESS','READINESS','DAILY_ENERGY')
 and c.enabled
where e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  and e.module='recovery';

-- Nutrition scale metrics
insert into public.player360_wellness_observations(
  entry_id,metric_catalog_id,metric_code,value_type,numeric_value,boolean_value,choice_value,unit,quality
)
select e.id,c.id,c.code,c.value_type,
       (3 + ((p.jersey + extract(day from e.entry_date)::int + c.sort_order)%3))::numeric,
       null,null,c.unit,0.95
from public.player360_wellness_entries e
join public.players p on p.id=e.player_id
join public.player360_wellness_metric_catalog c
  on c.team_season_id is null
 and c.module='nutrition'
 and c.code in ('HYDRATION_ADHERENCE','MEAL_REGULARITY')
 and c.enabled
where e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  and e.module='nutrition';

-- Nutrition boolean adherence metrics
insert into public.player360_wellness_observations(
  entry_id,metric_catalog_id,metric_code,value_type,numeric_value,boolean_value,choice_value,unit,quality
)
select e.id,c.id,c.code,c.value_type,null,
       ((p.jersey + extract(day from e.entry_date)::int + c.sort_order) % 5) <> 0,
       null,c.unit,0.95
from public.player360_wellness_entries e
join public.players p on p.id=e.player_id
join public.player360_wellness_metric_catalog c
  on c.team_season_id is null
 and c.module='nutrition'
 and c.code in ('PRE_TRAINING_FUELING','POST_TRAINING_RECOVERY')
 and c.enabled
where e.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  and e.module='nutrition';

-- -----------------------------------------------------------------------------
-- 7. Deterministic longitudinal snapshot + synthetic DRAFT insight
-- No LLM/API call is made here.
-- -----------------------------------------------------------------------------
insert into public.player_longitudinal_snapshots(
  team_season_id,player_id,period_start,period_end,bucket_unit,contract_version,
  calculation_version,source_revision,source_fingerprint,rejected_observations,
  snapshot,evidence_bundle,generated_by
)
select
  'd0000000-0000-4000-8000-000000000005'::uuid,
  p.id,current_date-28,current_date-1,'WEEK','PLAYER360_LONGITUDINAL_V1',
  'DEMO_V1','SYNTHETIC_FIXTURE_V1','demo-v1-'||p.id::text,0,
  jsonb_build_object(
    'demo',true,
    'summary',jsonb_build_object(
      'games',12,
      'training_window_days',28,
      'readiness_trend',case when p.jersey%3=0 then 'UP' when p.jersey%3=1 then 'STABLE' else 'DOWN' end,
      'development_signal',case when p.jersey%2=0 then 'SHOOTING' else 'DECISION_MAKING' end
    )
  ),
  jsonb_build_object(
    'synthetic',true,
    'sources',jsonb_build_array('games','training','evaluation','wellness'),
    'disclaimer','Synthetic demo evidence; no causal or clinical inference.'
  ),
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from public.players p
where p.team_id='d0000000-0000-4000-8000-000000000002'::uuid;

insert into public.player_ai_insights(
  snapshot_id,team_season_id,player_id,audience,locale,provider,model_name,prompt_version,
  evidence_version,content,status,requested_by
)
select
  s.id,s.team_season_id,s.player_id,'STAFF','es','SYNTHETIC_DEMO','NO_LLM_CALLED',
  'DEMO_PROMPT_V1','PLAYER360_EVIDENCE_V1',
  jsonb_build_object(
    'headline','Insight sintético pendiente de revisión',
    'summary','El dataset demo contiene señales suficientes para probar el flujo de interpretación sin utilizar un LLM externo.',
    'observations',jsonb_build_array(
      'Revisar tendencia 7/28 días junto con la carga de entrenamiento.',
      'Contrastar rendimiento de partido con la evaluación humana.'
    ),
    'recommendations',jsonb_build_array(
      'Mantener revisión humana antes de aprobar cualquier interpretación.',
      'No interpretar asociaciones descriptivas como causalidad.'
    ),
    'disclaimer','Contenido sintético de QA. No diagnóstico, no causalidad y no generado por un LLM.'
  ),
  'DRAFT',
  (select id from public.user_profiles where lower(email)='scolado@nechigroup.com' limit 1)
from public.player_longitudinal_snapshots s
where s.team_season_id='d0000000-0000-4000-8000-000000000005'::uuid
  and s.calculation_version='DEMO_V1';

commit;
