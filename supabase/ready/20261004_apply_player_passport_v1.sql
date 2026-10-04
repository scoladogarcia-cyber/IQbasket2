-- IQBasket Player Passport V1
-- Additive evolution of Player 360 / Phase 4C. No legacy 0-10 conversion.
begin;

do $preflight$
begin
  if to_regclass('public.player360_evaluation_metrics') is null
     or to_regclass('public.player_evaluations') is null
     or to_regclass('public.player_evaluation_scores') is null
     or to_regclass('public.saas_entitlement_catalog') is null
     or to_regprocedure('public.iq_v4_save_player_evaluation(uuid,uuid,date,text,text,text,text,text,text,text,boolean,boolean,jsonb,jsonb,jsonb,uuid)') is null
     or to_regprocedure('public.iq_saas_entitlement_check(text,uuid,uuid,text,integer)') is null
     or to_regprocedure('public.iq_v3_is_global_superadmin()') is null
     or to_regprocedure('public.iq_account_is_active()') is null then
    raise exception 'PLAYER_PASSPORT_V1_PREREQUISITES_MISSING';
  end if;
end
$preflight$;

insert into public.saas_entitlement_catalog(code,name,description,category,value_type,default_boolean,is_active)
values('PLAYER_PASSPORT','Player Passport','Longitudinal 69-attribute player passport, rubric evidence and objective measurements.','DEVELOPMENT','BOOLEAN',false,true)
on conflict (code) do update set
  name=excluded.name,description=excluded.description,category=excluded.category,
  value_type='BOOLEAN',default_boolean=false,is_active=true,updated_at=now();

insert into public.saas_plan_entitlements(plan_id,entitlement_code,beneficiary_scope,boolean_value)
select p.id,'PLAYER_PASSPORT','ALL_AUTHORIZED',true
from public.saas_plans p
where p.code='INTERNAL_FULL'
on conflict (plan_id,entitlement_code) do update
set beneficiary_scope='ALL_AUTHORIZED',boolean_value=true,updated_at=now();

create table if not exists public.player360_evaluation_rubrics(
  id uuid primary key default gen_random_uuid(),
  metric_definition_id uuid not null references public.player360_evaluation_metrics(id) on delete restrict,
  rubric_version text not null,
  definition text not null,
  observation_guide text,
  do_not_rate_by text,
  min_evidence integer not null default 0 check(min_evidence>=0),
  introduction_stage text,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','REVIEW','RETIRED')),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(metric_definition_id,rubric_version)
);

create table if not exists public.player360_evaluation_rubric_anchors(
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.player360_evaluation_rubrics(id) on delete cascade,
  level smallint not null check(level between 1 and 5),
  label text not null,
  criteria text not null,
  created_at timestamptz not null default now(),
  unique(rubric_id,level)
);

alter table public.player_evaluation_scores
  add column if not exists rubric_id uuid references public.player360_evaluation_rubrics(id) on delete set null,
  add column if not exists evaluation_context text,
  add column if not exists evidence_count integer,
  add column if not exists confidence_label text;

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conname='player_eval_scores_context_check') then
    alter table public.player_evaluation_scores add constraint player_eval_scores_context_check
      check(evaluation_context is null or evaluation_context in ('T','JR','P5','VIDEO'));
  end if;
  if not exists(select 1 from pg_constraint where conname='player_eval_scores_evidence_count_check') then
    alter table public.player_evaluation_scores add constraint player_eval_scores_evidence_count_check
      check(evidence_count is null or evidence_count>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='player_eval_scores_confidence_label_check') then
    alter table public.player_evaluation_scores add constraint player_eval_scores_confidence_label_check
      check(confidence_label is null or confidence_label in ('LOW','MEDIUM','HIGH'));
  end if;
end
$constraints$;

