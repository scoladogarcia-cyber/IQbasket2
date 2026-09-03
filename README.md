# IQBasket2

Aplicación web de gestión, registro y analítica de baloncesto.

## Estado del desarrollo

`main` contiene el modelo histórico v3 validado: temporadas globales,
equipo-temporada, plantillas por intervalos, transferencias y entrenador
principal aislado por temporada.

La evolución Player 360 se mantiene en la rama segura
`feature/player360-core-v1`. Esta rama incorpora `main` y contiene:

- Fase 4A: contratos de observaciones, cobertura y permisos;
- Fase 4B: sesiones, asistencia, carga y desarrollo externo;
- Fase 4C: evaluación humana, perfil objetivo y gaps deterministas, instalada y validada;
- Fase 4D.1: series longitudinales, snapshots deterministas y evidencia trazable para IA, instalada y validada;
- autorización 4D granular para ver/generar analítica, ver/generar IA y revisar IA;
- rutas y vistas responsive de Entrenamiento y Player 360;
- pruebas de dominio, servicio, SQL, RBAC, navegador, preflight, rehearsal y controlled apply.

La rama ha completado la validación funcional 4B/4C/4D y está preparada para
integrarse en `main` mediante PR, manteniendo Recovery/Nutrition/Neuro
restringidos hasta su fase específica de privacidad/ABAC.

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
node tests/season-head-coach-history-regression.mjs
node tests/session-switch-regression.mjs
```

La rama dispone de GitHub Actions para ejecutar el build automáticamente en pushes y pull requests.

## Siguiente fase

La Fase 4D.1 ya dispone de persistencia controlada instalada para snapshots
longitudinales e insights de IA, con RLS, RPC de escritura, trazabilidad de
proveedor/modelo/prompt, revisión humana y rollback explícito. El siguiente
bloque funcional es completar la experiencia de uso de analítica/IA y abordar
Recovery/Nutrition/Neuro mediante privacidad y ABAC antes de habilitar datos
sensibles. Las salidas de IA permanecen separadas de mediciones y evaluaciones
humanas y no autorizan inferencias causales.

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
