# IQBasket2

Aplicación web de gestión, registro y analítica de baloncesto.

## Estado de la rama de trabajo

La rama `feature/rbac-permissions-v2` contiene trabajo en curso de:

- RBAC y acceso multiusuario;
- reducción de egress de Supabase;
- diseño del modelo de datos v3;
- temporadas globales y contexto equipo-temporada;
- histórico de plantilla;
- analítica precalculada y versionada.

**No fusionar todavía con `main`.**

## Seguridad de la base de datos

La migración:

`supabase/migrations/20260901_rbac_v2.sql`

está **deprecada y NO debe ejecutarse**. Fue creada antes de auditar el esquema real de Supabase.

El nuevo diseño se mantiene, por ahora, fuera de la carpeta de migraciones:

`supabase/drafts/20260901_data_model_v3.sql`

El borrador termina en `ROLLBACK` deliberadamente para impedir una aplicación accidental.

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

La rama dispone de GitHub Actions para ejecutar el build automáticamente en pushes y pull requests.

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