create table if not exists public.player_evaluation_evidence(
  id uuid primary key default gen_random_uuid(),
  evaluation_score_id uuid not null references public.player_evaluation_scores(id) on delete cascade,
  evidence_type text not null check(evidence_type in ('GAME','TRAINING','VIDEO','NOTE')),
  game_id uuid references public.games(id) on delete set null,
  training_session_id uuid references public.training_sessions(id) on delete set null,
  video_url text,
  timecode_seconds numeric(10,3),
  note text,
  decision_score smallint check(decision_score is null or decision_score between 1 and 5),
  execution_score smallint check(execution_score is null or execution_score between 1 and 5),
  result_code text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.player360_measurements(
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  team_season_id uuid references public.team_seasons(id) on delete restrict,
  test_code text not null,
  value numeric(12,4) not null,
  unit text not null,
  measured_at timestamptz not null,
  protocol_code text,
  protocol_version text,
  notes text,
  source_type text not null default 'STAFF',
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(length(trim(test_code))>0),
  check(length(trim(unit))>0)
);
create index if not exists idx_player360_measurements_player_date
  on public.player360_measurements(player_id,measured_at desc);

insert into public.player360_evaluation_metrics(
  team_season_id,code,domain_code,name,description,scale_min,scale_max,scale_step,
  higher_is_better,sensitivity,is_active,sort_order
)
select * from (values
  (null,'TEC-BOT-01','TECHNICAL','Bote mano derecha','Capacidad para controlar y utilizar funcionalmente la mano derecha durante el bote.',1,5,1,true,'PRIVATE_SPORTING',true,10),
  (null,'TEC-BOT-02','TECHNICAL','Bote mano izquierda','Capacidad para controlar y utilizar funcionalmente la mano izquierda durante el bote.',1,5,1,true,'PRIVATE_SPORTING',true,20),
  (null,'TEC-BOT-03','TECHNICAL','Control a velocidad','Capacidad para mantener control técnico del balón al desplazarse a alta velocidad.',1,5,1,true,'PRIVATE_SPORTING',true,30),
  (null,'TEC-BOT-04','TECHNICAL','Protección de balón','Capacidad para conservar la posesión frente a presión, contacto y manos defensivas activas.',1,5,1,true,'PRIVATE_SPORTING',true,40),
  (null,'TEC-BOT-05','TECHNICAL','Cambio de dirección','Capacidad para modificar eficazmente la trayectoria de desplazamiento con balón.',1,5,1,true,'PRIVATE_SPORTING',true,50),
  (null,'TEC-BOT-06','TECHNICAL','Cambio de ritmo','Capacidad para variar velocidad y cadencia del bote para generar o ampliar ventaja.',1,5,1,true,'PRIVATE_SPORTING',true,60),
  (null,'TEC-BOT-07','TECHNICAL','Manipulación con bote','Capacidad para utilizar bote, mirada, cuerpo, ángulos y ritmo para provocar una respuesta defensiva.',1,5,1,true,'PRIVATE_SPORTING',true,70),
  (null,'TEC-PAS-01','TECHNICAL','Pase mano derecha','Capacidad para ejecutar pases funcionales con la mano derecha desde diferentes posiciones y ángulos.',1,5,1,true,'PRIVATE_SPORTING',true,80),
  (null,'TEC-PAS-02','TECHNICAL','Pase mano izquierda','Capacidad para ejecutar pases funcionales con la mano izquierda desde diferentes posiciones y ángulos.',1,5,1,true,'PRIVATE_SPORTING',true,90),
  (null,'TEC-PAS-03','TECHNICAL','Precisión del pase','Capacidad para entregar el balón en el punto que facilita la siguiente acción del receptor.',1,5,1,true,'PRIVATE_SPORTING',true,100),
  (null,'TEC-PAS-04','TECHNICAL','Pase sobre bote','Capacidad para pasar directamente desde el bote sin detener o reorganizar innecesariamente la acción.',1,5,1,true,'PRIVATE_SPORTING',true,110),
  (null,'TEC-PAS-05','TECHNICAL','Pase bajo presión','Capacidad para mantener calidad técnica de pase ante presión física, manos activas y espacios reducidos.',1,5,1,true,'PRIVATE_SPORTING',true,120),
  (null,'TEC-PAS-06','TECHNICAL','Recepción y preparación','Capacidad para recibir asegurando el balón y quedar preparado para la siguiente acción.',1,5,1,true,'PRIVATE_SPORTING',true,130),
  (null,'TEC-FIN-01','TECHNICAL','Finalización mano derecha','Capacidad para finalizar cerca del aro utilizando la mano derecha de forma funcional.',1,5,1,true,'PRIVATE_SPORTING',true,140),
  (null,'TEC-FIN-02','TECHNICAL','Finalización mano izquierda','Capacidad para finalizar cerca del aro utilizando la mano izquierda de forma funcional.',1,5,1,true,'PRIVATE_SPORTING',true,150),
  (null,'TEC-FIN-03','TECHNICAL','Finalización con contacto','Capacidad para mantener control y calidad de finalización cuando existe contacto legal o desequilibrio provocado por el defensor.',1,5,1,true,'PRIVATE_SPORTING',true,160),
  (null,'TEC-FIN-04','TECHNICAL','Ángulos y evitación de contacto','Capacidad para utilizar extensión, aro, tablero, altura y trayectoria para evitar al protector del aro.',1,5,1,true,'PRIVATE_SPORTING',true,170),
  (null,'TEC-FIN-05','TECHNICAL','Juego de pies en finalización','Capacidad para organizar apoyos, paradas y pasos de forma legal y eficiente al finalizar.',1,5,1,true,'PRIVATE_SPORTING',true,180),
  (null,'TEC-FIN-06','TECHNICAL','Finalización en transición','Capacidad para resolver cerca del aro a alta velocidad y con defensores en recuperación.',1,5,1,true,'PRIVATE_SPORTING',true,190),
  (null,'TEC-TIR-01','TECHNICAL','Mecánica y repetibilidad','Capacidad para reproducir un patrón de tiro estable y eficiente compatible con su desarrollo individual.',1,5,1,true,'PRIVATE_SPORTING',true,200),
  (null,'TEC-TIR-02','TECHNICAL','Preparación de tiro','Capacidad para estar física y perceptivamente preparado antes de recibir.',1,5,1,true,'PRIVATE_SPORTING',true,210),
  (null,'TEC-TIR-03','TECHNICAL','Catch & shoot','Capacidad para lanzar tras recepción con equilibrio, velocidad y estabilidad técnica.',1,5,1,true,'PRIVATE_SPORTING',true,220),
  (null,'TEC-TIR-04','TECHNICAL','Tiro tras bote','Capacidad para generar y ejecutar un lanzamiento estable después de botar.',1,5,1,true,'PRIVATE_SPORTING',true,230),
  (null,'TEC-TIR-05','TECHNICAL','Tiro en movimiento','Capacidad para lanzar tras desplazamientos sin balón o recepciones dinámicas.',1,5,1,true,'PRIVATE_SPORTING',true,240),
  (null,'TEC-TIR-06','TECHNICAL','Estabilidad del tiro bajo presión','Capacidad para conservar calidad técnica y selección cuando existe oposición, fatiga o presión competitiva.',1,5,1,true,'PRIVATE_SPORTING',true,250),
  (null,'TAC-OF-01','TACTICAL','Escaneo previo','Capacidad para obtener información relevante antes de recibir o intervenir.',1,5,1,true,'PRIVATE_SPORTING',true,260),
  (null,'TAC-OF-02','TACTICAL','Percepción de ventaja','Capacidad para detectar una ventaja ofensiva existente o incipiente a tiempo de explotarla.',1,5,1,true,'PRIVATE_SPORTING',true,270),
  (null,'TAC-OF-03','TACTICAL','Reconocimiento y ocupación del espacio','Capacidad para identificar, ocupar y liberar espacios que mejoran el ataque.',1,5,1,true,'PRIVATE_SPORTING',true,280),
  (null,'TAC-OF-04','TACTICAL','Selección de pase','Capacidad para escoger receptor, momento y tipo de pase adecuados.',1,5,1,true,'PRIVATE_SPORTING',true,290),
  (null,'TAC-OF-05','TACTICAL','Selección de tiro','Capacidad para diferenciar un lanzamiento de alto valor de uno simplemente disponible.',1,5,1,true,'PRIVATE_SPORTING',true,300),
  (null,'TAC-OF-06','TACTICAL','Decisión penetrar–pasar–tirar','Capacidad para seleccionar rápidamente entre atacar aro, pasar o lanzar.',1,5,1,true,'PRIVATE_SPORTING',true,310),
  (null,'TAC-OF-07','TACTICAL','Decisiones en transición','Capacidad para resolver ventajas y desventajas en campo abierto.',1,5,1,true,'PRIVATE_SPORTING',true,320),
  (null,'TAC-OF-08','TACTICAL','Lectura de bloqueo directo','Capacidad para reconocer y atacar coberturas de pick-and-roll/pick-and-pop.',1,5,1,true,'PRIVATE_SPORTING',true,330),
  (null,'TAC-OF-09','TACTICAL','Lectura de bloqueos indirectos','Capacidad para interpretar la defensa en acciones sin balón con bloqueos.',1,5,1,true,'PRIVATE_SPORTING',true,340),
  (null,'TAC-OF-10','TACTICAL','Juego sin balón','Capacidad para generar valor ofensivo cuando no posee el balón.',1,5,1,true,'PRIVATE_SPORTING',true,350),
  (null,'TAC-OF-11','TACTICAL','Creación y mantenimiento de ventaja','Capacidad para crear una ventaja o evitar que una ventaja existente desaparezca.',1,5,1,true,'PRIVATE_SPORTING',true,360),
  (null,'TAC-OF-12','TACTICAL','Gestión del ritmo y adaptación','Capacidad para acelerar, pausar, reorganizar o cambiar solución según el estado de la posesión.',1,5,1,true,'PRIVATE_SPORTING',true,370),
  (null,'DEF-01','DEFENSE','Base y desplazamiento defensivo','Capacidad para mantener una posición corporal que permita reaccionar eficientemente.',1,5,1,true,'PRIVATE_SPORTING',true,380),
  (null,'DEF-02','DEFENSE','Defensa 1x1 exterior','Capacidad para contener al atacante con balón en espacio exterior.',1,5,1,true,'PRIVATE_SPORTING',true,390),
  (null,'DEF-03','DEFENSE','Contención de penetración','Capacidad para detener o desviar una penetración antes de que genere ventaja profunda.',1,5,1,true,'PRIVATE_SPORTING',true,400),
  (null,'DEF-04','DEFENSE','Presión al balón y uso de manos','Capacidad para incomodar al manejador sin perder equilibrio ni cometer faltas evitables.',1,5,1,true,'PRIVATE_SPORTING',true,410),
  (null,'DEF-05','DEFENSE','Closeout','Capacidad para recuperar hasta un tirador controlando simultáneamente tiro y penetración.',1,5,1,true,'PRIVATE_SPORTING',true,420),
  (null,'DEF-06','DEFENSE','Posición defensiva sin balón','Capacidad para mantener una relación útil entre balón, atacante propio, aro y espacio.',1,5,1,true,'PRIVATE_SPORTING',true,430),
  (null,'DEF-07','DEFENSE','Ayuda defensiva','Capacidad para intervenir sobre una ventaja rival en el momento y profundidad adecuados.',1,5,1,true,'PRIVATE_SPORTING',true,440),
  (null,'DEF-08','DEFENSE','Rotación defensiva','Capacidad para asumir la siguiente responsabilidad cuando un compañero ayuda o es superado.',1,5,1,true,'PRIVATE_SPORTING',true,450),
  (null,'DEF-09','DEFENSE','Recuperación defensiva','Capacidad para volver a una responsabilidad útil después de ayudar, presionar o quedar desplazado.',1,5,1,true,'PRIVATE_SPORTING',true,460),
  (null,'DEF-10','DEFENSE','Navegación de bloqueos','Capacidad para atravesar o rodear bloqueos manteniendo conexión con la acción.',1,5,1,true,'PRIVATE_SPORTING',true,470),
  (null,'DEF-11','DEFENSE','Defensa del bloqueo directo','Capacidad para ejecutar su responsabilidad en las distintas coberturas de pick-and-roll.',1,5,1,true,'PRIVATE_SPORTING',true,480),
  (null,'DEF-12','DEFENSE','Defensa en transición','Capacidad para organizarse al perder la posesión y reducir ventaja rival.',1,5,1,true,'PRIVATE_SPORTING',true,490),
  (null,'DEF-13','DEFENSE','Versatilidad defensiva','Capacidad para defender eficazmente perfiles ofensivos diferentes.',1,5,1,true,'PRIVATE_SPORTING',true,500),
  (null,'DEF-14','DEFENSE','Box-out','Capacidad para localizar, contactar y controlar al rival antes de perseguir el rebote.',1,5,1,true,'PRIVATE_SPORTING',true,510),
  (null,'DEF-15','DEFENSE','Rebote defensivo','Capacidad para finalizar la posesión capturando o asegurando el rebote defensivo.',1,5,1,true,'PRIVATE_SPORTING',true,520),
  (null,'DEF-16','DEFENSE','Comunicación defensiva','Capacidad para proporcionar información defensiva útil, anticipada y accionable.',1,5,1,true,'PRIVATE_SPORTING',true,530),
  (null,'DEF-17','DEFENSE','Anticipación defensiva','Capacidad para prever la acción probable a partir de señales del juego sin abandonar responsabilidades.',1,5,1,true,'PRIVATE_SPORTING',true,540),
  (null,'MEN-01','MENTAL','Atención a información relevante','Capacidad para mantener y dirigir la atención hacia las claves útiles de tarea y juego.',1,5,1,true,'PRIVATE_SPORTING',true,550),
  (null,'MEN-02','MENTAL','Reacción al error','Calidad de la conducta inmediatamente posterior a un error propio.',1,5,1,true,'PRIVATE_SPORTING',true,560),
  (null,'MEN-03','MENTAL','Compostura bajo presión','Capacidad para conservar calidad conductual y decisional en situaciones de presión competitiva.',1,5,1,true,'PRIVATE_SPORTING',true,570),
  (null,'MEN-04','MENTAL','Persistencia ante dificultad','Capacidad para sostener esfuerzo deliberado cuando una tarea o rival presenta dificultad.',1,5,1,true,'PRIVATE_SPORTING',true,580),
  (null,'MEN-05','MENTAL','Receptividad al feedback','Disposición y capacidad para recibir correcciones sin respuestas defensivas que impidan aprender.',1,5,1,true,'PRIVATE_SPORTING',true,590),
  (null,'MEN-06','MENTAL','Implementación del feedback','Capacidad para transformar una indicación comprendida en un cambio observable de conducta.',1,5,1,true,'PRIVATE_SPORTING',true,600),
  (null,'MEN-07','MENTAL','Búsqueda de feedback y autonomía','Capacidad para identificar necesidades propias, solicitar información útil y trabajar sobre ella.',1,5,1,true,'PRIVATE_SPORTING',true,610),
  (null,'MEN-08','MENTAL','Adaptabilidad','Capacidad para modificar conducta ante cambios de rol, tarea, rival, reglas o estrategia.',1,5,1,true,'PRIVATE_SPORTING',true,620),
  (null,'MEN-09','MENTAL','Esfuerzo consistente y autocontrol','Capacidad para mantener esfuerzo útil y regular impulsos que perjudican al rendimiento o al equipo.',1,5,1,true,'PRIVATE_SPORTING',true,630),
  (null,'COL-01','COLLECTIVE','Comunicación colectiva','Capacidad para compartir información útil con compañeros en ataque, defensa y pausas.',1,5,1,true,'PRIVATE_SPORTING',true,640),
  (null,'COL-02','COLLECTIVE','Cooperación funcional','Capacidad para realizar acciones que facilitan el rendimiento de compañeros aunque no generen estadística personal.',1,5,1,true,'PRIVATE_SPORTING',true,650),
  (null,'COL-03','COLLECTIVE','Comprensión y aceptación del rol','Capacidad para entender qué necesita el equipo de él/ella en un contexto y actuar de acuerdo con ello.',1,5,1,true,'PRIVATE_SPORTING',true,660),
  (null,'COL-04','COLLECTIVE','Conexión colectiva','Capacidad para mantener continuidad entre acciones propias y del equipo.',1,5,1,true,'PRIVATE_SPORTING',true,670),
  (null,'COL-05','COLLECTIVE','Liderazgo funcional','Capacidad para elevar organización, esfuerzo, claridad o confianza del grupo mediante conductas observables.',1,5,1,true,'PRIVATE_SPORTING',true,680),
  (null,'COL-06','COLLECTIVE','Responsabilidad y fiabilidad','Capacidad para cumplir compromisos deportivos y asumir las consecuencias de sus acciones.',1,5,1,true,'PRIVATE_SPORTING',true,690)
) as v(team_season_id,code,domain_code,name,description,scale_min,scale_max,scale_step,higher_is_better,sensitivity,is_active,sort_order)
where not exists(
  select 1 from public.player360_evaluation_metrics m
  where m.team_season_id is null and upper(m.code)=upper(v.code)
);

with r(code,rubric_version,definition,observation_guide,do_not_rate_by,min_evidence,introduction_stage) as (values
  ('TEC-BOT-01','1.0','Capacidad para controlar y utilizar funcionalmente la mano derecha durante el bote.','Progresión, cambios de trayectoria, conservación del balón y continuidad de la acción con la derecha.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-BOT-02','1.0','Capacidad para controlar y utilizar funcionalmente la mano izquierda durante el bote.','Progresión, cambios de trayectoria, conservación del balón y continuidad de la acción con la izquierda.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-BOT-03','1.0','Capacidad para mantener control técnico del balón al desplazarse a alta velocidad.','Altura y distancia del bote, pérdidas de control, capacidad para levantar la vista y enlazar la siguiente acción sin frenar innecesariamente.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-BOT-04','1.0','Capacidad para conservar la posesión frente a presión, contacto y manos defensivas activas.','Uso del cuerpo, brazo libre legal, orientación del bote, cambios de mano, giros y capacidad de salir de traps o presión.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-BOT-05','1.0','Capacidad para modificar eficazmente la trayectoria de desplazamiento con balón.','Control del balón, apoyos, centro de gravedad, separación creada y continuidad tras crossover, entre piernas, espalda u otras soluciones.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-BOT-06','1.0','Capacidad para variar velocidad y cadencia del bote para generar o ampliar ventaja.','Pausas, aceleraciones, desaceleraciones, hesitations y capacidad de volver a acelerar sin perder control.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-BOT-07','1.0','Capacidad para utilizar bote, mirada, cuerpo, ángulos y ritmo para provocar una respuesta defensiva.','Si el jugador obliga al defensor o a la ayuda a desplazarse antes de ejecutar la acción deseada.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Advanced · Performance'),
  ('TEC-PAS-01','1.0','Capacidad para ejecutar pases funcionales con la mano derecha desde diferentes posiciones y ángulos.','Velocidad, trayectoria, control corporal y capacidad para pasar sin reorganizaciones innecesarias.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-PAS-02','1.0','Capacidad para ejecutar pases funcionales con la mano izquierda desde diferentes posiciones y ángulos.','Velocidad, trayectoria, control corporal y capacidad para pasar sin volver sistemáticamente a la mano dominante.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-PAS-03','1.0','Capacidad para entregar el balón en el punto que facilita la siguiente acción del receptor.','Altura, lado del cuerpo, velocidad y anticipación del pase; si obliga o no al receptor a reajustarse.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-PAS-04','1.0','Capacidad para pasar directamente desde el bote sin detener o reorganizar innecesariamente la acción.','Tiempo entre último bote y pase, equilibrio, variedad de ángulos y conservación de la ventana de ventaja.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-PAS-05','1.0','Capacidad para mantener calidad técnica de pase ante presión física, manos activas y espacios reducidos.','Pérdidas por precipitación, flotación de pases, telegráficos, calidad del pase ante traps y contacto.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-PAS-06','1.0','Capacidad para recibir asegurando el balón y quedar preparado para la siguiente acción.','Presentación de manos, orientación corporal, equilibrio, recepción en movimiento y rapidez para enlazar tiro, pase o bote.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-FIN-01','1.0','Capacidad para finalizar cerca del aro utilizando la mano derecha de forma funcional.','Control corporal, extensión, uso del tablero/aro, distintos apoyos y eficacia ante oposición.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-FIN-02','1.0','Capacidad para finalizar cerca del aro utilizando la mano izquierda de forma funcional.','Control corporal, extensión, uso del tablero/aro, distintos apoyos y eficacia ante oposición.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-FIN-03','1.0','Capacidad para mantener control y calidad de finalización cuando existe contacto legal o desequilibrio provocado por el defensor.','Estabilidad de tronco, absorción del contacto, protección del balón, elección de apoyos y continuidad hasta el aro.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-FIN-04','1.0','Capacidad para utilizar extensión, aro, tablero, altura y trayectoria para evitar al protector del aro.','Reverse, inside/outside hand, extensiones, cambios de lado, uso del aro como protección y ajuste del ángulo.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-FIN-05','1.0','Capacidad para organizar apoyos, paradas y pasos de forma legal y eficiente al finalizar.','Uno-dos, dos tiempos, stride stop, eurostep, pivotes, cambio de último paso y equilibrio.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-FIN-06','1.0','Capacidad para resolver cerca del aro a alta velocidad y con defensores en recuperación.','Control del último bote, lectura de ángulo, desaceleración, protección, uso de ambas manos y estabilidad a máxima velocidad.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-TIR-01','1.0','Capacidad para reproducir un patrón de tiro estable y eficiente compatible con su desarrollo individual.','Equilibrio, alineación funcional, secuencia de fuerza, salida, seguimiento y consistencia entre repeticiones.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-TIR-02','1.0','Capacidad para estar física y perceptivamente preparado antes de recibir.','Pies, manos, orientación, bajar centro de gravedad, lectura previa y reducción de movimientos innecesarios.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-TIR-03','1.0','Capacidad para lanzar tras recepción con equilibrio, velocidad y estabilidad técnica.','Tiempo recepción-lanzamiento, necesidad de reajustes, calidad ante closeout y repetibilidad.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-TIR-04','1.0','Capacidad para generar y ejecutar un lanzamiento estable después de botar.','Paradas, equilibrio, separación, control del eje corporal y transición bote-tiro.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TEC-TIR-05','1.0','Capacidad para lanzar tras desplazamientos sin balón o recepciones dinámicas.','Relocation, curls, fades, salidas de bloqueos, frenada, orientación y ajuste de pies.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Foundational · Advanced · Performance'),
  ('TEC-TIR-06','1.0','Capacidad para conservar calidad técnica y selección cuando existe oposición, fatiga o presión competitiva.','Cambios de mecánica, aceleración excesiva, equilibrio, arco, selección y respuesta ante closeout.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-01','1.0','Capacidad para obtener información relevante antes de recibir o intervenir.','Movimientos de cabeza/ojos, conocimiento de defensor, ayudas, compañeros y espacio antes de la recepción.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-02','1.0','Capacidad para detectar una ventaja ofensiva existente o incipiente a tiempo de explotarla.','Reconoce desequilibrios, closeouts largos, superioridades, desajustes y defensores fuera de posición.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-03','1.0','Capacidad para identificar, ocupar y liberar espacios que mejoran el ataque.','Spacing, esquinas, 45°, dunker, cortes, vaciados y no congestionar líneas de penetración.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-04','1.0','Capacidad para escoger receptor, momento y tipo de pase adecuados.','Si ve al jugador prioritario, evita pases de bajo valor y ajusta decisión a ayudas, rotaciones y riesgo.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-05','1.0','Capacidad para diferenciar un lanzamiento de alto valor de uno simplemente disponible.','Calidad de espacio, equilibrio, rango real, reloj, rebote, ventaja creada y alternativas mejores.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-06','1.0','Capacidad para seleccionar rápidamente entre atacar aro, pasar o lanzar.','Respuesta al closeout, posición de ayudas, balance riesgo-beneficio y continuidad de la ventaja.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-07','1.0','Capacidad para resolver ventajas y desventajas en campo abierto.','Carriles, profundidad, pase adelantado, fijar defensor, superioridad numérica y cuándo frenar.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-08','1.0','Capacidad para reconocer y atacar coberturas de pick-and-roll/pick-and-pop.','Drop, switch, show/hedge, blitz, under, reject; lectura de roller, popper, short roll y lado débil.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Advanced · Performance'),
  ('TAC-OF-09','1.0','Capacidad para interpretar la defensa en acciones sin balón con bloqueos.','Curl, fade, backdoor, straight cut, rechazo, cambio de ritmo y lectura de top-lock/switch/trail.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Foundational · Advanced · Performance'),
  ('TAC-OF-10','1.0','Capacidad para generar valor ofensivo cuando no posee el balón.','Cortes, reemplazos, relocations, sellos, ocupación de dunker, screens y timing respecto a penetraciones.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-11','1.0','Capacidad para crear una ventaja o evitar que una ventaja existente desaparezca.','Fijar defensor, atacar closeout, paint touch, extra pass, re-drive y decisiones que obligan a nueva rotación.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('TAC-OF-12','1.0','Capacidad para acelerar, pausar, reorganizar o cambiar solución según el estado de la posesión.','Control del tempo, reloj, ventaja, fatiga, emparejamientos y cambios defensivos durante la misma acción.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Advanced · Performance'),
  ('DEF-01','1.0','Capacidad para mantener una posición corporal que permita reaccionar eficientemente.','Centro de gravedad, equilibrio, apoyos, orientación, cruces innecesarios y capacidad de frenar/cambiar dirección.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-02','1.0','Capacidad para contener al atacante con balón en espacio exterior.','Primer paso defensivo, orientación, distancia, pecho frente al balón y necesidad de ayudas.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-03','1.0','Capacidad para detener o desviar una penetración antes de que genere ventaja profunda.','Ángulo de cadera, recuperación, verticalidad, uso de línea lateral/fondo y protección del aro.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-04','1.0','Capacidad para incomodar al manejador sin perder equilibrio ni cometer faltas evitables.','Actividad de manos, distancia, deflections, reach-ins, orientación y recuperación tras fintas.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-05','1.0','Capacidad para recuperar hasta un tirador controlando simultáneamente tiro y penetración.','Sprint inicial, desaceleración, mano de contest, distancia, orientación y reacción al primer bote.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-06','1.0','Capacidad para mantener una relación útil entre balón, atacante propio, aro y espacio.','Visión balón-hombre, distancia de ayuda, deny, body positioning y ajustes cuando se mueve el balón.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-07','1.0','Capacidad para intervenir sobre una ventaja rival en el momento y profundidad adecuados.','Posición de ayuda, timing, verticalidad, stunt/dig y si la ayuda resuelve sin crear una ventaja mayor.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-08','1.0','Capacidad para asumir la siguiente responsabilidad cuando un compañero ayuda o es superado.','Lectura de la cadena de ayudas, low man, x-out, bump y asignación del siguiente atacante peligroso.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-09','1.0','Capacidad para volver a una responsabilidad útil después de ayudar, presionar o quedar desplazado.','Trayectoria de recuperación, prioridad de amenazas, balance entre sprint y control, comunicación.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-10','1.0','Capacidad para atravesar o rodear bloqueos manteniendo conexión con la acción.','Top-lock, chase, over/under, body lock, evitar contactos innecesarios y volver a línea defensiva.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Según dominio'),
  ('DEF-11','1.0','Capacidad para ejecutar su responsabilidad en las distintas coberturas de pick-and-roll.','Drop, switch, hedge/show, blitz, ice, under; comunicación, ángulos y conexión con roller/handler.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Advanced · Performance'),
  ('DEF-12','1.0','Capacidad para organizarse al perder la posesión y reducir ventaja rival.','Sprint de retorno, protección de aro, parar balón, emparejamiento, comunicación y balance entre balón/aro/triples.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-13','1.0','Capacidad para defender eficazmente perfiles ofensivos diferentes.','Rendimiento frente a tamaños, velocidades, roles y acciones distintas; capacidad de cambiar asignaciones.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Advanced · Performance'),
  ('DEF-14','1.0','Capacidad para localizar, contactar y controlar al rival antes de perseguir el rebote.','Búsqueda del atacante, primer contacto, base, giro/sello y continuidad hasta asegurar balón.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-15','1.0','Capacidad para finalizar la posesión capturando o asegurando el rebote defensivo.','Lectura de trayectoria, ataque al balón, dos manos cuando procede, seguridad y primer pase/salida.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-16','1.0','Capacidad para proporcionar información defensiva útil, anticipada y accionable.','Avisos de bloqueos, ayudas, cambios, cutters, reloj y tono/claridad de la información.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('DEF-17','1.0','Capacidad para prever la acción probable a partir de señales del juego sin abandonar responsabilidades.','Lectura de ojos, spacing, patrones, timing de cortes y pases; intercepciones sin gambling sistemático.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',8,'Según dominio'),
  ('MEN-01','1.0','Capacidad para mantener y dirigir la atención hacia las claves útiles de tarea y juego.','Escucha de consignas, foco durante repeticiones, lectura del juego y reducción de distracciones.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('MEN-02','1.0','Calidad de la conducta inmediatamente posterior a un error propio.','Tiempo para reengancharse, siguiente acción, lenguaje corporal, protesta, evitación o pérdida de concentración.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('MEN-03','1.0','Capacidad para conservar calidad conductual y decisional en situaciones de presión competitiva.','Cambios de decisión, precipitación, comunicación, control corporal y conducta en finales/aprietos.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Foundational · Advanced · Performance'),
  ('MEN-04','1.0','Capacidad para sostener esfuerzo deliberado cuando una tarea o rival presenta dificultad.','Abandono, repetición con propósito, búsqueda de soluciones y tolerancia a no lograr éxito inmediato.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('MEN-05','1.0','Disposición y capacidad para recibir correcciones sin respuestas defensivas que impidan aprender.','Escucha, preguntas aclaratorias, atención al mensaje y respuesta inmediata.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('MEN-06','1.0','Capacidad para transformar una indicación comprendida en un cambio observable de conducta.','Diferencia entre entender verbalmente y modificar ejecución/decisión en repeticiones posteriores.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('MEN-07','1.0','Capacidad para identificar necesidades propias, solicitar información útil y trabajar sobre ella.','Preguntas específicas, autoevaluación, objetivos personales y trabajo sin dependencia constante del entrenador.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Foundational · Advanced · Performance'),
  ('MEN-08','1.0','Capacidad para modificar conducta ante cambios de rol, tarea, rival, reglas o estrategia.','Rigidez, tiempo de adaptación, transferencia de principios y respuesta a consignas nuevas.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('MEN-09','1.0','Capacidad para mantener esfuerzo útil y regular impulsos que perjudican al rendimiento o al equipo.','Retorno defensivo, acciones sin balón, protestas, faltas evitables, intensidad y estabilidad entre situaciones favorables/adversas.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Según dominio'),
  ('COL-01','1.0','Capacidad para compartir información útil con compañeros en ataque, defensa y pausas.','Claridad, oportunidad, contenido, escucha y si la comunicación ayuda a resolver una acción.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',5,'Según dominio'),
  ('COL-02','1.0','Capacidad para realizar acciones que facilitan el rendimiento de compañeros aunque no generen estadística personal.','Bloqueos, cortes de arrastre, spacing, ayudas, box-outs, extra pass y disposición a ejecutar tareas no protagonistas.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Según dominio'),
  ('COL-03','1.0','Capacidad para entender qué necesita el equipo de él/ella en un contexto y actuar de acuerdo con ello.','Selección de acciones, reacción a cambios de minutos/rol, disciplina táctica y coherencia con fortalezas del equipo.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Foundational · Advanced · Performance'),
  ('COL-04','1.0','Capacidad para mantener continuidad entre acciones propias y del equipo.','Extra pass, re-space, segunda ayuda, salida tras rebote, continuidad después de bloquear/cortar y acciones encadenadas.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Según dominio'),
  ('COL-05','1.0','Capacidad para elevar organización, esfuerzo, claridad o confianza del grupo mediante conductas observables.','Organiza sin monopolizar, corrige de forma útil, da ejemplo, estabiliza al grupo y facilita decisiones.','No valorar por una acción aislada ni por resultado estadístico sin contexto.',6,'Foundational · Advanced · Performance'),
  ('COL-06','1.0','Capacidad para cumplir compromisos deportivos y asumir las consecuencias de sus acciones.','Preparación, puntualidad en tareas internas, cuidado del material, cumplimiento de planes y asunción de errores sin desplazar responsabilidad.','No mezclar con circunstancias personales ajenas al contexto deportivo ni usar para sancionar rasgos de personalidad.',5,'Según dominio')
)
insert into public.player360_evaluation_rubrics(
  metric_definition_id,rubric_version,definition,observation_guide,do_not_rate_by,min_evidence,introduction_stage,status
)
select m.id,r.rubric_version,r.definition,r.observation_guide,r.do_not_rate_by,r.min_evidence,r.introduction_stage,'ACTIVE'
from r join public.player360_evaluation_metrics m on m.team_season_id is null and upper(m.code)=upper(r.code)
where not exists(
  select 1 from public.player360_evaluation_rubrics x
  where x.metric_definition_id=m.id and x.rubric_version=r.rubric_version
);

with a(code,rubric_version,level,label,criteria) as (values
  ('TEC-BOT-01','1.0',1,'Adquisición','No demuestra de forma estable bote mano derecha ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-01','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-01','1.0',3,'Competitivo','Utiliza bote mano derecha de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-01','1.0',4,'Avanzado','Ejecuta bote mano derecha de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-01','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: usa la derecha con naturalidad para crear, mantener o manipular ventajas. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-BOT-02','1.0',1,'Adquisición','No demuestra de forma estable bote mano izquierda ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-02','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-02','1.0',3,'Competitivo','Utiliza bote mano izquierda de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-02','1.0',4,'Avanzado','Ejecuta bote mano izquierda de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-02','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: usa la izquierda sin pérdida funcional respecto a su mano dominante para crear o mantener ventajas. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-BOT-03','1.0',1,'Adquisición','No demuestra de forma estable control a velocidad ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-03','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-03','1.0',3,'Competitivo','Utiliza control a velocidad de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-03','1.0',4,'Avanzado','Ejecuta control a velocidad de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-03','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: mantiene velocidad de desplazamiento, información visual y control incluso ante recuperación defensiva. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-BOT-04','1.0',1,'Adquisición','No demuestra de forma estable protección de balón ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-04','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-04','1.0',3,'Competitivo','Utiliza protección de balón de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-04','1.0',4,'Avanzado','Ejecuta protección de balón de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-04','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: convierte la presión defensiva en una oportunidad para mejorar ángulo, espacio o ventaja. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-BOT-05','1.0',1,'Adquisición','No demuestra de forma estable cambio de dirección ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-05','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-05','1.0',3,'Competitivo','Utiliza cambio de dirección de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-05','1.0',4,'Avanzado','Ejecuta cambio de dirección de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-05','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: elige y ejecuta el cambio mínimo necesario para desplazar al defensor y atacar el nuevo espacio. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-BOT-06','1.0',1,'Adquisición','No demuestra de forma estable cambio de ritmo ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-06','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-06','1.0',3,'Competitivo','Utiliza cambio de ritmo de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-06','1.0',4,'Avanzado','Ejecuta cambio de ritmo de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-06','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: condiciona el timing del defensor mediante ritmo antes de atacar la ventaja. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-BOT-07','1.0',1,'Adquisición','No demuestra de forma estable manipulación con bote ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-BOT-07','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-BOT-07','1.0',3,'Competitivo','Utiliza manipulación con bote de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-BOT-07','1.0',4,'Avanzado','Ejecuta manipulación con bote de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-BOT-07','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: induce respuestas defensivas concretas para abrir línea de pase, tiro o penetración. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-PAS-01','1.0',1,'Adquisición','No demuestra de forma estable pase mano derecha ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-PAS-01','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-PAS-01','1.0',3,'Competitivo','Utiliza pase mano derecha de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-PAS-01','1.0',4,'Avanzado','Ejecuta pase mano derecha de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-PAS-01','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: ejecuta con la derecha pases variados, precisos y rápidos incluso en ventanas pequeñas. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-PAS-02','1.0',1,'Adquisición','No demuestra de forma estable pase mano izquierda ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-PAS-02','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-PAS-02','1.0',3,'Competitivo','Utiliza pase mano izquierda de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-PAS-02','1.0',4,'Avanzado','Ejecuta pase mano izquierda de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-PAS-02','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: ejecuta con la izquierda pases variados, precisos y rápidos incluso en ventanas pequeñas. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-PAS-03','1.0',1,'Adquisición','No demuestra de forma estable precisión del pase ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-PAS-03','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-PAS-03','1.0',3,'Competitivo','Utiliza precisión del pase de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-PAS-03','1.0',4,'Avanzado','Ejecuta precisión del pase de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-PAS-03','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: coloca sistemáticamente el balón en la ventana óptima para la acción siguiente. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-PAS-04','1.0',1,'Adquisición','No demuestra de forma estable pase sobre bote ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-PAS-04','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-PAS-04','1.0',3,'Competitivo','Utiliza pase sobre bote de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-PAS-04','1.0',4,'Avanzado','Ejecuta pase sobre bote de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-PAS-04','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: mantiene la ventaja creada pasando desde bote con ambas manos y distintos ángulos. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-PAS-05','1.0',1,'Adquisición','No demuestra de forma estable pase bajo presión ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-PAS-05','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-PAS-05','1.0',3,'Competitivo','Utiliza pase bajo presión de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-PAS-05','1.0',4,'Avanzado','Ejecuta pase bajo presión de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-PAS-05','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: mantiene precisión y variedad ante presión intensa y utiliza la presión para encontrar al jugador liberado. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-PAS-06','1.0',1,'Adquisición','No demuestra de forma estable recepción y preparación ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-PAS-06','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-PAS-06','1.0',3,'Competitivo','Utiliza recepción y preparación de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-PAS-06','1.0',4,'Avanzado','Ejecuta recepción y preparación de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-PAS-06','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: recibe ya orientado y convierte la recepción en parte de la siguiente acción sin tiempo perdido. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-FIN-01','1.0',1,'Adquisición','No demuestra de forma estable finalización mano derecha ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-FIN-01','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-FIN-01','1.0',3,'Competitivo','Utiliza finalización mano derecha de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-FIN-01','1.0',4,'Avanzado','Ejecuta finalización mano derecha de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-FIN-01','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: finaliza con derecha desde distintos ángulos, apoyos y alturas ante protección real del aro. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-FIN-02','1.0',1,'Adquisición','No demuestra de forma estable finalización mano izquierda ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-FIN-02','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-FIN-02','1.0',3,'Competitivo','Utiliza finalización mano izquierda de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-FIN-02','1.0',4,'Avanzado','Ejecuta finalización mano izquierda de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-FIN-02','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: finaliza con izquierda desde distintos ángulos, apoyos y alturas sin dependencia funcional de la derecha. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-FIN-03','1.0',1,'Adquisición','No demuestra de forma estable finalización con contacto ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-FIN-03','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-FIN-03','1.0',3,'Competitivo','Utiliza finalización con contacto de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-FIN-03','1.0',4,'Avanzado','Ejecuta finalización con contacto de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-FIN-03','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: usa o absorbe el contacto para proteger línea de finalización y mantener eficacia. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-FIN-04','1.0',1,'Adquisición','No demuestra de forma estable ángulos y evitación de contacto ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-FIN-04','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-FIN-04','1.0',3,'Competitivo','Utiliza ángulos y evitación de contacto de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-FIN-04','1.0',4,'Avanzado','Ejecuta ángulos y evitación de contacto de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-FIN-04','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: modifica el ángulo de finalización según posición del defensor sin perder control. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-FIN-05','1.0',1,'Adquisición','No demuestra de forma estable juego de pies en finalización ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-FIN-05','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-FIN-05','1.0',3,'Competitivo','Utiliza juego de pies en finalización de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-FIN-05','1.0',4,'Avanzado','Ejecuta juego de pies en finalización de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-FIN-05','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: selecciona y adapta los apoyos para alterar timing y ángulo sin perder equilibrio. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-FIN-06','1.0',1,'Adquisición','No demuestra de forma estable finalización en transición ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-FIN-06','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-FIN-06','1.0',3,'Competitivo','Utiliza finalización en transición de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-FIN-06','1.0',4,'Avanzado','Ejecuta finalización en transición de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-FIN-06','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: mantiene control y opciones múltiples a máxima velocidad frente a defensores que recuperan. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-TIR-01','1.0',1,'Adquisición','No demuestra de forma estable mecánica y repetibilidad ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-TIR-01','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-TIR-01','1.0',3,'Competitivo','Utiliza mecánica y repetibilidad de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-TIR-01','1.0',4,'Avanzado','Ejecuta mecánica y repetibilidad de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-TIR-01','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: mantiene un patrón reproducible y puede ajustarlo a distancia o contexto sin degradarlo. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-TIR-02','1.0',1,'Adquisición','No demuestra de forma estable preparación de tiro ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-TIR-02','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-TIR-02','1.0',3,'Competitivo','Utiliza preparación de tiro de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-TIR-02','1.0',4,'Avanzado','Ejecuta preparación de tiro de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-TIR-02','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: llega a la recepción preparado para lanzar o atacar inmediatamente según respuesta defensiva. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-TIR-03','1.0',1,'Adquisición','No demuestra de forma estable catch & shoot ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-TIR-03','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-TIR-03','1.0',3,'Competitivo','Utiliza catch & shoot de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-TIR-03','1.0',4,'Avanzado','Ejecuta catch & shoot de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-TIR-03','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: convierte ventanas breves de tiro en lanzamientos estables sin sacrificar selección. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-TIR-04','1.0',1,'Adquisición','No demuestra de forma estable tiro tras bote ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-TIR-04','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-TIR-04','1.0',3,'Competitivo','Utiliza tiro tras bote de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-TIR-04','1.0',4,'Avanzado','Ejecuta tiro tras bote de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-TIR-04','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: crea su propia ventana y mantiene mecánica ante cambios de ritmo, dirección y presión. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-TIR-05','1.0',1,'Adquisición','No demuestra de forma estable tiro en movimiento ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-TIR-05','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-TIR-05','1.0',3,'Competitivo','Utiliza tiro en movimiento de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-TIR-05','1.0',4,'Avanzado','Ejecuta tiro en movimiento de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-TIR-05','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: se orienta y estabiliza rápidamente desde trayectorias variadas sin perder velocidad de ejecución. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TEC-TIR-06','1.0',1,'Adquisición','No demuestra de forma estable estabilidad del tiro bajo presión ni siquiera en condiciones sencillas. Son frecuentes errores que interrumpen la acción o le obligan a evitar ese recurso.'),
  ('TEC-TIR-06','1.0',2,'Funcional controlado','La habilidad aparece en tareas controladas o con presión baja, pero pierde claramente calidad cuando aumentan velocidad, oposición, contacto o incertidumbre.'),
  ('TEC-TIR-06','1.0',3,'Competitivo','Utiliza estabilidad del tiro bajo presión de manera funcional en juego real frente a oposición de nivel similar en la mayoría de situaciones habituales; los errores no le obligan sistemáticamente a evitar la acción.'),
  ('TEC-TIR-06','1.0',4,'Avanzado','Ejecuta estabilidad del tiro bajo presión de forma consistente a alta velocidad y bajo presión, con pocas pérdidas de calidad, y adapta la ejecución a ángulos, distancias o respuestas defensivas distintas.'),
  ('TEC-TIR-06','1.0',5,'Dominio / rendimiento','Presenta dominio transferible: mantiene su patrón y velocidad de ejecución frente a closeouts de calidad y presión competitiva. Mantiene eficacia ante oposición exigente y el recurso condiciona positivamente las opciones del rival o del equipo.'),
  ('TAC-OF-01','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a escaneo previo; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-01','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-01','1.0',3,'Competitivo','Resuelve escaneo previo adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-01','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-01','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y actualiza información repetidamente antes y durante la acción para anticipar opciones. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-02','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a percepción de ventaja; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-02','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-02','1.0',3,'Competitivo','Resuelve percepción de ventaja adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-02','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-02','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y detecta ventajas pequeñas antes de que sean evidentes y actúa antes de la recuperación defensiva. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-03','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a reconocimiento y ocupación del espacio; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-03','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-03','1.0',3,'Competitivo','Resuelve reconocimiento y ocupación del espacio adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-03','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-03','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y modifica su posición para crear simultáneamente espacio propio y ventajas para compañeros. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-04','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a selección de pase; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-04','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-04','1.0',3,'Competitivo','Resuelve selección de pase adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-04','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-04','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y anticipa la rotación siguiente y pasa al lugar donde estará la ventaja. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-05','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a selección de tiro; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-05','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-05','1.0',3,'Competitivo','Resuelve selección de tiro adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-05','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-05','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y ajusta selección al contexto competitivo y castiga consistentemente la respuesta defensiva óptima. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-06','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a decisión penetrar–pasar–tirar; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-06','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-06','1.0',3,'Competitivo','Resuelve decisión penetrar–pasar–tirar adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-06','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-06','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y elige correctamente con información incompleta y cambia de opción si cambia la defensa. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-07','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a decisiones en transición; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-07','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-07','1.0',3,'Competitivo','Resuelve decisiones en transición adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-07','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-07','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y manipula al último defensor y mantiene la superioridad hasta generar tiro de alto valor. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-08','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a lectura de bloqueo directo; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-08','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-08','1.0',3,'Competitivo','Resuelve lectura de bloqueo directo adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-08','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-08','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y reconoce cobertura temprano, manipula dos defensores y conecta con la ventaja secundaria. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-09','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a lectura de bloqueos indirectos; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-09','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-09','1.0',3,'Competitivo','Resuelve lectura de bloqueos indirectos adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-09','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-09','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y lee al defensor y al segundo defensor antes de elegir trayectoria y timing. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-10','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a juego sin balón; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-10','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-10','1.0',3,'Competitivo','Resuelve juego sin balón adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-10','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-10','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y genera ventajas para sí o para terceros sin necesitar tocar el balón. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-11','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a creación y mantenimiento de ventaja; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-11','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-11','1.0',3,'Competitivo','Resuelve creación y mantenimiento de ventaja adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-11','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-11','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y encadena acciones para mantener a la defensa en rotación hasta obtener una finalización de alto valor. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('TAC-OF-12','1.0',1,'Adquisición','Rara vez identifica o selecciona correctamente la conducta asociada a gestión del ritmo y adaptación; suele reaccionar tarde o elegir una opción que elimina la ventaja.'),
  ('TAC-OF-12','1.0',2,'Funcional controlado','Reconoce situaciones evidentes y decide bien con tiempo o poca presión, pero la calidad cae con incertidumbre, velocidad o múltiples opciones.'),
  ('TAC-OF-12','1.0',3,'Competitivo','Resuelve gestión del ritmo y adaptación adecuadamente en la mayoría de situaciones habituales de juego real frente a oposición similar y dentro de un tiempo útil para conservar la ventaja.'),
  ('TAC-OF-12','1.0',4,'Avanzado','Lee situaciones menos evidentes, decide pronto y adapta la respuesta cuando cambia la defensa; mantiene calidad bajo presión y en contextos variados.'),
  ('TAC-OF-12','1.0',5,'Dominio / rendimiento','Anticipa el desarrollo de la acción y controla el ritmo de la posesión y adapta el plan antes de que la defensa recupere iniciativa. Sus decisiones no solo responden a la defensa: ayudan a provocarla o mantenerla en desventaja.'),
  ('DEF-01','1.0',1,'Adquisición','No ejecuta de forma estable base y desplazamiento defensivo; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-01','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-01','1.0',3,'Competitivo','Cumple base y desplazamiento defensivo de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-01','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-01','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: ajusta distancia, ángulo y pies sin perder equilibrio ante cambios de ritmo ofensivos. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-02','1.0',1,'Adquisición','No ejecuta de forma estable defensa 1x1 exterior; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-02','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-02','1.0',3,'Competitivo','Cumple defensa 1x1 exterior de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-02','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-02','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: influye en la dirección y opciones del atacante sin conceder ventaja primaria. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-03','1.0',1,'Adquisición','No ejecuta de forma estable contención de penetración; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-03','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-03','1.0',3,'Competitivo','Cumple contención de penetración de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-03','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-03','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: reduce profundidad de penetración y fuerza finalizaciones/pases de menor valor. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-04','1.0',1,'Adquisición','No ejecuta de forma estable presión al balón y uso de manos; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-04','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-04','1.0',3,'Competitivo','Cumple presión al balón y uso de manos de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-04','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-04','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: aumenta presión sobre bote/pase sin comprometer la contención. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-05','1.0',1,'Adquisición','No ejecuta de forma estable closeout; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-05','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-05','1.0',3,'Competitivo','Cumple closeout de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-05','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-05','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: ajusta closeout al perfil del atacante y al plan defensivo sin regalar segunda ventaja. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-06','1.0',1,'Adquisición','No ejecuta de forma estable posición defensiva sin balón; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-06','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-06','1.0',3,'Competitivo','Cumple posición defensiva sin balón de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-06','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-06','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: se reposiciona antes de cada nueva amenaza y reduce opciones sin perder a su asignación. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-07','1.0',1,'Adquisición','No ejecuta de forma estable ayuda defensiva; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-07','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-07','1.0',3,'Competitivo','Cumple ayuda defensiva de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-07','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-07','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: llega temprano, detiene la ventaja y conserva opciones de recuperación o rotación. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-08','1.0',1,'Adquisición','No ejecuta de forma estable rotación defensiva; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-08','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-08','1.0',3,'Competitivo','Cumple rotación defensiva de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-08','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-08','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: anticipa la rotación posterior y llega con tiempo para evitar una segunda ventaja. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-09','1.0',1,'Adquisición','No ejecuta de forma estable recuperación defensiva; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-09','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-09','1.0',3,'Competitivo','Cumple recuperación defensiva de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-09','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-09','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: recupera al jugador/espacio correcto, no necesariamente al emparejamiento original. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-10','1.0',1,'Adquisición','No ejecuta de forma estable navegación de bloqueos; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-10','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-10','1.0',3,'Competitivo','Cumple navegación de bloqueos de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-10','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-10','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: elige la ruta según tirador, ángulo y cobertura colectiva y minimiza la ventaja creada. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-11','1.0',1,'Adquisición','No ejecuta de forma estable defensa del bloqueo directo; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-11','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-11','1.0',3,'Competitivo','Cumple defensa del bloqueo directo de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-11','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-11','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: reconoce acción y cobertura antes del contacto y coordina dos o más responsabilidades. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-12','1.0',1,'Adquisición','No ejecuta de forma estable defensa en transición; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-12','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-12','1.0',3,'Competitivo','Cumple defensa en transición de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-12','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-12','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: prioriza amenazas correctamente y transforma una inferioridad inicial en defensa organizada. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-13','1.0',1,'Adquisición','No ejecuta de forma estable versatilidad defensiva; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-13','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-13','1.0',3,'Competitivo','Cumple versatilidad defensiva de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-13','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-13','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: mantiene impacto defensivo positivo ante múltiples perfiles sin requerir protección táctica constante. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-14','1.0',1,'Adquisición','No ejecuta de forma estable box-out; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-14','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-14','1.0',3,'Competitivo','Cumple box-out de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-14','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-14','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: neutraliza sistemáticamente a su rival y libera el rebote para sí o para un compañero. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-15','1.0',1,'Adquisición','No ejecuta de forma estable rebote defensivo; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-15','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-15','1.0',3,'Competitivo','Cumple rebote defensivo de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-15','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-15','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: controla su zona de rebote y convierte recuperación en salida ofensiva segura. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-16','1.0',1,'Adquisición','No ejecuta de forma estable comunicación defensiva; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-16','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-16','1.0',3,'Competitivo','Cumple comunicación defensiva de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-16','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-16','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: organiza preventivamente a compañeros y reduce errores antes de que ocurran. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('DEF-17','1.0',1,'Adquisición','No ejecuta de forma estable anticipación defensiva; llega tarde, pierde responsabilidad o genera ayudas adicionales de manera frecuente.'),
  ('DEF-17','1.0',2,'Funcional controlado','La ejecuta correctamente en situaciones simples o previsibles, pero pierde posición/timing al aumentar velocidad, espacio, bloqueos o coordinación.'),
  ('DEF-17','1.0',3,'Competitivo','Cumple anticipación defensiva de manera funcional en la mayoría de situaciones habituales de juego real frente a oposición similar y respeta el plan defensivo.'),
  ('DEF-17','1.0',4,'Avanzado','Mantiene calidad frente a atacantes exigentes y acciones variadas, ajustando distancia, timing y responsabilidad sin requerir protección constante.'),
  ('DEF-17','1.0',5,'Dominio / rendimiento','Presenta impacto defensivo diferencial: anticipa acciones de alto valor y llega antes sin desestructurar el sistema defensivo. Anticipa sin asumir riesgos innecesarios y mejora la eficacia defensiva de compañeros.'),
  ('MEN-01','1.0',1,'Adquisición','La conducta asociada a atención a información relevante aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-01','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-01','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-01','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-01','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; selecciona rápidamente las claves relevantes y mantiene foco incluso bajo carga o presión. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-02','1.0',1,'Adquisición','La conducta asociada a reacción al error aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-02','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-02','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-02','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-02','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; procesa el error sin arrastrarlo y ajusta la siguiente acción cuando existe información útil. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-03','1.0',1,'Adquisición','La conducta asociada a compostura bajo presión aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-03','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-03','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-03','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-03','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; mantiene o mejora claridad decisional cuando aumenta la presión contextual. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-04','1.0',1,'Adquisición','La conducta asociada a persistencia ante dificultad aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-04','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-04','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-04','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-04','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; mantiene esfuerzo y modifica estrategia en lugar de repetir de forma rígida. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-05','1.0',1,'Adquisición','La conducta asociada a receptividad al feedback aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-05','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-05','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-05','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-05','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; recibe feedback crítico, extrae la clave y lo integra sin perder autonomía. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-06','1.0',1,'Adquisición','La conducta asociada a implementación del feedback aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-06','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-06','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-06','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-06','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; aplica el feedback, lo estabiliza y lo transfiere a contextos nuevos. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-07','1.0',1,'Adquisición','La conducta asociada a búsqueda de feedback y autonomía aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-07','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-07','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-07','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-07','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; formula hipótesis sobre su rendimiento, busca feedback relevante y prueba soluciones de forma autónoma. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-08','1.0',1,'Adquisición','La conducta asociada a adaptabilidad aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-08','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-08','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-08','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-08','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; transfiere principios y encuentra soluciones eficaces ante situaciones nuevas. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('MEN-09','1.0',1,'Adquisición','La conducta asociada a esfuerzo consistente y autocontrol aparece rara vez o de forma inestable y dificulta de manera recurrente aprendizaje, autorregulación o continuidad.'),
  ('MEN-09','1.0',2,'Funcional controlado','La muestra cuando el contexto es favorable o existe supervisión directa, pero se pierde ante error, presión, dificultad o menor control externo.'),
  ('MEN-09','1.0',3,'Competitivo','La conducta es funcional y observable de forma habitual en entrenamiento y/o competición; permite aprender y competir sin interferencias recurrentes.'),
  ('MEN-09','1.0',4,'Avanzado','La mantiene en situaciones difíciles, la aplica con autonomía y es capaz de recuperarla rápidamente después de momentos adversos.'),
  ('MEN-09','1.0',5,'Dominio / rendimiento','La conducta está consolidada y autorregulada; mantiene esfuerzo funcional y control conductual sin necesidad de supervisión externa. Contribuye a acelerar el propio aprendizaje y estabilizar su rendimiento.'),
  ('COL-01','1.0',1,'Adquisición','La conducta asociada a comunicación colectiva es escasa o genera con frecuencia fricción, desconexión o pérdida de eficacia colectiva.'),
  ('COL-01','1.0',2,'Funcional controlado','La muestra cuando se le solicita o en contextos sencillos, pero es poco consistente cuando cambia el rol, aumenta la presión o no recibe protagonismo.'),
  ('COL-01','1.0',3,'Competitivo','Contribuye de forma funcional y estable al equipo mediante comunicación colectiva en la mayoría de situaciones habituales.'),
  ('COL-01','1.0',4,'Avanzado','Adapta su conducta a compañeros, rol y contexto; su aportación mejora de forma consistente la coordinación o eficacia colectiva.'),
  ('COL-01','1.0',5,'Dominio / rendimiento','Su impacto trasciende su propia acción: mejora la coordinación colectiva con información anticipada, breve y específica. Eleva de forma observable el funcionamiento de compañeros o del grupo.'),
  ('COL-02','1.0',1,'Adquisición','La conducta asociada a cooperación funcional es escasa o genera con frecuencia fricción, desconexión o pérdida de eficacia colectiva.'),
  ('COL-02','1.0',2,'Funcional controlado','La muestra cuando se le solicita o en contextos sencillos, pero es poco consistente cuando cambia el rol, aumenta la presión o no recibe protagonismo.'),
  ('COL-02','1.0',3,'Competitivo','Contribuye de forma funcional y estable al equipo mediante cooperación funcional en la mayoría de situaciones habituales.'),
  ('COL-02','1.0',4,'Avanzado','Adapta su conducta a compañeros, rol y contexto; su aportación mejora de forma consistente la coordinación o eficacia colectiva.'),
  ('COL-02','1.0',5,'Dominio / rendimiento','Su impacto trasciende su propia acción: identifica espontáneamente qué acción mejora al conjunto y la ejecuta con timing. Eleva de forma observable el funcionamiento de compañeros o del grupo.'),
  ('COL-03','1.0',1,'Adquisición','La conducta asociada a comprensión y aceptación del rol es escasa o genera con frecuencia fricción, desconexión o pérdida de eficacia colectiva.'),
  ('COL-03','1.0',2,'Funcional controlado','La muestra cuando se le solicita o en contextos sencillos, pero es poco consistente cuando cambia el rol, aumenta la presión o no recibe protagonismo.'),
  ('COL-03','1.0',3,'Competitivo','Contribuye de forma funcional y estable al equipo mediante comprensión y aceptación del rol en la mayoría de situaciones habituales.'),
  ('COL-03','1.0',4,'Avanzado','Adapta su conducta a compañeros, rol y contexto; su aportación mejora de forma consistente la coordinación o eficacia colectiva.'),
  ('COL-03','1.0',5,'Dominio / rendimiento','Su impacto trasciende su propia acción: adapta su rol a las necesidades del partido sin perder impacto ni compromiso. Eleva de forma observable el funcionamiento de compañeros o del grupo.'),
  ('COL-04','1.0',1,'Adquisición','La conducta asociada a conexión colectiva es escasa o genera con frecuencia fricción, desconexión o pérdida de eficacia colectiva.'),
  ('COL-04','1.0',2,'Funcional controlado','La muestra cuando se le solicita o en contextos sencillos, pero es poco consistente cuando cambia el rol, aumenta la presión o no recibe protagonismo.'),
  ('COL-04','1.0',3,'Competitivo','Contribuye de forma funcional y estable al equipo mediante conexión colectiva en la mayoría de situaciones habituales.'),
  ('COL-04','1.0',4,'Avanzado','Adapta su conducta a compañeros, rol y contexto; su aportación mejora de forma consistente la coordinación o eficacia colectiva.'),
  ('COL-04','1.0',5,'Dominio / rendimiento','Su impacto trasciende su propia acción: anticipa la acción siguiente y conecta fases del juego sin romper el flujo colectivo. Eleva de forma observable el funcionamiento de compañeros o del grupo.'),
  ('COL-05','1.0',1,'Adquisición','La conducta asociada a liderazgo funcional es escasa o genera con frecuencia fricción, desconexión o pérdida de eficacia colectiva.'),
  ('COL-05','1.0',2,'Funcional controlado','La muestra cuando se le solicita o en contextos sencillos, pero es poco consistente cuando cambia el rol, aumenta la presión o no recibe protagonismo.'),
  ('COL-05','1.0',3,'Competitivo','Contribuye de forma funcional y estable al equipo mediante liderazgo funcional en la mayoría de situaciones habituales.'),
  ('COL-05','1.0',4,'Avanzado','Adapta su conducta a compañeros, rol y contexto; su aportación mejora de forma consistente la coordinación o eficacia colectiva.'),
  ('COL-05','1.0',5,'Dominio / rendimiento','Su impacto trasciende su propia acción: hace mejores a los demás y adapta su forma de liderar a la necesidad del grupo. Eleva de forma observable el funcionamiento de compañeros o del grupo.'),
  ('COL-06','1.0',1,'Adquisición','La conducta asociada a responsabilidad y fiabilidad es escasa o genera con frecuencia fricción, desconexión o pérdida de eficacia colectiva.'),
  ('COL-06','1.0',2,'Funcional controlado','La muestra cuando se le solicita o en contextos sencillos, pero es poco consistente cuando cambia el rol, aumenta la presión o no recibe protagonismo.'),
  ('COL-06','1.0',3,'Competitivo','Contribuye de forma funcional y estable al equipo mediante responsabilidad y fiabilidad en la mayoría de situaciones habituales.'),
  ('COL-06','1.0',4,'Avanzado','Adapta su conducta a compañeros, rol y contexto; su aportación mejora de forma consistente la coordinación o eficacia colectiva.'),
  ('COL-06','1.0',5,'Dominio / rendimiento','Su impacto trasciende su propia acción: es fiable de forma sostenida y favorece estándares colectivos mediante su conducta. Eleva de forma observable el funcionamiento de compañeros o del grupo.')
)
insert into public.player360_evaluation_rubric_anchors(rubric_id,level,label,criteria)
select r.id,a.level,a.label,a.criteria
from a
join public.player360_evaluation_metrics m on m.team_season_id is null and upper(m.code)=upper(a.code)
join public.player360_evaluation_rubrics r on r.metric_definition_id=m.id and r.rubric_version=a.rubric_version
where not exists(
  select 1 from public.player360_evaluation_rubric_anchors x where x.rubric_id=r.id and x.level=a.level
);

create or replace function public.iq_v4_can_access_player_passport(p_player_id uuid,p_team_season_id uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $fn$
declare v_role text; v_ent jsonb; v_is_test boolean:=false;
begin
  if auth.uid() is null or not public.iq_account_is_active() then return false; end if;
  if not public.iq_v4_can_view_player360_team_season(p_team_season_id) then return false; end if;
  if not exists(
    select 1 from public.roster_membership_stints s
    where s.player_id=p_player_id and s.team_season_id=p_team_season_id
  ) and not exists(
    select 1 from public.players p join public.team_seasons ts on ts.team_id=p.team_id
    where p.id=p_player_id and ts.id=p_team_season_id
  ) then return false; end if;

  select upper(coalesce(up.global_role,up.role,'USER')) into v_role
  from public.user_profiles up where up.id=auth.uid();

  if public.iq_v3_is_global_superadmin() or v_role='ADMIN' then return true; end if;

  select coalesce(sc.is_test,false) into v_is_test
  from public.team_seasons ts join public.season_catalog sc on sc.id=ts.season_id
  where ts.id=p_team_season_id;
  if v_is_test then return true; end if;

  v_ent:=public.iq_saas_entitlement_check('PLAYER',p_player_id,p_team_season_id,'PLAYER_PASSPORT',1);
  return coalesce((v_ent->>'allowed')::boolean,false);
exception when others then
  return false;
end
$fn$;
revoke all on function public.iq_v4_can_access_player_passport(uuid,uuid) from public,anon;
grant execute on function public.iq_v4_can_access_player_passport(uuid,uuid) to authenticated;

create or replace function iq_private.iq_v4_score_is_player_passport(p_metric_code text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.player360_evaluation_metrics m
    join public.player360_evaluation_rubrics r on r.metric_definition_id=m.id
    where upper(m.code)=upper(coalesce(p_metric_code,'')) and r.rubric_version='1.0'
  );
$$;
revoke all on function iq_private.iq_v4_score_is_player_passport(text) from public,anon,authenticated;

create or replace function iq_private.iq_v4_passport_score_access(p_evaluation_id uuid,p_metric_code text)
returns boolean language sql stable security definer set search_path=''
as $$
  select case
    when not iq_private.iq_v4_score_is_player_passport(p_metric_code) then true
    else exists(
      select 1 from public.player_evaluations e
      where e.id=p_evaluation_id
        and public.iq_v4_can_access_player_passport(e.player_id,e.team_season_id)
    )
  end;
$$;
revoke all on function iq_private.iq_v4_passport_score_access(uuid,text) from public,anon,authenticated;

alter table public.player_evaluation_scores enable row level security;
drop policy if exists iq_player_passport_scores_commercial_gate on public.player_evaluation_scores;
create policy iq_player_passport_scores_commercial_gate
on public.player_evaluation_scores
as restrictive
for select
to authenticated
using(iq_private.iq_v4_passport_score_access(evaluation_id,metric_code));

alter table public.player360_evaluation_rubrics enable row level security;
alter table public.player360_evaluation_rubric_anchors enable row level security;
alter table public.player_evaluation_evidence enable row level security;
alter table public.player360_measurements enable row level security;
revoke all on public.player360_evaluation_rubrics,public.player360_evaluation_rubric_anchors,
  public.player_evaluation_evidence,public.player360_measurements from public,anon,authenticated;

create or replace function public.iq_v4_player_passport_snapshot(p_player_id uuid,p_team_season_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_player jsonb; v_evaluations jsonb; v_measurements jsonb; v_team jsonb;
begin
  if not public.iq_v4_can_access_player_passport(p_player_id,p_team_season_id) then
    raise exception 'PLAYER_PASSPORT_ACCESS_DENIED' using errcode='42501';
  end if;

  select to_jsonb(p) into v_player from public.players p where p.id=p_player_id;
  if v_player is null then raise exception 'PLAYER_NOT_FOUND'; end if;

  select jsonb_build_object(
    'team_season_id',ts.id,'team_id',ts.team_id,'team_name',t.name,
    'season_id',ts.season_id,'season_name',sc.name,'season_code',sc.code
  ) into v_team
  from public.team_seasons ts
  join public.teams t on t.id=ts.team_id
  join public.season_catalog sc on sc.id=ts.season_id
  where ts.id=p_team_season_id;

  select coalesce(jsonb_agg(x order by x.evaluation_date desc,x.created_at desc),'[]'::jsonb)
  into v_evaluations
  from (
    select e.id,e.evaluation_key,e.revision,e.evaluation_date,e.title,e.evaluation_type,
      e.source_type,e.evaluator_name,e.summary,e.strengths,e.development_priorities,
      e.is_private,e.share_with_player,e.status,e.metadata,e.created_at,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',s.id,'metric_code',s.metric_code,'domain_code',s.domain_code,'metric_name',s.metric_name,
          'score',s.score,'scale_min',s.scale_min,'scale_max',s.scale_max,
          'confidence',s.confidence,'confidence_label',s.confidence_label,
          'evaluation_context',coalesce(s.evaluation_context,s.metadata->>'evaluation_context'),
          'evidence_count',coalesce(s.evidence_count,nullif(s.metadata->>'evidence_count','')::integer,0),
          'notes',s.notes,'evidence',s.evidence,'metadata',s.metadata,
          'rubric_id',s.rubric_id
        ) order by s.metric_code)
        from public.player_evaluation_scores s
        where s.evaluation_id=e.id and iq_private.iq_v4_score_is_player_passport(s.metric_code)
      ),'[]'::jsonb) scores
    from public.player_evaluations e
    where e.player_id=p_player_id and e.team_season_id=p_team_season_id
      and e.status<>'ARCHIVED'
      and (not e.is_private or public.iq_v4_can_view_private_evaluation(p_team_season_id))
  ) x;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.measured_at desc),'[]'::jsonb)
  into v_measurements
  from public.player360_measurements m
  where m.player_id=p_player_id and (m.team_season_id is null or m.team_season_id=p_team_season_id);

  return jsonb_build_object(
    'allowed',true,'player',v_player,'team',v_team,
    'evaluations',v_evaluations,'measurements',v_measurements
  );
end
$fn$;
revoke all on function public.iq_v4_player_passport_snapshot(uuid,uuid) from public,anon;
grant execute on function public.iq_v4_player_passport_snapshot(uuid,uuid) to authenticated;

create or replace function public.iq_v4_save_player_passport_evaluation(
  p_team_season_id uuid,p_player_id uuid,p_evaluation_date date,p_title text,
  p_context text,p_scores jsonb,p_summary text default null,p_strengths text default null,
  p_development_priorities text default null,p_existing_evaluation_id uuid default null
)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_id uuid; v_item jsonb; v_context text:=upper(trim(coalesce(p_context,'')));
begin
  if not public.iq_v4_can_access_player_passport(p_player_id,p_team_season_id) then
    raise exception 'PLAYER_PASSPORT_ACCESS_DENIED' using errcode='42501';
  end if;
  if not public.iq_v4_can_manage_evaluation(p_team_season_id) then
    raise exception 'PLAYER_PASSPORT_EDIT_DENIED' using errcode='42501';
  end if;
  if v_context not in ('T','JR','P5','VIDEO') then raise exception 'PLAYER_PASSPORT_CONTEXT_INVALID'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_scores,'[]'::jsonb)) loop
    if nullif(v_item->>'score','') is not null and (v_item->>'score')::integer not between 1 and 5 then
      raise exception 'PLAYER_PASSPORT_SCORE_INVALID:%',v_item->>'metric_code';
    end if;
  end loop;

  select public.iq_v4_save_player_evaluation(
    p_team_season_id,p_player_id,p_evaluation_date,p_title,'PASSPORT','CLUB_COACH',
    null,p_summary,p_strengths,p_development_priorities,false,false,
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'metric_code',upper(x->>'metric_code'),
          'score',(x->>'score')::numeric,
          'confidence',case upper(coalesce(x->>'confidence','MEDIUM'))
            when 'LOW' then 0.35 when 'HIGH' then 0.9 else 0.65 end,
          'notes',nullif(x->>'notes',''),
          'evidence',null,
          'metadata',jsonb_build_object(
            'evaluation_context',v_context,
            'evidence_count',greatest(coalesce(nullif(x->>'evidence_count','')::integer,0),0),
            'confidence_label',upper(coalesce(x->>'confidence','MEDIUM')),
            'rubric_version',coalesce(x->>'rubric_version','1.0')
          )
        )
      ),'[]'::jsonb)
      from jsonb_array_elements(p_scores) x
      where nullif(x->>'score','') is not null
    ),
    jsonb_build_object('module','PLAYER_PASSPORT','schema_version','1.0'),
    jsonb_build_object('evaluation_context',v_context),
    p_existing_evaluation_id
  ) into v_id;

  update public.player_evaluation_scores s
  set evaluation_context=v_context,
      evidence_count=coalesce(nullif(j.item->>'evidence_count','')::integer,0),
      confidence_label=upper(coalesce(j.item->>'confidence','MEDIUM')),
      rubric_id=r.id
  from (
    select value item from jsonb_array_elements(p_scores)
  ) j
  join public.player360_evaluation_metrics m
    on m.team_season_id is null and upper(m.code)=upper(j.item->>'metric_code')
  join public.player360_evaluation_rubrics r
    on r.metric_definition_id=m.id and r.rubric_version=coalesce(j.item->>'rubric_version','1.0')
  where s.evaluation_id=v_id and upper(s.metric_code)=upper(j.item->>'metric_code');

  return v_id;
