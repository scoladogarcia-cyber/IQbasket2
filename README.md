# IQBasket2

Aplicación web de gestión, registro y analítica de baloncesto.

## Estado del desarrollo

`main` contiene el modelo histórico v3 validado, Player 360 4A–4D.2 y
la base de privacidad/ABAC 4E.1.

La rama segura `feature/player360-nutrition-recovery-v1` incorpora 4E.2 y ya
ha instalado en Supabase, mediante Controlled Apply validado:

- catálogo configurable de Nutrition + Recovery;
- 9 métricas iniciales de hábitos/sensaciones, sin peso, calorías, diagnósticos,
  medicación ni texto libre;
- check-ins manuales por fecha y dentro del stint real del jugador;
- origen manual derivado por backend;
- lectura/escritura exclusivamente por RPC + ABAC;
- edición con procedencia original preservada;
- archivo lógico;
- pestaña Player 360 `🌱 Apoyo`;
- flujo `Añadir check-in → Cancelar / Guardar`;
- recomendaciones deterministas, explicables, no clínicas y sin IA;
- importación de apps/wearables preparada como evolución futura pero desactivada.

Neuro-Cognitive continúa fuera de esta fase. Los datos wellness tampoco se
mezclan todavía con el snapshot longitudinal 4D porque esa lectura genérica no
es aún ABAC-aware.

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
node tests/player360-phase4e2-wellness-foundation.mjs
node tests/player360-phase4e2-sql-structure.mjs
node tests/player360-phase4e2-service-route.mjs
# UI real: tests/player360-phase4e2-ui-smoke.mjs (Playwright / GitHub Actions)
node tests/season-head-coach-history-regression.mjs
node tests/session-switch-regression.mjs
```

La rama dispone de GitHub Actions para ejecutar el build automáticamente en pushes y pull requests.

## Siguiente fase

La Fase 4E.2 ya dispone de backend, servicio, UI manual y recomendaciones
deterministas. La siguiente puerta funcional es gestionar desde la propia app
las autorizaciones/grants de 4E.1 para que un usuario pueda activar el seguimiento
sin operaciones manuales de base de datos.

Después se podrán añadir tendencias wellness protegidas y, en una fase posterior,
adaptadores para importar datos desde apps/wearables. La importación externa y
la IA sobre wellness siguen desactivadas. Neuro-Cognitive permanece fuera de
alcance por ahora.

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
