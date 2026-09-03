# IQBasket — Phase 4D Longitudinal Analytics + AI Evidence

## Estado

Primer bloque de 4D en `feature/player360-core-v1`. El motor es puro, la
persistencia permanece en diseño reversible y todavía no se activa generación
de IA ni se modifica Supabase.

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

## Siguiente puerta de control

Antes de instalar la persistencia 4D:

1. ejecutar el preflight read-only contra la base real;
2. ejecutar el rehearsal con rollback forzado;
3. confirmar que tablas, funciones y datos vuelven al baseline;
4. verificar que 4B y 4C no se alteran;
5. preparar un script de instalación distinto del ensayo;
6. aplicar únicamente tras validación explícita.