end
$fn$;
revoke all on function public.iq_v4_save_player_passport_evaluation(uuid,uuid,date,text,text,jsonb,text,text,text,uuid) from public,anon;
grant execute on function public.iq_v4_save_player_passport_evaluation(uuid,uuid,date,text,text,jsonb,text,text,text,uuid) to authenticated;

create or replace function public.iq_v4_save_player_measurement(
  p_player_id uuid,p_team_season_id uuid,p_test_code text,p_value numeric,p_unit text,
  p_measured_at timestamptz,p_protocol_code text default null,p_protocol_version text default null,p_notes text default null
)
returns uuid language plpgsql security definer set search_path=''
as $fn$
declare v_id uuid;
begin
  if not public.iq_v4_can_access_player_passport(p_player_id,p_team_season_id)
     or not public.iq_v4_can_manage_evaluation(p_team_season_id) then
    raise exception 'PLAYER_MEASUREMENT_WRITE_DENIED' using errcode='42501';
  end if;
  insert into public.player360_measurements(
    player_id,team_season_id,test_code,value,unit,measured_at,protocol_code,protocol_version,notes,created_by,updated_by
  ) values(
    p_player_id,p_team_season_id,upper(trim(p_test_code)),p_value,trim(p_unit),p_measured_at,
    nullif(trim(coalesce(p_protocol_code,'')),''),nullif(trim(coalesce(p_protocol_version,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),auth.uid(),auth.uid()
  ) returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.iq_v4_save_player_measurement(uuid,uuid,text,numeric,text,timestamptz,text,text,text) from public,anon;
grant execute on function public.iq_v4_save_player_measurement(uuid,uuid,text,numeric,text,timestamptz,text,text,text) to authenticated;

commit;
