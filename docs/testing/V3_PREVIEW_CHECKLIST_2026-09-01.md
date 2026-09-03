# IQBasket v3 — Checklist de preview móvil/web

Snapshot de prueba previo a la activación de RLS.

## Objetivo

Validar el runtime v3 contra la base real manteniendo RLS desactivado y sin tocar `main`.

## Pruebas mínimas

1. **Login SUPERADMIN**
   - Iniciar sesión con la cuenta maestra.
   - Debe entrar sin errores.
   - Debe mantener acceso completo.

2. **Selector de equipo**
   - Deben aparecer los equipos reales autorizados.
   - No debe aparecer ningún equipo ficticio/fallback.

3. **Temporada**
   - Debe mostrarse la temporada global `2025/2026`.
   - El contexto interno debe resolverse mediante `team_season`.

4. **JMJ Manyanet Sant Andreu**
   - Jugadores visibles.
   - Partidos visibles.
   - Estadísticas visibles.
   - Abrir al menos un partido existente.

5. **Mini Femenino**
   - Cambiar de equipo.
   - Comprobar los partidos de prueba existentes.
   - Confirmar que no se mezclan con Manyanet.

6. **Edición controlada**
   - Abrir un registro existente.
   - Comprobar que la pantalla de edición carga.
   - No es necesario guardar cambios durante la primera pasada.

7. **Responsive iPhone**
   - Navegación inferior.
   - Menú “Más”.
   - Selectores de equipo y temporada.
   - Sin scroll horizontal.
   - Botones utilizables con una mano.

8. **Sesión**
   - Recargar Safari.
   - La sesión debe restaurarse correctamente.
   - Debe conservar el equipo/temporada activa.

## Criterio de avance a RLS

No activar RLS hasta que:
- login funcione;
- equipos/temporada estén correctamente aislados;
- jugadores, partidos y estadísticas carguen;
- no existan errores funcionales bloqueantes;
- el flujo de permisos contextual esté validado en preview.
