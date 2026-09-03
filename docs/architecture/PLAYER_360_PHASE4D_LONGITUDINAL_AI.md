# IQBasket — Phase 4D Longitudinal Analytics + AI Evidence

## Estado

4D.1 está instalada y validada en Supabase. La rama
`feature/player360-analytics-ai-ui-v1` añade 4D.2: adaptación de fuentes reales,
orquestación determinista y experiencia responsive de `Evolución + IA`.

La generación contra un proveedor externo continúa deliberadamente desactivada
en el navegador. La UI solo puede leer/revisar insights persistidos y solicitar
snapshots deterministas; cualquier llamada futura a un modelo deberá ejecutarse
en backend con autenticación, autorización, trazabilidad y secretos fuera del
bundle cliente.

## Objetivo

Conectar temporalmente evidencia de competición, entrenamiento, desarrollo
externo y evaluación sin mezclar sus significados ni formular relaciones
causales que los datos observacionales no permiten demostrar.

## Flujo obligatorio

1. Cada fuente se transforma en `PLAYER360_OBSERVATION_V1`.
2. El motor determinista crea series semanales configurables.
3. Se calculan cobertura temporal, tendencia y asociaciones descriptivas.
4. Solo resultados con muestra suficiente entran como hechos.
5. Ausencias y limitaciones se incorporan explícitamente a la evidencia.
6. La futura IA recibe `PLAYER360_EVIDENCE_V1` y únicamente redacta o
   interpreta esos hechos.
7. La salida de IA se almacenará separada de observaciones, evaluaciones y
   snapshots analíticos.

## Contrato longitudinal v1

El snapshot contiene:

- jugador y equipo-temporada;
- periodo analizado y granularidad semanal;
- versión del contrato y del cálculo;
- series por `module.metric_code`;
- agregación explícita (`SUM`, `AVERAGE`, `MIN`, `MAX` o `LAST`);
- puntos temporales y número de observaciones;
- cobertura de semanas esperadas;
- tendencia con pendiente, cambio y tamaño de muestra;
- asociaciones con desfase, pares utilizados y coeficiente;
- observaciones rechazadas y limitaciones.

## Umbrales iniciales

- Tendencia: mínimo 3 semanas observadas.
- Asociación: mínimo 5 pares temporales.
- La cobertura no mide rendimiento.
- Una asociación se etiqueta siempre como descriptiva.
- `causal_claim_allowed` es siempre `false`.

Estos valores viven en `config/player360-analytics.config.js`; no están
hardcodeados en las vistas ni en los servicios.

## Responsabilidades

### `LongitudinalAnalyticsCalculator`

Agrupa, agrega y calcula. No conoce Supabase, UI ni proveedor de IA.

### `LongitudinalEvidenceAssembler`

Convierte resultados deterministas en hechos, datos ausentes y limitaciones
para el contrato de evidencia. No genera texto clínico, deportivo o táctico.

### `LongitudinalAnalyticsService`

Lee snapshots e insights y encapsula las RPC controladas. No calcula métricas
ni llama a un proveedor de IA. Rechaza contratos o versiones inconsistentes
antes de intentar persistirlos.

### `Player360ObservationAssembler`

Conoce las formas de las fuentes de IQBasket y las transforma al contrato
`PLAYER360_OBSERVATION_V1`. La vista no conoce columnas de tablas ni reglas de
mapeo. Las métricas de competición, entrenamiento y tecnificación se configuran
en `config/player360-analytics.config.js`; las métricas de evaluación se
incorporan desde el catálogo activo.

### `LongitudinalAnalyticsOrchestrator`

Coordina DataStore, TrainingService, EvaluationService, adaptador, calculador,
evidence assembler y persistencia. Aplica los stints reales del jugador para que
las semanas previas a su alta, posteriores a su baja o fuera de un intervalo
válido no penalicen cobertura ni entren en la evidencia. Genera una huella
SHA-256 reproducible de las fuentes normalizadas para mantener idempotencia y
auditabilidad.

### `LongitudinalAnalyticsPanel`

Presenta snapshots, tendencias, cobertura, asociaciones descriptivas e insights
IA persistidos. Puede solicitar nuevos snapshots y revisar insights si RBAC lo
permite. No calcula métricas ni contiene credenciales de proveedor.

### Futuro orquestador de IA

Deberá registrar como mínimo:

- versión del prompt;
- proveedor y modelo;
- evidencia exacta utilizada;
- audiencia;
- idioma;
- fecha de generación;
- estado de revisión humana;
- coste/tokens cuando aplique;
- autor o proceso que solicitó la interpretación.

## Seguridad por acción

