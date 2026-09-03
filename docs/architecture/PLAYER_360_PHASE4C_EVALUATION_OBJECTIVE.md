# IQBasket — Phase 4C Player Evaluation + Objective Profile

## Estado

Diseño en rama aislada `feature/player360-core-v1`.

**No implica despliegue a main ni escritura en Supabase hasta superar el protocolo
preflight → rehearsal con rollback → postrollback → apply controlado → smoke con
rollback → verificación final.**

## Objetivo

Construir la capa subjetiva/semiestructurada de Player 360 sin mezclarla con
estadísticas objetivas ni con futuras conclusiones de IA.

Phase 4C debe permitir:

1. registrar evaluaciones fechadas de un jugador;
2. evaluar métricas técnicas, tácticas, físicas y futuras dimensiones sin
   migraciones de esquema;
3. conservar quién evaluó, con qué procedencia y con qué visibilidad;
4. mantener revisiones históricas en lugar de sobrescribir evidencia;
5. definir un perfil objetivo por jugador y equipo-temporada;
6. medir de forma determinista el gap entre la última evaluación disponible y
   el objetivo;
7. entregar a Phase 4D datos estructurados, trazables y comparables.

## Principios

### 1. Métrica configurable, no columna fija

No se crearán columnas como `shooting`, `speed` o `decision_making`.

Se utilizará un catálogo `player360_evaluation_metrics` con:

- código estable;
- dominio;
- nombre y descripción;
- escala mínima/máxima/paso;
- dirección de mejora;
- sensibilidad;
- ámbito global o de equipo-temporada.

Un registro global actúa como plantilla. Una métrica de equipo-temporada puede
añadir o sustituir por código una definición global.

Esto permite ampliar el producto sin alterar el esquema.

### 2. El histórico conserva la semántica original

Cada puntuación guarda un snapshot de:

- código;
- dominio;
- nombre;
- escala;
- dirección de mejora.

Aunque el catálogo cambie en el futuro, una evaluación histórica seguirá
significando exactamente lo que significaba cuando se creó.

### 3. Revisiones append-first

Editar una evaluación no destruye la anterior.

Cada evaluación lógica tiene:

- `evaluation_key`;
- `revision`;
- `supersedes_evaluation_id`;
- estado `CURRENT | SUPERSEDED | ARCHIVED`.

Una edición crea una nueva revisión y marca la anterior como `SUPERSEDED`.

El perfil objetivo sigue el mismo patrón mediante:

- `profile_key`;
- `revision`;
- `supersedes_profile_id`.

### 4. Temporalidad deportiva obligatoria

Una evaluación solo puede registrarse si el jugador era elegible para ese
`team_season` en la fecha evaluada, utilizando
`iq_v3_player_eligible_on_date(...)`.

El perfil objetivo también queda asociado a un jugador elegible en su fecha de
vigencia.

### 5. Privacidad

`player_evaluations` admite evaluación estándar y privada.

Phase 4C no concede acceso backend a jugador/familia aunque exista
`share_with_player` como capacidad futura. El acceso propio/tutor se abrirá
solo cuando exista la validación ABAC contextual completa.

### 6. IA separada

Las evaluaciones son evidencia humana estructurada.

La IA de Phase 4D podrá analizarlas, pero:

- no modifica evaluaciones;
- no inventa métricas ausentes;
- no se almacena como puntuación objetiva;
- consume evidencia con procedencia y limitaciones.

## Modelo de datos propuesto

### `player360_evaluation_metrics`

Catálogo versionable/configurable.

Ámbito:

- `team_season_id = null`: plantilla global;
- `team_season_id != null`: definición específica del equipo-temporada.

Campos principales:

- `code`
- `domain_code`
- `name`
- `description`
- `scale_min`
- `scale_max`
- `scale_step`
- `higher_is_better`
- `sensitivity`
- `is_active`
- `sort_order`

### `player_evaluations`

Cabecera de evaluación.

Incluye:

- jugador;
- equipo-temporada;
- fecha;
- título/tipo;
- fuente;
- evaluador interno o externo;
- resumen;
- fortalezas;
- prioridades de desarrollo;
- privacidad;
- procedencia;
- revisión.

### `player_evaluation_scores`

Una fila por métrica evaluada.

Incluye:

- puntuación;
- confianza opcional;
- nota/evidencia;
- snapshot completo de la definición.

### `player_objective_profiles`

Perfil objetivo versionado.

Solo puede existir un perfil `ACTIVE` por jugador/equipo-temporada.

Incluye:

- fecha efectiva;
- horizonte/fecha objetivo;
- nombre;
- racional;
- versión;
- procedencia.

### `player_objective_targets`

Objetivo por métrica.

Incluye:

- puntuación objetivo;
- peso/prioridad;
- nota;
- snapshot de métrica.

## Gaps

La función de gap debe usar:

- perfil objetivo ACTIVE seleccionado;
- última revisión CURRENT de cada evaluación;
- última puntuación cronológica disponible por `metric_code`.

Para métricas `higher_is_better=true`:

`improvement_gap = target_score - current_score`

Para métricas `higher_is_better=false`:

`improvement_gap = current_score - target_score`

Un valor positivo significa margen pendiente de mejora.

La ausencia de evaluación produce `current_score = null`; nunca se convierte
en cero.

## Seguridad backend

Helpers separados:

- `iq_v4_can_view_evaluation(team_season)`
- `iq_v4_can_view_private_evaluation(team_season)`
- `iq_v4_can_manage_evaluation(team_season)`
- `iq_v4_can_manage_objective_profile(team_season)`

Aunque algunos roles coincidan inicialmente, las acciones quedan desacopladas
para evolucionar a ABAC.

Las tablas de 4C permitirán SELECT bajo RLS.

Las mutaciones directas INSERT/UPDATE/DELETE para `authenticated` quedarán
revocadas. Las escrituras se realizarán por RPC controlada.

## RPC previstas

- `iq_v4_list_evaluation_metrics`
- `iq_v4_save_player_evaluation`
- `iq_v4_archive_player_evaluation`
- `iq_v4_save_objective_profile`
- `iq_v4_archive_objective_profile`
- `iq_v4_get_player_objective_gap`
- `iq_v4_evaluation_capabilities`

## Frontend previsto

### `services/player360/EvaluationService.js`

Única responsabilidad: acceso a RPC/read models de 4C.

### `domain/player360/ObjectiveGapCalculator.js`

Motor puro para pruebas, visualización y fallback determinista.

### `views/Player360View.js`

Vista player-centric reutilizable para:

- Evaluación;
- Perfil objetivo;
- futuro Analytics;
- futura IA.

No se integrará 4C como lógica dispersa dentro de PlayerStatsView.

### Integración

`#/player360/:playerId`

PlayerStatsView podrá enlazar a Player 360 sin mezclar responsabilidades.

## Secuencia segura

1. Preflight read-only.
2. SQL de migración en rama.
3. Test estructural SQL.
4. Rehearsal completo con forced rollback.
5. Postrollback read-only.
6. Apply controlado.
7. Postapply read-only.
8. Smoke funcional con rollback.
9. Verificación postsmoke.
10. Service/UI desktop y móvil.
11. Release candidate antes de main.
