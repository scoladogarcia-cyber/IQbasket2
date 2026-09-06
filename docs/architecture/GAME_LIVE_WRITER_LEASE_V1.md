# Game Live Writer Lease V1

## Objetivo

Evitar escrituras concurrentes sobre un partido mientras está en estado `LIVE` sin mezclar este problema con el cierre histórico (`edit_state`) ni con la delegación de permisos V21.

La regla de producto es:

> Tener permiso para capturar no implica poseer el turno de escritura en vivo.

## Fronteras que se conservan

- `game_capture_delegations` (V21) decide **quién puede** capturar/editar un partido.
- `games.play_state` decide el estado deportivo (`SCHEDULED/READY/LIVE/FINISHED`).
- `games.edit_state` decide si el histórico está abierto/bloqueado.
- V28 añade únicamente **quién posee ahora el turno de escritura** cuando el partido está `LIVE`.

No se sustituye ninguno de los sistemas anteriores.

## Modelo

### `game_live_sessions`

Una fila por partido con el lease actual:

- `game_id`
- `writer_user_id`
- `lease_token_hash`
- `acquired_at`
- `heartbeat_at`
- `lease_expires_at`
- `released_at`
- `release_reason`
- `version`

El token bruto nunca se persiste. Se guarda SHA-256 mediante `extensions.digest` y el token se devuelve únicamente al titular que adquiere/recibe el lease.

### `game_live_session_events`

Auditoría append-only de:

- `ACQUIRED`
- `FORCED_TAKEOVER`
- `RELEASED`
- `HANDOFF_CREATED`
- `HANDED_OFF`

Los heartbeats no generan filas de auditoría para no convertir una señal técnica frecuente en ruido de negocio.

### `game_live_handoffs`

Token de transferencia de un solo uso, de vida corta, también almacenado únicamente como hash.

## Lease

- TTL servidor: 90 segundos.
- Heartbeat cliente recomendado: 30 segundos.
- Un lease expirado no se renueva mediante heartbeat; debe adquirirse de nuevo.
- Un lease activo bloquea a otros escritores, incluso si es el mismo usuario en otra pestaña/dispositivo.
- El backend serializa adquisición/transferencia por partido mediante advisory lock transaccional.
- Un gestor autorizado puede forzar takeover para recuperación operativa. Esta acción queda auditada.

## Handoff

1. El escritor activo solicita un token de handoff.
2. Backend valida usuario + lease token y crea un token single-use con caducidad corta.
3. Otro usuario con capacidad real `RECORD_LIVE_GAME` acepta el token.
4. La misma transacción rota escritor + lease token.
5. El token anterior deja de ser válido inmediatamente.
6. El handoff queda consumido y no puede reutilizarse.

QR será sólo una representación futura del mismo token, no un mecanismo de seguridad distinto.

## Integración con guardado

V28 introduce `iq_v28_save_game_capture(...)` como frontera pública de escritura.

- Si `play_state = LIVE`, cualquier escritura requiere un lease válido del usuario actual.
- Si el partido no está `LIVE`, se conserva la autorización y validación de V21 sin exigir lease.
- Tras instalar V28 se revoca `EXECUTE` del wrapper público V21 de escritura para impedir bypass.
- El cliente intenta V28 y sólo usa V21 como compatibilidad temporal si V28 todavía no existe (`PGRST202`) durante el rollout.

## Seguridad

- RLS activado en todas las tablas V28.
- `anon` y `authenticated` no tienen acceso directo a tablas.
- RPCs públicos son la única frontera expuesta.
- Autorización de captura reutiliza V21 (`RECORD_LIVE_GAME`) y `iq_private.can_mutate_game`.
- El takeover forzado reutiliza la frontera de gestión V21 y no se concede a un delegado de captura por el mero hecho de estar delegado.
- Tokens y códigos se validan por hash y caducidad.
- El backend sigue siendo autoritativo aunque la UI o el heartbeat fallen.

## Rollout

1. Contrato estático + build.
2. Preflight de prerequisitos.
3. Rehearsal transaccional.
4. Apply V28.
5. Verificación de grants/RLS/RPCs.
6. Activación cliente progresiva.
7. QA de dos sesiones concurrentes y handoff.
