# Game Play State V2

## Objetivo

Separar dos conceptos que antes podían confundirse:

- `play_state`: qué está ocurriendo deportivamente en el partido.
- `edit_state`: si el registro histórico puede modificarse.

`play_state` es la nueva fuente canónica del ciclo deportivo. `status` se conserva temporalmente como proyección de compatibilidad para lectores legacy.

## Estados deportivos

- `SCHEDULED`: programado.
- `READY`: preparado para empezar.
- `LIVE`: en juego.
- `FINISHED`: finalizado; puede seguir `OPEN` para correcciones.
- `CANCELLED`: cancelado.

Transiciones V2:

`SCHEDULED -> READY -> LIVE -> FINISHED`

Además:

- `READY -> SCHEDULED` para corregir una preparación accidental.
- `SCHEDULED/READY -> CANCELLED`, con motivo obligatorio en backend.
- `FINISHED` y `CANCELLED` son terminales en V2. Una futura reapertura deportiva deberá ser una acción privilegiada y auditada, no una edición manual.

## Composición con edit_state

Ejemplos válidos:

- `SCHEDULED + OPEN`: partido futuro editable.
- `READY + OPEN`: preparado, todavía no iniciado.
- `LIVE + OPEN`: captura activa.
- `FINISHED + OPEN`: terminó, acta corregible.
- `FINISHED + LOCKED`: histórico oficial.
- `SCHEDULED + LOCKED`: posible únicamente por ciclos administrativos como freeze de temporada; no significa partido jugado.

Un `READY` o `LIVE` no se puede bloquear. Debe terminar o salir del estado operativo primero.

## RBAC por acción

La UI no reutiliza un único permiso genérico para las transiciones. Se añaden:

- `PREPARE_GAME`
- `START_GAME`
- `FINISH_GAME`
- `CANCEL_GAME`

SUPERADMIN hereda todos. ADMIN y ENTRENADOR reciben los cuatro. ANALISTA puede preparar, iniciar y finalizar, pero no cancelar. Jugador, familia, visor e invitado no reciben permisos de transición.

El backend vuelve a validar cada destino con roles contextuales y no confía en la visibilidad del botón.

## Backend

Migración: `supabase/ready/20260905_apply_game_play_state_v2.sql`.

Añade a `games`:

- `play_state`
- `play_state_changed_at`
- `play_state_changed_by`
- `play_state_reason`

Añade la auditoría privada `game_play_state_transitions` y dos RPC públicas para usuarios autenticados:

- `iq_v13_game_play_state_snapshot(uuid)`
- `iq_v13_set_game_play_state(uuid,text,text)`

La tabla de auditoría no tiene acceso directo de cliente. La proyección de lectura omite el UUID del actor; la identidad completa permanece en auditoría de servidor.

## Compatibilidad legacy

Mientras existan dashboards/agregadores que lean `games.status`, el trigger V13 mantiene una proyección:

- `SCHEDULED -> Programado`
- `READY -> Preparado`
- `LIVE -> En curso`
- `FINISHED -> Finalizado`
- `CANCELLED -> Cancelado`

Después de instalar V2, una escritura aislada del viejo `status` no puede modificar el lifecycle canónico.

Durante el backfill técnico, los triggers V5 de partido bloqueado y V6 de temporada congelada se suspenden únicamente dentro de la misma transacción y se reactivan antes de exponer los RPC V13. La migración verifica que no queden deshabilitados.

## UX

`features/game-state/GamePlayStateEnhancer.js` añade una barra progresiva a captura rápida con botones grandes y permisos por acción. Es idempotente: su `MutationObserver` coalesce renderizados y usa una firma de estado para no observar indefinidamente sus propios cambios.

## Rollback

`20260905_rollback_game_play_state_v2.sql` solo permite rollback destructivo si aún no existe historial real de transiciones. Si existe auditoría, aborta con `GAME_PLAY_STATE_V2_ROLLBACK_REFUSED_AUDIT_EXISTS`.

## Evolución posterior

1. Migrar consumidores legacy de `status` para leer `play_state`.
2. Añadir reapertura deportiva privilegiada y auditada si el piloto demuestra la necesidad.
3. Integrar control de periodo, quinteto y sustituciones sobre `LIVE`.
4. Conectar el estado de sincronización offline sin mezclarlo con `play_state` ni `edit_state`.
