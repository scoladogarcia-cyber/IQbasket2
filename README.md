# IQBasket2

Aplicación web de gestión, registro y analítica de baloncesto.

## Estado del desarrollo

`main` contiene el modelo histórico v3 validado y Player 360 4A–4D.1:
temporadas globales, equipo-temporada, plantillas por intervalos, transferencias,
entrenador principal por temporada, entrenamiento, tecnificación externa,
evaluación humana, perfil objetivo, gaps y persistencia longitudinal/IA.

La rama segura `feature/player360-analytics-ai-ui-v1` desarrolla 4D.2 sobre
ese baseline y añade:

- adaptador de evidencia real para competición, entrenamiento, tecnificación y evaluación;
- cálculo longitudinal sensible a los stints reales de plantilla;
- fingerprint SHA-256 reproducible de las fuentes del snapshot;
- pestaña responsive `Evolución + IA` dentro de Player 360;
- tendencias y cobertura deterministas, sin etiquetar automáticamente subir/bajar como bueno/malo;
- asociaciones explícitamente descriptivas y no causales;
- lectura y revisión humana de insights IA persistidos;
- generación externa de IA desactivada en frontend hasta disponer de adaptador backend seguro;
- pruebas de dominio, orquestación, RBAC y navegador desktop/iPhone.

Recovery/Nutrition/Neuro continúan restringidos hasta implantar su fase específica
de privacidad, consentimiento y ABAC.

## Seguridad de la base de datos

La migración:

`supabase/migrations/20260901_rbac_v2.sql`

está **deprecada y NO debe ejecutarse**. Fue creada antes de auditar el esquema real de Supabase.

Los borradores y rehearsals que terminan en `ROLLBACK` permanecen en
`supabase/drafts/`. Las migraciones controladas, verificadores read-only y
rollbacks explícitos de v3 y Player 360 están en `supabase/ready/`.

No debe ejecutarse ningún SQL por nombre o fecha únicamente: cada aplicación
requiere preflight, rehearsal, apply controlado y verificación posterior de su
misma fase.

## Documentación principal

- `docs/architecture/DATA_V3_MIGRATION_PLAN.md`
- `docs/performance/EGRESS_AUDIT_2026-09-01.md`
- `supabase/audit/10_pre_migration_snapshot.sql`

## Desarrollo

```bash
npm ci
npm run dev
```

Validación de build:

```bash
npm run build
```

Validación principal de Player 360:

```bash
node tests/player360-foundation-smoke.mjs
node tests/player360-phase4b-service-smoke.mjs
node tests/player360-phase4c-domain-service-smoke.mjs
node tests/player360-phase4c-route-integration.mjs
node tests/player360-phase4d-foundation-smoke.mjs
node tests/player360-phase4d-sql-structure.mjs
node tests/player360-phase4d-service-smoke.mjs
node tests/player360-phase4d-orchestrator-smoke.mjs
# UI real: tests/player360-phase4d-ui-smoke.mjs (Playwright / GitHub Actions)
node tests/season-head-coach-history-regression.mjs
node tests/session-switch-regression.mjs
```

La rama dispone de GitHub Actions para ejecutar el build automáticamente en pushes y pull requests.

## Siguiente fase

La Fase 4D.2 completa la primera experiencia de analítica longitudinal:
datos reales → snapshot determinista → evidencia → visualización → insight IA
persistido → revisión humana. La llamada a un modelo externo sigue bloqueada
hasta desplegar un endpoint backend seguro y auditable; nunca debe exponerse una
clave de proveedor en el navegador.

La siguiente puerta estructural será 4E: privacidad, consentimiento y ABAC para
poder habilitar Recovery/Nutrition y, posteriormente, Neuro. Las salidas de IA
permanecen separadas de mediciones y evaluaciones humanas y no autorizan
inferencias causales.

## Principio de migración

Nunca eliminar o renombrar datos existentes durante la primera fase.

Orden obligatorio:

1. backup;
2. crear estructuras nuevas;
3. copiar/relacionar;
4. validar;
5. adaptar la aplicación;
6. comparar resultados;
7. activar RLS definitivo;
8. retirar legacy únicamente tras validación explícita.
