# RBAC v2 / Supabase

Esta carpeta contiene la migración de seguridad correspondiente a la matriz de roles y permisos de IQ Basket.

## Superadmin único

La única identidad autorizada como `SUPERADMIN` es:

`scolado@nechigroup.com`

La aplicación también lo impone en `security/roles.js`. La migración SQL refuerza la misma regla en base de datos y degrada a `INVITADO` cualquier otro perfil que estuviera marcado como `SUPERADMIN`.

## Roles canónicos

- SUPERADMIN
- ADMIN
- ENTRENADOR
- ANALISTA
- PREPARADOR_FISICO
- JUGADOR
- FAMILIA_TUTOR
- VISOR
- INVITADO

Los roles legacy `SCOUT` y `VIEWER` se normalizan a `ANALISTA` y `VISOR`.

## Antes de producción

1. Crear un backup de la base de datos.
2. Aplicar `migrations/20260901_rbac_v2.sql` primero en un entorno de prueba.
3. Verificar que `user_profiles` vincula correctamente club, equipos y jugadores.
4. Comprobar los flujos de cada rol con la simulación visual del Superadmin.
5. Solo después aplicar la migración en producción.

La aplicación mantiene controles de UI y de servicio, pero la protección definitiva de los datos depende de aplicar estas policies RLS en Supabase.
