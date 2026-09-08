# V39 · Live Capture Onboarding & Streaming UX

## Problema resuelto

V38 mejoró la captura PBP móvil, pero un partido todavía en estado `SCHEDULED` podía abrir el scorer antes de que la UI mostrara la transición deportiva. El backend V28 rechazaba correctamente el lease de escritura hasta `READY/LIVE`, dejando al usuario frente a una pantalla visualmente bloqueada sin una acción clara para continuar.

Además, el alta legacy de “Nuevo partido en vivo” lanzaba un HUD en memoria sin `gameId`, impidiendo lease, autosync y seguimiento live desde el primer instante.

## Decisión de producto

V39 separa dos trabajos distintos:

1. **Anotar**: interfaz mobile-first para quien captura el partido.
2. **Seguir**: Game Center read-only para usuarios autorizados que sólo quieren marcador, acta y play-by-play.

La inspiración funcional es la velocidad de los scorers especializados, pero IQBasket mantiene su propia interfaz, arquitectura, RBAC y modelo de datos.

## Flujo de alta live

`Nuevo partido en vivo` → datos mínimos → quinteto inicial 5/5 → persistencia del partido → `SCHEDULED → READY → LIVE` → `#/live/:gameId` → lease V28 → captura.

La persistencia ocurre antes de las transiciones. Si el inicio falla, el partido creado se conserva y puede retomarse desde Partidos.

## Scorer móvil

- marcador/reloj compacto;
- 5 en pista visibles;
- acción rápida `jugadora ↔ acción`;
- paleta fija sobre la navegación inferior en móvil;
- cambio inmediato `Mi equipo / Rival`;
- mantiene deshacer/rehacer, cambios, haptic, tiro avanzado opcional y sync resiliente de V38;
- un partido `SCHEDULED/READY` muestra una puerta explícita de inicio antes de intentar adquirir el writer lease.

## Game Center

Ruta: `#/boxscore/:gameId/live`.

Pestañas:

- **Marcador**: score, estado, periodo/reloj y últimas jugadas;
- **Acta**: resumen individual acumulado a partir del PBP visible;
- **Jugadas**: feed del partido.

El Game Center hace exclusivamente `SELECT` y permanece detrás de la RLS y permisos existentes. V39 no crea acceso público anónimo.

## Seguridad

- sin nuevos roles o permisos;
- crear un partido live requiere `CREATE_GAME + RECORD_LIVE_GAME + PREPARE_GAME + START_GAME`;
- una delegación de captura sobre un partido existente no concede `CREATE_GAME`;
- el scorer mantiene el single-writer lease V28;
- el espectador usa `VIEW_BOXSCORE` y RLS;
- sin cambios de esquema ni ampliación de policies.

## QA

El contrato V39 valida persistencia-before-start, permisos, composición del start gate, scorer, viewer read-only y wiring. El smoke Chromium iPhone 390×844 valida específicamente el caso reportado: 5 titulares, ausencia de overflow, gate visible, lease dormido antes de LIVE, transición READY/LIVE y paleta fija dentro del viewport.

## Siguiente evolución posible

Un enlace público/semipúblico para seguidores debería implementarse con un token de sólo lectura, alcance mínimo, expiración y proyección de datos explícita. No debe reutilizar sesiones privadas ni exponer Player 360, wellness u otros datos sensibles.
