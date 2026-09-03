# IQBasket2

Aplicación web de gestión, registro y analítica de baloncesto.

## Estado del desarrollo

`main` contiene el modelo histórico v3 validado y Player 360 4A–4D.2:
temporadas globales, equipo-temporada, plantillas por intervalos, transferencias,
entrenador principal por temporada, entrenamiento, tecnificación externa,
evaluación humana, perfil objetivo, gaps, analítica longitudinal real y
experiencia `Evolución + IA`.

La rama segura `feature/player360-privacy-abac-v1` desarrolla 4E.1 y ya ha
instalado en Supabase, mediante Controlled Apply validado, el sustrato de
privacidad/consentimiento/ABAC:

- relaciones verificables SELF/GUARDIAN;
- autorizaciones de tratamiento por jugador, equipo-temporada, módulo y finalidad;
- solicitudes de acceso sensible separadas de la concesión;
- grants por usuario, acción, módulo, finalidad y vigencia;
- auditoría append-only de cambios de gobierno;
- prohibición de bypass sensible por SUPERADMIN;
- auto-grant administrativo bloqueado;
- IA y exportación sensibles sometidas a autorización/grant explícitos;
- acceso directo a tablas de gobierno cerrado para `authenticated` y `anon`.

Recovery/Nutrition/Neuro siguen **sin tablas de datos ni UI de captura**. 4E.1
instala únicamente la capa de gobierno necesaria para poder diseñarlos con
seguridad.

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
node tests/player360-phase4e-privacy-abac-smoke.mjs
node tests/player360-phase4e-sql-structure.mjs
node tests/season-head-coach-history-regression.mjs
node tests/session-switch-regression.mjs
```

La rama dispone de GitHub Actions para ejecutar el build automáticamente en pushes y pull requests.

## Siguiente fase

La Fase 4E.1 ya dispone de infraestructura de privacidad/ABAC instalada y
validada. El siguiente bloque será diseñar **Nutrition + Recovery** sobre ese
sustrato, sin mezclar datos wellness con estadísticas deportivas y sin conceder
acceso por rol solamente.

La generación externa de IA sigue bloqueada hasta desplegar un endpoint backend
seguro y auditable; nunca debe exponerse una clave de proveedor en el navegador.
Neuro-Cognitive permanecerá para una fase posterior por su mayor sensibilidad y
complejidad.

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
