# Auditoría de Supabase para IQ Basket

## Objetivo

Revisar el esquema y la calidad de datos antes de aplicar limpieza, normalización o la migración RBAC v2.

## Archivo seguro

`audit/00_readonly_inventory.sql` contiene exclusivamente consultas `SELECT`. No crea, actualiza ni elimina información.

## Flujo recomendado

1. Ejecutar primero la auditoría en el proyecto real.
2. Revisar tablas, columnas, RLS, policies, relaciones e inconsistencias.
3. Comparar el esquema real con `migrations/20260901_rbac_v2.sql`.
4. Preparar una segunda migración específica de limpieza/backfill.
5. Probar antes de ejecutar cambios destructivos.

Nunca debe eliminarse o fusionarse información histórica de temporadas, equipos, usuarios, partidos o jugadores sin identificar primero qué registros son realmente duplicados.
