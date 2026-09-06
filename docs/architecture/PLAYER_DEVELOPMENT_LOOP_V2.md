# Player Development Loop V2

## Objetivo
Cerrar el bucle semanal `OBSERVAR → ENTENDER → ACTUAR → MEDIR → REVISAR` sin convertir un plan sugerido en evidencia histórica ni mezclarlo con Wellness o gamificación.

## Decisiones de arquitectura
- El perfil objetivo sigue siendo la fuente del **qué mejorar**.
- `player_development_cycles` congela por semana la revisión del objetivo y su foco prioritario.
- `player_development_actions` representa 1–3 acciones observables, cada una con ciclo de vida independiente.
- `player_development_action_evidence` vincula evidencia real mediante FK a entrenamiento, tecnificación o partido.
- Player Journey V1 continúa siendo gamificación player-self; un micro-reto no sustituye al ciclo de desarrollo.
- Family consume una proyección propia, sin notas internas ni datos Wellness/Nutrition.

## Seguridad
Las tres tablas tienen RLS y acceso directo del cliente revocado. Toda interacción cruza RPCs `iq_v16_*`.

Permisos funcionales independientes:
- `VIEW_DEVELOPMENT_CYCLE`
- `CREATE_DEVELOPMENT_CYCLE`
- `EDIT_DEVELOPMENT_ACTION`
- `LINK_DEVELOPMENT_EVIDENCE`
- `REVIEW_DEVELOPMENT_CYCLE`

La implementación backend delega hoy la mutación en `iq_v4_can_manage_objective_profile()` y exige temporada/equipo en estado activo. Esto permite separar roles más adelante sin cambiar el esquema ni la UI.

## Invariantes
- Máximo un ciclo por jugador y semana ISO, incluso si cambia de equipo durante la semana.
- El ciclo conserva `objective_profile_key`, revisión y snapshots; una revisión futura no reescribe historia.
- Solo se pueden vincular evidencias que pertenecen al mismo jugador/equipo-temporada.
- Un ciclo no se revisa mientras existan acciones `PLANNED` o `IN_PROGRESS`.
- Una temporada congelada sigue siendo legible pero no mutable.
- Family no recibe `review_note`, `state_note`, RPE, carga interna ni módulos sensibles.

## Flujo
1. Staff con permiso crea el ciclo desde el objetivo activo.
2. Define hasta tres acciones observables.
3. Cada acción progresa `PLANNED → IN_PROGRESS → COMPLETED/SKIPPED`.
4. Staff vincula evidencia real cuando exista.
5. Cuando no quedan acciones abiertas, el ciclo pasa a `REVIEW_DUE`.
6. La revisión decide `CONTINUE`, `ADAPT`, `ACHIEVED` o `PAUSE`.
7. Family ve foco, acciones, estado y evidencia, pero no notas internas.

## Archivos
- `supabase/ready/20260906_apply_player_development_loop_v2.sql`: modelo, RLS y RPCs.
- `supabase/ready/20260906_rollback_player_development_loop_v2.sql`: rollback de la capacidad V2.
- `services/player360/DevelopmentCycleService.js`: frontera de datos del navegador.
- `views/player360/DevelopmentCyclePanel.js`: UI desacoplada de Player360.
- `views/Player360View.js`: integración de la pestaña Plan semanal.
- `services/family/FamilyWorkspaceService.js`: lectura Family con degradación segura de rollout.
- `views/family/FamilyWorkspaceView.js`: presentación del ciclo real con fallback al plan determinista.
- `security/permissions.js`: RBAC funcional independiente.
- `tests/player-development-loop-v2-*.mjs`: contratos y smoke de servicio.

## Extensiones previstas
Sin migrar el modelo central podrán añadirse: asignación de micro-retos a acciones, revisión por segundo entrenador, plantillas por metodología, métricas de adherencia, recomendaciones IA revisables y ABAC por recurso/contexto.
