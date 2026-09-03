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
- Fase 4C RC: evaluación humana, perfil objetivo y gaps deterministas;
- rutas y vistas responsive de Entrenamiento y Player 360;
- pruebas de dominio, servicio, SQL, RBAC y navegador sin escrituras reales.

La rama no debe fusionarse con `main` hasta completar la validación funcional
de 4C y la revisión de los checks remotos.

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
node tests/season-head-coach-history-regression.mjs
```

La rama dispone de GitHub Actions para ejecutar el build automáticamente en pushes y pull requests.

## Siguiente fase

La Fase 4D añadirá analítica longitudinal e interpretación mediante IA. Las
salidas de IA deberán conservar trazabilidad, cobertura de datos, versión del
modelo y separación estricta respecto a mediciones y evaluaciones humanas.

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