Phase 4D no reutiliza permisos genéricos de Player 360 ni permisos del módulo de
evaluaciones para operaciones distintas.

La autorización queda separada en cinco capacidades:

- ver analítica longitudinal;
- generar snapshots longitudinales deterministas;
- ver insights de IA;
- generar insights de IA;
- revisar/aprobar/rechazar/archivar insights de IA.

En frontend estas acciones se representan con permisos independientes
(`VIEW_LONGITUDINAL_ANALYTICS`, `GENERATE_LONGITUDINAL_ANALYTICS`,
`VIEW_AI_INSIGHTS`, `GENERATE_AI_INSIGHTS` y
`REVIEW_AI_INSIGHTS`). En backend, RLS y RPC utilizan helpers separados para
cada acción.

Matriz inicial de mínimo privilegio:

- ADMIN y ENTRENADOR: lectura, generación y revisión;
- ANALISTA y PREPARADOR_FISICO: lectura y generación, sin revisión humana;
- VISOR, JUGADOR, FAMILIA_TUTOR e INVITADO: sin nuevas capacidades 4D en esta
  fase;
- SUPERADMIN: conserva la regla global existente.

Los conjuntos iniciales pueden coincidir en algunas acciones, pero los límites
permanecen desacoplados para evolucionar hacia ABAC por recurso, audiencia,
jugador, equipo-temporada y sensibilidad sin rehacer el esquema.

## Estado de despliegue · 2026-09-03

Phase 4D está instalada en Supabase mediante Controlled Apply.

Validaciones completadas:

- preflight read-only: correcto;
- rehearsal transaccional con rollback forzado: correcto;
- apply controlado: correcto;
- RLS y RPC: correctos;
- grants por defecto de Supabase cerrados explícitamente para `anon` y para el
  helper interno;
- smoke instalado: snapshot determinista + insight sintético + revisión humana,
  sin llamada externa a proveedor de IA y con rollback de los datos de prueba;
- baseline histórico/4B/4C: sin cambios;
- filas sintéticas remanentes: 0 snapshots / 0 insights.

El primer intento de apply detectó que los grants por defecto de Supabase
permitían ejecutar el helper genérico. El workflow revirtió automáticamente
todos los objetos 4D, se endurecieron los `REVOKE` y el rehearsal posterior
confirmó la corrección antes del segundo apply exitoso.

## 4D.2 · Fuentes reales, stints y experiencia de uso

La capa 4D.2 incorpora:

- datos de competición desde estadísticas de partidos elegibles del jugador;
- carga, minutos y RPE de entrenamientos del club;
- carga, minutos y RPE de tecnificación/desarrollo externo;
- puntuaciones del catálogo de evaluación humana;
- exclusión de observaciones de competición fuera de la elegibilidad temporal;
- cobertura semanal limitada a los stints reales de plantilla;
- fingerprint SHA-256 estable de observaciones/definiciones/periodo/stints;
- pestaña `Evolución + IA` responsive;
- revisión humana de insights DRAFT;
- aviso explícito de que las asociaciones no demuestran causalidad.

Validación de navegador:

- desktop 1440×900: PASS;
- iPhone 390×844: PASS;
- generación/refresco de snapshot: PASS;
- revisión humana: PASS;
- overflow horizontal: 0;
- llamadas a proveedor IA desde frontend: 0.

## Seguridad de IA

`PLAYER360_AI_UI_CONFIG.generationEnabled` permanece en `false`. El frontend
no debe contener API keys ni invocar directamente OpenAI, Anthropic u otro
proveedor. La futura generación se implementará mediante un adaptador backend
o Edge Function que:

1. valide sesión, RBAC y contexto de equipo-temporada;
2. recupere el snapshot/evidence bundle autorizado desde servidor;
3. use secretos del proveedor solo en infraestructura segura;
4. registre proveedor, modelo, prompt, audiencia, idioma y costes/tokens;
5. persista la respuesta como recurso IA separado;
6. mantenga revisión humana y auditoría;
7. no convierta inferencias de IA en observaciones objetivas.

## Siguiente puerta de control

La persistencia 4D ya está instalada; **no debe reaplicarse**. Las siguientes
puertas son:

1. integrar 4D.2 en `main` solo después de CI + smoke desktop/móvil;
2. diseñar el endpoint backend seguro para generación IA antes de habilitar
   `generationEnabled`;
3. mantener evaluación humana, datos objetivos e IA como recursos separados;
4. implantar privacidad, consentimiento y ABAC antes de abrir
   Recovery/Nutrition/Neuro;
5. añadir métricas o asociaciones nuevas únicamente mediante configuración y
   pruebas de validez, nunca hardcodeándolas en la UI.
