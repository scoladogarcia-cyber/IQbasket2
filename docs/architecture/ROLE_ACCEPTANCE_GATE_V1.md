# IQBasket · Role Acceptance Gate V1

## Objetivo

Validar de forma reproducible que la interfaz respeta el modelo RBAC real en desktop y móvil, especialmente la regla de producto:

> Un perfil de lectura puede consultar todo el contenido deportivo de su alcance, pero no debe modificar datos ni recibir affordances de edición engañosos.

## Incidencias corregidas

### 1. Configuración dependía del nombre del rol

`TranslationsView` tenía una condición que forzaba a JUGADOR, FAMILIA_TUTOR, VISOR e INVITADO a unas pestañas concretas incluso cuando `PermissionService` les concedía lectura.

Se sustituye por:

- `_visibleSettingsTabs()`;
- `_ensureVisibleActiveTab()`.

La fuente de verdad vuelve a ser la matriz RBAC.

Consecuencia:

- INVITADO puede consultar Clubs/Equipos, Plantilla, Temporadas y sus Solicitudes dentro de su alcance.
- Usuarios, Traducciones y Simulación siguen ocultos porque no tiene sus permisos.
- No se amplía ningún permiso backend ni RLS.

### 2. Edición de Club/Equipo dependía de un read-only global

El flag global consideraba editable a un Entrenador porque puede modificar plantilla. Eso podía habilitar campos de Club/Equipo aunque el Entrenador no tuviera `MANAGE_CLUBS` o `MANAGE_TEAMS`.

Se separan capacidades por recurso:

- `canManageClubData` → `MANAGE_CLUBS`;
- `canManageTeams` → `MANAGE_TEAMS`.

Los handlers ya validaban permisos reales en backend/frontend; ahora el formulario también refleja correctamente esa autorización.

## UX read-only

Cuando un perfil puede leer pero no modificar:

- «Editar Club» pasa a «Ver Club».
- «Configurar» pasa a «Ver Equipo».
- todos los campos del detalle quedan deshabilitados;
- no aparece botón Guardar;
- la navegación entre equipos autorizados sigue disponible;
- no aparecen formularios de alta/modificación de plantilla para INVITADO.

## Gate de navegador

`tests/role-acceptance-ui-smoke.mjs` ejecuta:

- SUPERADMIN desktop 1440×900;
- SUPERADMIN iPhone 390×844;
- ADMIN desktop;
- ADMIN iPhone;
- ENTRENADOR desktop;
- ENTRENADOR iPhone;
- INVITADO desktop;
- INVITADO iPhone.

Valida:

- pestañas de Configuración;
- alcance de equipos;
- permisos de edición Club/Equipo;
- permisos de plantilla;
- ausencia de mutaciones para INVITADO;
- drawer móvil, scroll, logout y ausencia de overflow horizontal.

El bottom sheet se valida una vez finalizada su transición CSS para evitar falsos positivos sobre frames intermedios.

## Principio de seguridad

La UI nunca sustituye a la autorización real.

Las escrituras continúan validadas por:

1. `PermissionService.can(...)`;
2. servicios de dominio;
3. RPC/RLS/constraints de Supabase cuando corresponda.

Este gate protege coherencia de UX y evita que una futura refactorización vuelva a ofrecer controles que el backend rechazaría.
