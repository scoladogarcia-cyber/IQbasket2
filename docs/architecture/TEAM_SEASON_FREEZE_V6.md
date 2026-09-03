# IQBasket · Team-Season Freeze V6

## Objetivo

Cerrar una temporada para edición competitiva sin ocultarla ni perder histórico.

V6 separa dos conceptos:

- `team_seasons.status`: vigencia administrativa del vínculo equipo-temporada.
- `team_seasons.data_status`: integridad/editabilidad de los datos.

Estados de datos:

- `ACTIVE`: partidos y plantilla pueden modificarse según RBAC.
- `FROZEN`: la temporada sigue visible y analizable, pero partidos y plantilla quedan en modo histórico de solo lectura.

## Alcance V1

El cierre congela:

- partidos de la temporada;
- estadísticas y eventos dependientes de esos partidos mediante las guardas V5;
- roster memberships;
- roster membership stints;
- RPC de gestión de plantilla.

No oculta:

- estadísticas;
- informes;
- histórico;
- Player 360;
- consultas de temporadas anteriores.

## Roles

Permisos frontend independientes:

- `FREEZE_TEAM_SEASON`
- `REOPEN_TEAM_SEASON`
- `REQUEST_TEAM_SEASON_FREEZE`
- `REVIEW_TEAM_SEASON_FREEZE_REQUESTS`

Gobernanza V6:

- SUPERADMIN: cerrar, reabrir, revisar solicitudes.
- ADMIN: cerrar, reabrir, revisar solicitudes dentro de su scope.
- ENTRENADOR: solicitar cierre en una membresía contextual real.
- ANALISTA: solicitar cierre en una membresía contextual real.
- COORDINADOR / DIRECTOR_DEPORTIVO: no heredan cierre/reapertura sólo por mapearse a ADMIN funcional en otras capacidades.
- INVITADO y perfiles de lectura: sólo consulta.

Supabase es la autoridad final. La UI replica la misma intención para no mostrar acciones que el backend rechazaría.

## Solicitudes

Tabla:

- `team_season_freeze_requests`

Estados:

- PENDING
- APPROVED
- REJECTED
- CANCELLED

Sólo puede existir una solicitud PENDING por equipo-temporada.

Auditoría:

- `team_season_freeze_history`

Acciones:

- REQUESTED
- REQUEST_APPROVED
- REQUEST_REJECTED
- FROZEN
- REOPENED

## Cierre

RPC:

`iq_v6_set_team_season_data_state(team_season_id, 'FROZEN', reason)`

Secuencia:

1. valida identidad y autoridad;
2. genera un `freeze_token`;
3. bloquea únicamente partidos actualmente OPEN;
4. etiqueta esos cierres con `TEAM_SEASON_FREEZE:<token>`;
5. cambia `data_status` a FROZEN;
6. registra actor, fecha, motivo y auditoría;
7. si existía solicitud pendiente, la resuelve como APPROVED.

Un partido ya cerrado manualmente no se modifica.

## Reapertura

RPC:

`iq_v6_set_team_season_data_state(team_season_id, 'ACTIVE', reason)`

Secuencia:

1. valida autoridad;
2. recupera el `freeze_token` del ciclo;
3. reactiva el scope;
4. reabre sólo partidos cuyo `lock_reason` contiene exactamente ese token;
5. conserva bloqueos manuales o anteriores;
6. registra la reapertura en auditoría.

Esto evita que una reapertura de temporada borre decisiones administrativas previas sobre partidos concretos.

## Defensa en profundidad

### Partidos

Trigger:

- `trg_iq_v6_guard_frozen_team_season_game`

Impide INSERT / UPDATE / DELETE directo de partidos en scopes FROZEN.

Además siguen activas las guardas V5 para recursos hijos de partidos bloqueados.

RLS restrictiva:

- `v6 games unfrozen insert guard`

Evita crear partidos en una temporada congelada.

### Plantilla

Triggers:

- `trg_iq_v6_guard_frozen_roster_membership`
- `trg_iq_v6_guard_frozen_roster_stint`

El helper `iq_v3_can_manage_roster` exige además que `data_status='ACTIVE'`.

Incluso SUPERADMIN debe reabrir explícitamente la temporada antes de corregir roster.

## UX

Configuración > Temporadas muestra dos estados independientes:

- vínculo ACTIVE / ARCHIVED;
- datos abiertos / datos cerrados.

El usuario distingue así “archivar vínculo” de “cerrar datos”.

Acciones V6 usan controles inline:

- motivo/nota de auditoría dentro de la tarjeta;
- botones con altura táctil mínima de 44 px;
- sin `prompt()`;
- confirmación explícita antes de cerrar o reabrir.

La Bandeja de Solicitudes integra cierres de temporada con acceso, cierre de partido y traspasos.

## Compatibilidad

`SeasonFreezeService.getCapabilities()` consulta:

- `iq_v6_team_season_freeze_capabilities`

Si el backend no está instalado, la UI queda en modo lectura y no expone acciones V6.

## Rollback

`20260903_rollback_v6_team_season_freeze.sql` es no destructivo:

- exige reabrir scopes FROZEN antes del rollback;
- elimina guardas/acciones V6;
- restaura el helper de roster anterior;
- conserva columnas y tablas de auditoría.

No borra histórico.

## Validación realizada

### Instalación

Preflight real:

- team-seasons: 4
- frozen: 0
- games: 14
- roster memberships: 23
- roster stints: 22
- player game stats: 144
- game events: 36

Rehearsal:

- apply + verify + rollback: PASS
- 16/16 verificaciones: PASS
- baseline antes/después: idéntico

Apply real:

- 16/16 verificaciones: PASS
- sin congelar ninguna temporada automáticamente
- sin cambios de datos de dominio durante instalación

### Prueba funcional transaccional

El entorno real contenía cierres manuales legítimos de partido.

La prueba V6:

1. conserva un cierre manual existente;
2. abre temporalmente otro partido dentro de la transacción;
3. congela la temporada;
4. comprueba que el partido V6 recibe token;
5. comprueba que roster queda bloqueado;
6. reabre la temporada;
7. comprueba que el cierre manual permanece;
8. comprueba que el partido V6 vuelve a OPEN;
9. ejecuta ROLLBACK.

Resultado:

- 6/6 checks: PASS
- baseline antes/después: idéntico

El SQL reproducible se conserva en:

`supabase/tests/20260903_team_season_freeze_functional_transaction.sql`

## Tests permanentes

- `tests/team-season-freeze-sql.mjs`
- `tests/team-season-freeze-service-rbac.mjs`
- `tests/team-season-freeze-ui-contract.mjs`
- `tests/team-season-freeze-ui-smoke.mjs`

La smoke Playwright valida desktop 1440×900 e iPhone 390×844.
