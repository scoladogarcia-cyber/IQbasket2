# IQBasket · Transfer Dual Review V4

## Objetivo

Sustituir el flujo temporal de traspasos con aprobación única por SUPERADMIN por un proceso auditable de doble revisión entre equipo de origen y equipo de destino, sin debilitar el motor de transferencia temporal ya validado.

## Principios

- La solicitud y cada aprobación son acciones independientes.
- El equipo de destino propone la primera fecha de elegibilidad.
- El equipo de origen confirma el último día de elegibilidad.
- La base exige que la fecha de alta en destino sea posterior al último día en origen.
- ENTRENADOR puede solicitar si dispone de gestión de plantilla, pero no aprobar administrativamente.
- ADMIN, COORDINADOR y DIRECTOR_DEPORTIVO pueden revisar únicamente los ámbitos que administran.
- SUPERADMIN conserva la finalización técnica mientras el motor V3 siga exigiendo privilegio global.
- El histórico de plantilla nunca se reescribe: se mantienen memberships y stints temporales.
- Las decisiones se validan también en backend. Ocultar botones en la UI nunca constituye una autorización.

## Estados y entidades

### roster_transfer_requests

Las nuevas solicitudes usan:

- `workflow_version = DUAL_REVIEW_V2`
- `requested_first_date_to`: fecha de alta propuesta por destino.
- `status`: PENDING / APPROVED / REJECTED / CANCELLED.

Las solicitudes V3 anteriores siguen siendo compatibles.

### roster_transfer_reviews

Una solicitud V2 tiene exactamente dos revisiones:

- SOURCE
- DESTINATION

Cada revisión registra:

- decision: PENDING / APPROVED / REJECTED;
- effective_date;
- reviewer_id;
- reviewed_at;
- reason;
- timestamps.

Existe una restricción única por `request_id + side`.

## Flujo funcional

1. El destino selecciona un jugador en Mercado.
2. Indica la fecha prevista de alta.
3. `iq_v4_request_transfer` reutiliza las validaciones V3 de jugador activo, temporada global y duplicados.
4. Se crean las revisiones SOURCE y DESTINATION.
5. Si quien solicita también tiene autoridad administrativa en destino, DESTINATION queda autoaprobado con la fecha propuesta.
6. El origen valida su último día o rechaza.
7. El destino valida su fecha si aún estaba pendiente o rechaza.
8. Una sola denegación cierra la solicitud sin modificar la plantilla.
9. Con ambas partes aprobadas, la solicitud queda lista para finalización.
10. SUPERADMIN ejecuta `iq_v4_finalize_transfer_request`.
11. El finalizador recupera las fechas aprobadas y llama al motor probado `iq_v3_approve_transfer_request`.
12. El motor V3 aplica el cambio temporal de roster y cancela solicitudes incompatibles del mismo jugador/origen.

## Defensa contra bypass

Para solicitudes `DUAL_REVIEW_V2`, `iq_v3_approve_transfer_request` exige:

- las dos revisiones aprobadas;
- coincidencia exacta entre las fechas aprobadas y las fechas usadas en la finalización.

Por tanto, ni siquiera SUPERADMIN puede finalizar una V2 saltándose el acuerdo registrado.

## RBAC frontend

Permisos independientes:

- `REQUEST_TRANSFER`
- `REVIEW_TRANSFER_SOURCE`
- `REVIEW_TRANSFER_DESTINATION`
- `FINALIZE_TRANSFER`

El permiso global no sustituye el scope: PermissionService valida también teamId/teamSeasonId.

## RLS

### roster_transfer_requests

Puede leer una solicitud:

- su solicitante;
- SUPERADMIN;
- quien administre el team-season de origen;
- quien administre el team-season de destino.

El solicitante sólo obtiene lectura; no obtiene capacidad de revisión o mutación.

### roster_transfer_reviews

Puede leer las revisiones quien tenga acceso legítimo a la solicitud. No existen INSERT/UPDATE/DELETE directos para authenticated; las mutaciones pasan por RPC.

## UX

### Mercado

Cuando V4 está disponible:

- muestra un campo de fecha visible dentro del modal;
- no usa `prompt()`;
- la fecha se valida contra la temporada activa;
- la petición se envía con `firstDateTo`.

Si V4 no está disponible, TransferRequestService mantiene fallback V3.

### Configuración / Plantilla

- Las solicitudes V2 se muestran como resumen.
- La acción operativa se deriva a Bandeja de Solicitudes.
- Los handlers legacy rechazan explícitamente una V2 para evitar bypass accidental.
- Las solicitudes V1 legacy siguen disponibles para SUPERADMIN.

### Bandeja de Solicitudes

Cada traspaso muestra:

- jugador;
- origen → destino;
- fecha propuesta;
- estado SOURCE;
- estado DESTINATION;
- fecha efectiva de cada lado;
- inputs inline de fecha y motivo;
- botones táctiles de aprobación/rechazo sólo donde el permiso lo autoriza;
- botón Finalizar únicamente cuando ambas partes están aprobadas.

Los controles están diseñados para desktop y viewport iPhone sin depender de popups desplazables.

## Compatibilidad y despliegue

TransferRequestService intenta primero `iq_v4_transfer_request_capabilities`. Si no existe, cae a `iq_v3_transfer_request_capabilities`.

Esto permite desplegar backend y frontend de forma desacoplada.

## Rollback

`20260903_rollback_v4_dual_transfer.sql`:

- revoca las acciones V4;
- restaura la función legacy de aprobación;
- restaura la política V3 legacy;
- no elimina tablas;
- no elimina columnas;
- no borra auditoría.

## Validación realizada

Baseline de producción antes de V4:

- transfer requests: 0;
- players: 17;
- roster memberships: 23;
- roster stints: 22;
- games: 14;
- player game stats: 144;
- game events: 36.

Validaciones:

- preflight real: PASS;
- ensayo apply → verify → rollback: PASS;
- apply real aditivo: PASS;
- sync de requester self-read: PASS;
- 15/15 verificaciones SQL: PASS;
- baseline de dominio antes/después: idéntico;
- CI SQL / service / RBAC / UI integration: PASS.

La smoke de navegador desktop/iPhone forma parte del gate final de la rama.
