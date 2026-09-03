# IQBasket — Phase 4A Player 360 Foundation

## Estado

Implementación en rama aislada `feature/player360-core-v1`.

**No modifica Supabase. No modifica `main`. No activa nuevas rutas de usuario.**

## Objetivo

Crear la base común sobre la que se construirán Training, External Development,
Evaluation, Objective Profile, Data Coverage, Analytics longitudinal, AI
Insights, Recovery, Nutrition y conectores Neuro/wearables.

## Decisiones arquitectónicas

### 1. Observación normalizada y desacoplada

Toda fuente futura debe poder transformarse a un contrato común:

- `player_id`
- `team_season_id` cuando aplique
- `occurred_at`
- `module`
- `source_type`
- `source_id`
- `metric_code`
- `value`
- `unit`
- `quality`
- `confidence`
- `sensitivity`
- `captured_by`
- `provenance`
- `metadata`

El contrato no depende de Supabase ni de un proveedor externo.

### 2. Medición e IA son recursos diferentes

La IA nunca se almacena como una medición objetiva.

`normalizePlayer360Observation()` admite fuentes observacionales conocidas pero
no `AI`.

La futura IA recibirá un `PLAYER360_EVIDENCE_V1` construido a partir de hechos
calculados, datos ausentes y limitaciones.

### 3. Data Coverage no mide rendimiento

Coverage responde únicamente a:

> ¿Qué proporción de la información que esperamos está realmente disponible?

Por ello:

- 0 % = no hay información;
- NOT_ENABLED = módulo no activado;
- quality se calcula por separado;
- no se utiliza IA para calcular coverage.

### 4. Privacidad por diseño

Recovery, Nutrition y Neuro/Cognitive están declarados como
`WELLNESS_RESTRICTED` y desactivados por defecto.

Los permisos existen para poder diseñar backend/RLS, pero en Phase 4A no se
conceden a roles ordinarios. Solo SUPERADMIN los recibe por la regla global
existente.

Antes de Phase 4E se requerirá autorización contextual/ABAC y RLS específica.

### 5. Acceso Player/Familia preparado para ABAC

No se concede `VIEW_PLAYER_360` general a jugador o familia.

Se crean capacidades diferentes:

- `VIEW_OWN_PLAYER_360`
- `VIEW_LINKED_PLAYER_360`

La futura validación backend deberá comprobar la relación real con
`user_player_links`.

## Archivos Phase 4A

### `config/player360.config.js`

Configuración central de módulos, etapas, sensibilidad y thresholds de
coverage.

### `domain/player360/contracts.js`

Normalización de observaciones y construcción del paquete de evidencia que
consumirá la futura IA.

### `domain/player360/DataCoverageCalculator.js`

Motor puro/determinista de cobertura.

### `security/permissions.js`

Permisos funcionales granulares. No sustituye RLS ni ABAC.

### `tests/player360-foundation-smoke.mjs`

Smoke sin dependencias externas que valida contratos, coverage, separación
IA/medición y la matriz RBAC.

## Próxima etapa: 4B

Training Core + External Development.

Antes de crear tablas:

1. diseño SQL en `supabase/drafts`;
2. preflight read-only sobre BD real;
3. rehearsal completo con forced rollback;
4. post-rollback verification;
5. apply explícito;
6. post-apply read-only;
7. UI desktop/móvil;
8. smoke funcional sintético con rollback.

No se integrará a `main` hasta completar la release candidate de la fase.
