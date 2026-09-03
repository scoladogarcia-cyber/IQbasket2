# IQBasket · Team-Season Freeze V1

## Objetivo

Cerrar una temporada deportiva sin ocultar ni destruir su histórico.

El cierre de temporada es un **lifecycle de integridad de datos**, distinto de archivar
el vínculo equipo-temporada. IQBasket mantiene la temporada consultable para
estadísticas, informes, Player 360 y análisis, pero bloquea las mutaciones
competitivas hasta una reapertura explícita.

## Modelo de estado

`team_seasons.status` conserva el estado operativo del vínculo:

- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`

`team_seasons.data_status` controla la integridad de los datos:

- `ACTIVE`: datos competitivos editables según RBAC.
- `FROZEN`: histórico visible en modo de sólo lectura.

No se reutiliza `ARCHIVED` para congelar datos. Esto permite conservar una
temporada visible y analizable sin confundir visibilidad con editabilidad.

## Alcance V1

El cierre V1 congela:

1. partidos del equipo-temporada;
2. estadísticas y eventos hijos protegidos por el lifecycle V5 de partidos;
3. membresías de plantilla;
4. intervalos temporales de elegibilidad de plantilla.

No congela en esta versión:

- metadatos del catálogo global de temporadas;
- asignaciones administrativas de staff;
- autorizaciones de privacidad;
- datos de bienestar/Player 360 no competitivos.

Estos módulos podrán incorporarse a una política de cierre ampliada en versiones
posteriores sin cambiar el contrato `data_status`.

## RBAC

| Acción | Superadmin | Admin | Entrenador | Analista | Invitado |
| --- | --- | --- | --- | --- | --- |
| Ver temporada | Sí | Sí | Sí | Sí | Sí, dentro de alcance |
| Cerrar temporada | Sí | Sí | No | No | No |
| Reabrir temporada | Sí | Sí | No | No | No |
| Solicitar cierre | No necesario | No necesario | Sí | Sí | No |
| Revisar solicitud | Sí | Sí | No | No | No |

La solicitud de Entrenador/Analista requiere además una membresía contextual
`team_season_memberships` activa en backend. Un rol declarado en cliente no basta.

## Cierre

`iq_v6_set_team_season_data_state(..., 'FROZEN', ...)`:

1. bloquea la fila de equipo-temporada;
2. genera un `freeze_token` único;
3. bloquea únicamente los partidos todavía abiertos mediante el lifecycle V5;
4. etiqueta esos cierres con `TEAM_SEASON_FREEZE:<token>`;
5. cambia `data_status` a `FROZEN`;
6. registra auditoría;
7. resuelve automáticamente una petición pendiente compatible, si existe.

Los partidos que ya estaban cerrados manualmente no se alteran.

## Reapertura segura

Al reabrir:

1. el equipo-temporada vuelve a `data_status='ACTIVE'`;
2. se recupera el `freeze_token` del ciclo de cierre;
3. sólo se reabren partidos cuyo `lock_reason` pertenece a ese token;
4. los partidos cerrados manualmente antes del cierre de temporada permanecen
   cerrados;
5. se registra la reapertura en auditoría.

Esto evita que una reapertura de temporada borre decisiones administrativas
previas sobre partidos concretos.

## Defensa en profundidad

La protección no depende de ocultar botones.

Backend V6 incluye:

- `iq_v3_can_manage_roster` condicionado a `data_status='ACTIVE'`;
- trigger en `games`;
- trigger en `roster_memberships`;
- trigger en `roster_membership_stints`;
- política RLS restrictiva para impedir crear partidos en scopes congelados;
- RPCs `SECURITY DEFINER` con autorización contextual;
- tablas de solicitudes e histórico con RLS;
- revocación de escrituras directas autenticadas sobre tablas de lifecycle.

El frontend refleja el mismo estado:

- Plantilla pasa a modo histórico y oculta mutaciones;
- Partidos permite BoxScore/informes, pero no crear, editar, cerrar/reabrir
  individualmente;
- Configuración muestra `Datos abiertos` / `Datos cerrados`;
- Bandeja centraliza las solicitudes.

## Auditoría

Tablas:

- `team_season_freeze_requests`
- `team_season_freeze_history`

Acciones registradas:

- `REQUESTED`
- `REQUEST_APPROVED`
- `REQUEST_REJECTED`
- `FROZEN`
- `REOPENED`

El rollback V6 es deliberadamente no destructivo y se niega a ejecutarse mientras
exista una temporada congelada.

## Despliegue validado

Antes de instalar V6 se verificó producción en modo sólo lectura.

Baseline:

- 4 equipos-temporada;
- 0 congelados;
- 14 partidos;
- 14 partidos abiertos;
- 0 partidos cerrados;
- 23 memberships de plantilla;
- 22 stints;
- 144 estadísticas de jugador;
- 36 eventos.

Se ejecutó:

1. preflight real;
2. rehearsal transaccional `apply → verify → rollback`;
3. comparación exacta de baseline;
4. apply controlado;
5. verificación 16/16;
6. nueva comparación exacta de baseline.

La instalación del backend no cerró ninguna temporada ni modificó datos deportivos.

## Evolución SaaS

El contrato permite ampliar posteriormente el cierre con políticas configurables,
por ejemplo:

- cierre masivo por club;
- fecha de cierre programada;
- doble aprobación;
- snapshot firmado/exportable;
- retención regulatoria;
- reaperturas con ticket obligatorio;
- cierre de módulos Player 360;
- automatización server-side tras aprobación.

Estas extensiones deben mantener el principio actual: **histórico visible,
mutaciones gobernadas y reapertura explícita/auditable**.
