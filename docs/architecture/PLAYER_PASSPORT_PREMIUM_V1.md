# Player Passport Premium V1

## Objetivo

El Pasaporte del Jugador es una extensión comercial y metodológica de Player 360. No crea un subsistema de evaluación paralelo: reutiliza las evaluaciones versionadas de Phase 4C y añade la semántica específica del catálogo de 69 atributos, sus rúbricas 1–5, evidencia contextual y mediciones objetivas.

## Frontera comercial

El entitlement canónico es `PLAYER_PASSPORT`.

La autorización se resuelve en dos capas independientes:

1. **RBAC/ABAC deportivo**: el usuario debe poder acceder al jugador y al team-season.
2. **Entitlement SaaS**: el módulo debe estar incluido en la licencia efectiva del sujeto.

Excepciones deliberadas:
- SUPERADMIN: acceso habilitado;
- ADMIN: acceso habilitado dentro de su alcance deportivo;
- temporadas marcadas `season_catalog.is_test=true`: acceso demo habilitado.

El cliente nunca concede el entitlement. La RPC `iq_v4_can_access_player_passport` es la frontera autoritativa.

## Compatibilidad

- `players.birth_date` sigue siendo el único dato de nacimiento; la edad se deriva.
- El histórico 0–10 no se convierte a 1–5.
- Los 69 atributos nuevos usan 1–5 y `NE` se representa como ausencia de score.
- Las revisiones siguen siendo append-first mediante `iq_v4_save_player_evaluation`.
- No existe OVR obligatorio.

## Datos añadidos

- `player360_evaluation_rubrics`
- `player360_evaluation_rubric_anchors`
- campos de contexto/evidencia/rúbrica en `player_evaluation_scores`
- `player_evaluation_evidence`
- `player360_measurements`

Las tablas nuevas tienen RLS y no admiten mutación directa desde `authenticated`.

## UX

Ruta: `#/passport/:playerId`.

Sin jugador se muestra un selector. Con jugador se muestra:
- tarjeta de identidad responsive;
- cobertura de evaluación;
- fortalezas;
- roles funcionales explicables;
- asimetrías D/I;
- 69 atributos por dimensión;
- mediciones objetivas;
- editor contextual por dimensión/subdimensión.

En móvil la interfaz pasa a una columna, conserva scroll natural, evita hover-only y mantiene objetivos táctiles de 44 px.

## Despliegue seguro

Orden obligatorio:

1. `20261004_preflight_player_passport_v1_readonly.sql`
2. rehearsal en entorno no productivo;
3. `20261004_apply_player_passport_v1.sql`
4. `20261004_verify_player_passport_v1_readonly.sql`
5. smoke UI/RBAC móvil y desktop;
6. merge solo si Phase 4C/4D y regresión siguen verdes.

El rollback elimina las fronteras ejecutables nuevas, pero conserva tablas/columnas y catálogo si ya existe histórico referenciado.
