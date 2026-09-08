# V38 · Mobile Live Game / Fast Play-by-Play

## Objetivo

Reducir la carga cognitiva y el número de interacciones necesarias para registrar un partido desde móvil sin perder jugadas, manteniendo el mismo modelo de datos, RBAC, RLS, ciclo de partido y single-writer lease ya existentes.

V38 separa dos necesidades:

1. **Scorer Mode**: captura rápida y segura desde un móvil.
2. **Live Game Center**: seguimiento de sólo lectura para usuarios autorizados (familia, jugador, invitado, staff) desde el BoxScore existente.

## Principios UX

- Una jugada habitual debe registrarse en **dos toques como máximo**: `jugador → acción` o `acción → jugador`.
- Las acciones del rival que no requieren jugador se registran en **un toque**.
- El quinteto permanece visible; no se usan desplegables para localizar jugadores en pista.
- El reloj puede iniciarse/pausarse y ajustarse rápidamente ±5 s.
- Deshacer y rehacer permanecen siempre accesibles.
- La localización del tiro es **opcional** y se conserva como enriquecimiento avanzado.
- Los targets táctiles principales tienen tamaño suficiente para uso móvil y se optimizan para una mano.
- La vibración/haptic es una mejora progresiva y nunca es requisito funcional.

## Arquitectura

### `views/LiveScoreHUDViewV38.js`

Extiende el HUD histórico en lugar de reescribir el ciclo de partido. Conserva:

- pre-partido y convocatoria;
- acta final;
- modelo canónico de eventos;
- sustituciones y cálculo de minutos;
- permisos `RECORD_LIVE_GAME`;
- `GameCaptureDelegationService`;
- `GamePlayStateService`;
- V28 single-writer lease.

Añade únicamente la nueva experiencia de captura durante el estado LIVE.

### `services/games/LiveCaptureSyncService.js`

Frontera de sincronización resiliente. Antes de cada envío persiste un snapshot local del partido. El borrador se elimina sólo cuando el RPC seguro de captura confirma el guardado.

No sustituye al backend ni concede permisos. La base de datos y los RPCs siguen siendo autoritativos.

### `views/games/ScopedGameBoxScoreLiveV38View.js`

Añade un Live Game Center de sólo lectura al BoxScore ya autorizado. Consulta `games` y `play_by_play_events` bajo RLS y no introduce ninguna operación de escritura.

El polling de 2,5 s es deliberadamente sencillo para V38. Una futura evolución puede sustituirlo por Supabase Realtime cuando los pilotos confirmen el patrón de uso y coste.

## Flujo de captura rápida

### Jugador primero

1. Tocar jugador en pista.
2. Tocar acción.

### Acción primero

1. Tocar acción.
2. Tocar jugador en pista.

### Rival

1. Tocar `+1`, `+2`, `+3`, `RD`, `RO` o `PER`.

### Tiro con localización

La sección avanzada abre el flujo histórico de pista y jugador. Es opcional y no bloquea la captura rápida.

## Persistencia live

Para partidos existentes:

1. Se registra la jugada en memoria.
2. Se escribe inmediatamente un borrador local.
3. Tras un debounce corto, se envía el snapshot completo al RPC de captura existente.
4. Si hay cobertura y el lease es válido, el backend actualiza marcador, parciales y PBP.
5. Si falla la red, el borrador permanece en el dispositivo y el siguiente intento vuelve a sincronizar.

El cierre final sigue ejecutando la persistencia completa de acta/estadísticas del flujo histórico.

## Seguridad

- No se hardcodean identidades.
- No se conceden permisos nuevos.
- El scorer sigue requiriendo `RECORD_LIVE_GAME` y el lease V28.
- El Live Game Center no tiene mutaciones y depende de RLS para el alcance del usuario.
- El modo INVITADO puede seguir información únicamente dentro del alcance que ya tiene autorizado.

## Criterios de aceptación V38

1. Canasta/fallo/rebote/asistencia/robo/pérdida/falta: máximo 2 toques.
2. Acción básica rival: 1 toque.
3. Ninguna acción rápida obliga a abrir un modal.
4. Deshacer disponible sin abandonar el HUD.
5. Reloj iniciar/pausar desde el HUD.
6. Pista de tiro sólo bajo opción avanzada.
7. Eventos protegidos mediante borrador local ante fallo de red.
8. Autosync de marcador y PBP durante el partido existente.
9. Live Game Center estrictamente read-only.
10. Build de producción y contrato V38 en verde.

## Fuera de alcance de V38

- Editor de vídeo.
- Etiquetado táctico avanzado durante la captura rápida.
- Realtime websocket dedicado; V38 usa polling controlado para el consumidor.
- Reconstrucción del BoxScore completo en cada jugada; la consolidación estadística final continúa en el acta existente.

## Validación de campo recomendada

Antes de considerar V38 definitiva para producción comercial, realizar al menos un partido completo desde iPhone/Android y medir:

- jugadas omitidas;
- tiempo medio de registro;
- errores corregidos con Undo;
- interrupciones por cobertura;
- consumo de batería/datos;
- percepción del anotador;
- retraso del Live Game Center para familias.
